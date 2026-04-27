"""Unit tests for the pure helpers in `translate-i18n.py`.

No sidecar required — runs offline. Cover the four pure-helper concerns
the dispatch named:

    1. Placeholder extraction (regex inventory)
    2. Tone YAML schema validation
    3. Locale-code parity vs check-i18n-keys.js
    4. Placeholder-mismatch detection

Run with:

    python -m pytest client/scripts/test_translate_i18n.py -v
"""
from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

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
# Test 3: locale list parity vs check-i18n-keys.js
# ---------------------------------------------------------------------------
def test_locale_lists_match_check_i18n_keys_js() -> None:
    """`translate-i18n.py`'s `NON_EN_LOCALES` MUST equal the same-named
    constant in `check-i18n-keys.js`. The pre-commit + CI parity gate is
    that JS list; if Python drifts, translation runs against a different
    locale set than the gate enforces, and bundles would silently
    desync."""
    js_path = THIS_DIR / "check-i18n-keys.js"
    js_text = js_path.read_text(encoding="utf-8")

    # Match: const NON_EN_LOCALES = [ 'zh-Hans', 'zh-Hant', ... ];
    match = re.search(
        r"const\s+NON_EN_LOCALES\s*=\s*\[(.*?)\];",
        js_text,
        re.DOTALL,
    )
    assert match is not None, (
        f"Could not locate `const NON_EN_LOCALES = [...]` in {js_path.name}. "
        f"check-i18n-keys.js may have been refactored — update this test."
    )
    js_array_body = match.group(1)
    js_locales = sorted(re.findall(r"['\"]([\w-]+)['\"]", js_array_body))

    py_locales = sorted(translate_i18n.NON_EN_LOCALES)

    assert js_locales == py_locales, (
        f"NON_EN_LOCALES drift between Python and JS. "
        f"py={py_locales} js={js_locales} "
        f"missing_in_py={set(js_locales) - set(py_locales)} "
        f"extra_in_py={set(py_locales) - set(js_locales)}"
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


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
