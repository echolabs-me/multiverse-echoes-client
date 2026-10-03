"""Unit tests for the pure helpers in `translate-i18n.py`.

No sidecar required — runs offline. Cover the four pure-helper concerns
the dispatch named:

    1. Placeholder extraction (regex inventory)
    2. Tone YAML schema validation
    3. Locale-code parity vs the locale folder check-i18n-keys.js reads
    4. Placeholder-mismatch detection

Run with:

    python -m pytest client/scripts/test_translate_i18n.py -v
"""
from __future__ import annotations

import importlib.util
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest

# ---------------------------------------------------------------------------
# Module loader
# ---------------------------------------------------------------------------
# `translate-i18n.py` (with the hyphen) is a CLI script, not an importable
# module. Use importlib to load it under a synthetic name so pytest can
# call its functions directly.
THIS_DIR = Path(__file__).resolve().parent
TRANSLATE_PATH = THIS_DIR / "translate-i18n.py"


def _load_translate_module():
    spec = importlib.util.spec_from_file_location("translate_i18n", TRANSLATE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module spec for {TRANSLATE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["translate_i18n"] = module
    spec.loader.exec_module(module)
    return module


translate_i18n = _load_translate_module()


# ---------------------------------------------------------------------------
# Test 1: placeholder extraction covers {name}, <Tag>, %s, %d
# ---------------------------------------------------------------------------
def test_extract_placeholders_covers_all_three_pattern_classes() -> None:
    """`extract_placeholders` must identify every {name}, <Tag>, %s, %d
    token in a representative i18n string. Sorted output is order-
    independent across pattern classes; repeated tokens preserved."""
    sample = (
        "Hello {name}, you have <strong>{count}</strong> echoes "
        "(%d remaining out of %s total slots)."
    )
    actual = translate_i18n.extract_placeholders(sample)
    expected = sorted(["{name}", "<strong>", "{count}", "</strong>", "%d", "%s"])
    assert actual == expected, (
        f"extract_placeholders missed or invented tokens. "
        f"sample={sample!r} expected={expected} actual={actual}"
    )


# ---------------------------------------------------------------------------
# Test 2: tone YAML schema validation
# ---------------------------------------------------------------------------
def test_tone_yaml_validates_against_21_locale_schema() -> None:
    """`load_tone_yaml` must accept the shipped `i18n-tone.yaml` and
    return a dict keyed by all 21 locales, each with the four required
    fields."""
    tones = translate_i18n.load_tone_yaml()
    expected_locales = {"en", *translate_i18n.NON_EN_LOCALES}
    assert set(tones.keys()) == expected_locales, (
        f"i18n-tone.yaml locale set mismatch. "
        f"missing={sorted(expected_locales - set(tones.keys()))} "
        f"extra={sorted(set(tones.keys()) - expected_locales)}"
    )
    for locale, entry in tones.items():
        for field in translate_i18n.TONE_REQUIRED_FIELDS:
            assert field in entry, (
                f"i18n-tone.yaml entry for '{locale}' missing required field '{field}'"
            )
            assert isinstance(entry[field], str), (
                f"i18n-tone.yaml entry for '{locale}' field '{field}' "
                f"must be a string, got {type(entry[field]).__name__}"
            )
        assert entry["locale"] == locale, (
            f"i18n-tone.yaml entry key '{locale}' does not match "
            f"its 'locale' field '{entry['locale']}'"
        )


# ---------------------------------------------------------------------------
# Test 3: locale list parity vs the locale folder check-i18n-keys.js reads
# ---------------------------------------------------------------------------
def test_locale_list_matches_the_locale_folder() -> None:
    """`translate-i18n.py`'s `NON_EN_LOCALES` MUST equal the locale files
    in `client/src/locales/` other than en.json, which are the locales
    `check-i18n-keys.js` checks (R266.5). The pre-commit + CI parity gate
    reads that folder; if Python drifts, translation runs against a
    different locale set than the gate enforces, and bundles would
    silently desync."""
    folder_locales = sorted(
        path.stem for path in translate_i18n.LOCALES_DIR.glob("*.json") if path.name != "en.json"
    )

    py_locales = sorted(translate_i18n.NON_EN_LOCALES)

    assert folder_locales == py_locales, (
        f"NON_EN_LOCALES drift between Python and the locale folder. "
        f"py={py_locales} folder={folder_locales} "
        f"missing_in_py={set(folder_locales) - set(py_locales)} "
        f"extra_in_py={set(py_locales) - set(folder_locales)}"
    )


# ---------------------------------------------------------------------------
# Test 4: placeholder-mismatch detection
# ---------------------------------------------------------------------------
def test_placeholders_match_detects_dropped_named_placeholder() -> None:
    """`placeholders_match` must return False when the translation drops
    a named placeholder. This is the primary failure mode the
    placeholder-retry loop guards against — a model that translates
    "you have {count} echoes" into "vous avez des echoes" silently
    loses {count} and would corrupt a runtime t() call."""
    source = "Hello {name}, you have {count} echoes."
    translated_dropped = "Bonjour {name}, vous avez des echoes."
    assert translate_i18n.placeholders_match(source, translated_dropped) is False, (
        "placeholders_match should detect the dropped {count} token. "
        f"source={source!r} translated={translated_dropped!r} "
        f"source_tokens={translate_i18n.extract_placeholders(source)} "
        f"translated_tokens={translate_i18n.extract_placeholders(translated_dropped)}"
    )

    # Positive control: identical placeholder inventory must match.
    translated_intact = "Bonjour {name}, vous avez {count} echoes."
    assert translate_i18n.placeholders_match(source, translated_intact) is True, (
        "placeholders_match should accept a translation that preserves "
        "the full placeholder inventory."
    )


# ---------------------------------------------------------------------------
# Bonus: idempotent-fill predicate
# ---------------------------------------------------------------------------
def test_needs_translation_predicate() -> None:
    """`needs_translation` is the load-bearing predicate behind
    idempotent-fill mode. Sanity-check its three branches."""
    assert translate_i18n.needs_translation("Hello", None) is True
    assert translate_i18n.needs_translation("Hello", "Hello") is True
    assert translate_i18n.needs_translation("Hello", "Bonjour") is False


# ---------------------------------------------------------------------------
# Bonus: collect_pairs walks nested structure correctly
# ---------------------------------------------------------------------------
def test_collect_pairs_walks_nested_dicts_and_lists() -> None:
    """`collect_pairs` must yield every leaf string in the en tree with
    the parallel target value (or None if missing). Used by every
    translation mode."""
    en = {
        "settings": {
            "title": "Settings",
            "buttons": ["Save", "Cancel"],
        },
        "echoes": {
            "empty": "No echoes yet",
        },
    }
    target = {
        "settings": {
            "title": "Paramètres",
            "buttons": ["Enregistrer"],  # short list — second item missing
        },
        # echoes section missing entirely
    }
    pairs = list(translate_i18n.collect_pairs(en, target))
    paths_found = {tuple(p): (en_text, tgt_text) for p, en_text, tgt_text in pairs}

    assert paths_found[("settings", "title")] == ("Settings", "Paramètres")
    assert paths_found[("settings", "buttons", 0)] == ("Save", "Enregistrer")
    assert paths_found[("settings", "buttons", 1)] == ("Cancel", None), (
        "missing list element should yield (en_text, None)"
    )
    assert paths_found[("echoes", "empty")] == ("No echoes yet", None), (
        "missing dict subtree should yield (en_text, None)"
    )


# ---------------------------------------------------------------------------
# Test 5: --derive-zh-hant default-OFF gate (Backlog #3 defensive guard)
# ---------------------------------------------------------------------------
# Two tests pin the gate behaviour at the call-site invocation in
# translate-i18n.py:`mode_translate`. The OpenCC `convert_zh_hant` helper
# is patched at the module level so the gate decision (call vs skip) is
# observable without exercising the OpenCC import or hitting any locale
# files. The `LOCALES_DIR` and `EN_LOCALE` are redirected to a tmp_path
# containing only `en.json` — every other sidecar locale file is absent,
# so the loop's "SKIP: locale file not found" branch fires for each and
# the actual `translate_locale` is never invoked. This isolates the
# zh-Hant gate from the per-locale translation pipeline.
def _seed_translate_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Redirect LOCALES_DIR + EN_LOCALE to a tmp_path with only en.json,
    so the sidecar loop short-circuits per-locale and the test exercises
    only the zh-Hant gate."""
    en_path = tmp_path / "en.json"
    en_path.write_text(json.dumps({"a": "Hello"}), encoding="utf-8")
    monkeypatch.setattr(translate_i18n, "LOCALES_DIR", tmp_path)
    monkeypatch.setattr(translate_i18n, "EN_LOCALE", en_path)


def test_convert_zh_hant_skipped_when_flag_off(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """`mode_translate(..., derive_zh_hant=False)` MUST NOT call
    `convert_zh_hant`, AND MUST emit a deliberate skip-log line so a
    routine fan-out pass surfaces the change in behaviour."""
    _seed_translate_env(tmp_path, monkeypatch)

    convert_mock = MagicMock()
    monkeypatch.setattr(translate_i18n, "convert_zh_hant", convert_mock)

    rc = translate_i18n.mode_translate(
        force=False,
        target_locales=["zh-Hans", "zh-Hant"],
        terms=[],
        derive_zh_hant=False,
    )
    captured = capsys.readouterr()

    convert_mock.assert_not_called()
    assert "--derive-zh-hant flag not set" in captured.out, (
        f"skip-log substring missing from stdout. Got: {captured.out!r}"
    )
    assert rc == 0, f"expected clean exit, got rc={rc}"


def test_convert_zh_hant_runs_when_flag_on(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """`mode_translate(..., derive_zh_hant=True)` MUST call
    `convert_zh_hant` exactly once with no arguments (matching today's
    zero-arg signature) AND MUST NOT emit the skip-log line."""
    _seed_translate_env(tmp_path, monkeypatch)

    convert_mock = MagicMock(return_value={"status": "ok", "size": 1234})
    monkeypatch.setattr(translate_i18n, "convert_zh_hant", convert_mock)

    rc = translate_i18n.mode_translate(
        force=False,
        target_locales=["zh-Hans", "zh-Hant"],
        terms=[],
        derive_zh_hant=True,
    )
    captured = capsys.readouterr()

    convert_mock.assert_called_once_with()
    assert "--derive-zh-hant flag not set" not in captured.out, (
        f"skip-log substring leaked into flag-ON path. Got: {captured.out!r}"
    )
    assert rc == 0, f"expected clean exit, got rc={rc}"


# ---------------------------------------------------------------------------
# The brand words (R256): each request carries the terms its text contains,
# and a translation that loses one is rejected. Offline: the sidecar is a
# stand-in transport, so no request leaves the machine (SR51).
# ---------------------------------------------------------------------------
def _stand_in_sidecar(
    monkeypatch: pytest.MonkeyPatch,
    answer: Callable[[dict[str, Any]], str | None],
) -> list[dict[str, Any]]:
    """Route the script's sidecar calls to a local stand-in. Each item sent
    is answered by `answer`; every request body is recorded and returned.
    A single request `answer` gives None is answered 500, so the script's
    `raise_for_status` raises."""
    sent: list[dict[str, Any]] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        sent.append(body)
        if request.url.path == "/translate/batch":
            results = [{"translated_text": answer(item)} for item in body["items"]]
            return httpx.Response(200, json={"results": results})
        translated = answer(body)
        if translated is None:
            return httpx.Response(500, json={"detail": "stand-in failure"})
        return httpx.Response(200, json={"translated_text": translated})

    real_client = httpx.Client

    def client(**kwargs: Any) -> httpx.Client:
        return real_client(transport=httpx.MockTransport(handle), **kwargs)

    monkeypatch.setattr(translate_i18n.httpx, "Client", client)
    monkeypatch.setattr(translate_i18n.time, "sleep", lambda _s: None)
    return sent


TERMS = ["Multiverse Echoes", "Echoes", "Echo"]


def test_each_request_carries_the_terms_its_text_contains(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = _stand_in_sidecar(monkeypatch, lambda item: item["text"])
    translate_i18n.translate_batch(["Meet your Echo", "Your Echoes", "Settings"], "es", TERMS)
    translate_i18n.translate_single("Welcome to Multiverse Echoes", "es", TERMS)

    batch, single = sent
    assert [item["keep_terms"] for item in batch["items"]] == [["Echo"], ["Echoes"], []]
    assert single["keep_terms"] == ["Multiverse Echoes", "Echoes"]


def test_a_term_inside_a_longer_word_is_not_contained() -> None:
    # The rule `check-i18n` applies: "Echoes" does not contain the word "Echo".
    assert translate_i18n.terms_in("Your Echoes", ["Echo"]) == []
    assert translate_i18n.terms_in("Echo's diary", ["Echo"]) == ["Echo"]


def _seed_locale(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, en: dict[str, str]) -> Path:
    """An en.json and an es.json holding the English placeholders."""
    (tmp_path / "en.json").write_text(json.dumps(en), encoding="utf-8")
    es_path = tmp_path / "es.json"
    es_path.write_text(json.dumps(en), encoding="utf-8")
    monkeypatch.setattr(translate_i18n, "LOCALES_DIR", tmp_path)
    monkeypatch.setattr(translate_i18n, "EN_LOCALE", tmp_path / "en.json")
    return es_path


def test_a_translation_that_loses_a_term_keeps_the_english_and_fails_the_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    es_path = _seed_locale(tmp_path, monkeypatch, {"meet": "Meet your Echo", "plain": "Settings"})
    answers = {"Meet your Echo": "Conoce a tu Eco", "Settings": "Ajustes"}
    sent = _stand_in_sidecar(monkeypatch, lambda item: answers[item["text"]])

    rc = translate_i18n.mode_translate(force=False, target_locales=["es"], terms=TERMS)

    es = json.loads(es_path.read_text(encoding="utf-8"))
    assert es == {"meet": "Meet your Echo", "plain": "Ajustes"}
    assert rc == 2
    assert "  es meet: brand words lost: Echo, after 3 retries\n" in capsys.readouterr().err
    # The batch, then three retries of the value that lost its term.
    assert len(sent) == 4


def test_a_retry_that_keeps_the_term_is_taken(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    es_path = _seed_locale(tmp_path, monkeypatch, {"meet": "Meet your Echo"})
    replies = iter(["Conoce a tu Eco", "Conoce a tu Echo"])
    _stand_in_sidecar(monkeypatch, lambda _item: next(replies))

    rc = translate_i18n.mode_translate(force=False, target_locales=["es"], terms=TERMS)

    assert json.loads(es_path.read_text(encoding="utf-8")) == {"meet": "Conoce a tu Echo"}
    assert rc == 0


def _replies(*replies: str | None) -> Callable[[dict[str, Any]], str | None]:
    """Answer each request with the next reply, in order."""
    queue = iter(replies)
    return lambda _item: next(queue)


def test_a_retry_that_raises_is_followed_by_the_next_retry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # R297.1: the batch loses the term, retry 1 raises, retry 2 keeps it.
    es_path = _seed_locale(tmp_path, monkeypatch, {"meet": "Meet your Echo"})
    sent = _stand_in_sidecar(monkeypatch, _replies("Conoce a tu Eco", None, "Conoce a tu Echo"))

    rc = translate_i18n.mode_translate(force=False, target_locales=["es"], terms=TERMS)

    assert json.loads(es_path.read_text(encoding="utf-8")) == {"meet": "Conoce a tu Echo"}
    assert rc == 0
    assert len(sent) == 3


def test_three_raised_retries_leave_the_english_and_fail_the_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    # R297.1 and R297.2: each retry raises, all three run, and the value
    # keeps its English with what failed and the last error named.
    es_path = _seed_locale(tmp_path, monkeypatch, {"meet": "Meet your Echo"})
    sent = _stand_in_sidecar(monkeypatch, _replies("Conoce a tu Eco", None, None, None))

    rc = translate_i18n.mode_translate(force=False, target_locales=["es"], terms=TERMS)

    assert json.loads(es_path.read_text(encoding="utf-8")) == {"meet": "Meet your Echo"}
    assert rc == 2
    err = capsys.readouterr().err
    assert "  es meet: brand words lost: Echo, after 3 retries; last error: retry 3/3 raised HTTPStatusError" in err
    assert len(sent) == 4


def test_placeholders_that_do_not_match_after_the_retries_leave_the_english_and_fail_the_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    # R297.2: the placeholder check takes the same path as the brand words.
    es_path = _seed_locale(tmp_path, monkeypatch, {"hi": "Hello {name}", "plain": "Settings"})
    answers = {"Hello {name}": "Hola", "Settings": "Ajustes"}
    sent = _stand_in_sidecar(monkeypatch, lambda item: answers[item["text"]])

    rc = translate_i18n.mode_translate(force=False, target_locales=["es"], terms=TERMS)

    es = json.loads(es_path.read_text(encoding="utf-8"))
    assert es == {"hi": "Hello {name}", "plain": "Ajustes"}
    assert rc == 2
    assert "  es hi: placeholders expected=['{name}'] actual=[], after 3 retries\n" in capsys.readouterr().err
    assert len(sent) == 4


def test_the_fallback_reads_the_word_list_through_this_script() -> None:
    # One reader of i18n-do-not-translate.yaml for both routes (R266.3).
    adapter_path = THIS_DIR / "translate-i18n-anthropic.py"
    spec = importlib.util.spec_from_file_location("translate_i18n_anthropic", adapter_path)
    assert spec is not None and spec.loader is not None
    adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter)
    assert adapter.load_do_not_translate is translate_i18n.load_do_not_translate


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
