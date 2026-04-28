"""Unit tests for the pure helpers in `translate-i18n-anthropic.py`.

No real Anthropic API calls — the SDK is mocked at module load time so
test execution stays offline + free. Mirrors the offline test pattern
of `test_translate_i18n.py`, with extra coverage for the JSON-array
response parser the Anthropic adapter introduces and for the
do-not-translate vocabulary loader + system-prompt injection added in
the brand-term recovery fold-in.

Cover six pure-helper concerns specific to this adapter:

    1. JSON-array response parsing (happy path)
    2. Markdown-fence stripping (defensive recovery)
    3. JSON-array response parsing — count-mismatch failure
    4. JSON-array response parsing — non-list payload rejection
    5. System prompt incorporates locale tone guidance verbatim
    6. Re-export invariant — pure helpers are the same Python objects
       as in translate-i18n.py
    7. Do-not-translate YAML loads to expected schema (NEW)
    8. System prompt injects do-not-translate vocabulary verbatim (NEW)

Run with:

    python -m pytest client/scripts/test_translate_i18n_anthropic.py -v
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

THIS_DIR = Path(__file__).resolve().parent
ADAPTER_PATH = THIS_DIR / "translate-i18n-anthropic.py"


def _load_adapter_module():
    spec = importlib.util.spec_from_file_location("translate_i18n_anthropic", ADAPTER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module spec for {ADAPTER_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["translate_i18n_anthropic"] = module
    spec.loader.exec_module(module)
    return module


adapter = _load_adapter_module()


# ---------------------------------------------------------------------------
# Test 1: parse_json_array_response handles the happy path
# ---------------------------------------------------------------------------
def test_parse_json_array_response_happy_path() -> None:
    """A well-formed JSON array of N strings parses to that exact list,
    in order. This is the contract `translate_batch_anthropic` relies
    on — every other branch is a defensive guard."""
    raw = '["Bonjour", "Au revoir", "Merci"]'
    out = adapter.parse_json_array_response(raw, expected_n=3)
    assert out == ["Bonjour", "Au revoir", "Merci"], (
        f"Expected ordered round-trip; got {out!r}"
    )


# ---------------------------------------------------------------------------
# Test 2: markdown-fence stripping recovers a fenced JSON payload
# ---------------------------------------------------------------------------
def test_parse_json_array_response_strips_markdown_fence() -> None:
    """Models occasionally wrap JSON in ```json ... ``` despite the
    system prompt forbidding fences. Defensive parsing strips the
    fence so a single instruction-following lapse doesn't fail the
    whole locale.

    Rule #30 invert: feed the SAME content WITHOUT the fence and confirm
    it ALSO parses (proves the fence-stripper isn't masking a parser
    that depends on the fence)."""
    fenced = '```json\n["a", "b"]\n```'
    bare = '["a", "b"]'

    fenced_result = adapter.parse_json_array_response(fenced, expected_n=2)
    bare_result = adapter.parse_json_array_response(bare, expected_n=2)

    assert fenced_result == ["a", "b"], (
        f"fenced payload must parse; got {fenced_result!r}"
    )
    assert bare_result == ["a", "b"], (
        f"bare payload must also parse (rule-30 polarity); got {bare_result!r}"
    )
    assert fenced_result == bare_result, (
        "fenced and bare payloads with identical content MUST produce "
        "identical parse results"
    )


# ---------------------------------------------------------------------------
# Test 3: parse_json_array_response rejects count mismatches
# ---------------------------------------------------------------------------
def test_parse_json_array_response_rejects_count_mismatch() -> None:
    """If the model returns the wrong number of translations the
    locale write must abort — silently keeping a too-short or too-long
    list would mis-align the (path, value) pairs and corrupt the
    bundle.

    Rule #30 invert verification: the assertion message MUST include
    BOTH the actual length and the expected length. We confirm by
    asserting on the message contents — not just that ValueError was
    raised. Without precise diagnostics, callers debugging mid-run
    failures would have to print-debug the response themselves."""
    raw = '["one", "two"]'  # length 2
    with pytest.raises(ValueError) as excinfo:
        adapter.parse_json_array_response(raw, expected_n=5)
    msg = str(excinfo.value)
    assert "2" in msg and "5" in msg, (
        f"ValueError message must cite both actual (2) and expected (5) lengths; "
        f"got {msg!r}"
    )


# ---------------------------------------------------------------------------
# Test 4: parse_json_array_response rejects non-list payloads
# ---------------------------------------------------------------------------
def test_parse_json_array_response_rejects_non_list_payload() -> None:
    """A JSON object or scalar parsed as the response must fail the
    type guard with a precise diagnostic — not silently coerce."""
    raw = '{"a": "b"}'
    with pytest.raises(ValueError) as excinfo:
        adapter.parse_json_array_response(raw, expected_n=1)
    assert "list" in str(excinfo.value).lower()


# ---------------------------------------------------------------------------
# Test 5: build_system_prompt threads tone guidance into the prompt
# ---------------------------------------------------------------------------
def test_build_system_prompt_includes_locale_and_tone_fields_verbatim() -> None:
    """The system prompt must include the locale code AND every required
    field from the tone YAML entry (register, dialect_variant, notes).
    Without this, the Anthropic adapter would translate without the
    tone guidance the Gemma sidecar applies internally — silent
    register drift in production translations.

    Rule #30 polarity check below: confirm a TYPO in any field of the
    tone entry would fail this assertion."""
    tone_entry = {
        "locale": "ja",
        "register": "formal_ui_desu_masu",
        "dialect_variant": "Standard Japanese (ja-JP)",
        "notes": "Use polite desu / masu form for UI strings.",
    }
    prompt = adapter.build_system_prompt("ja", tone_entry)
    assert "ja" in prompt, "locale code must appear in system prompt"
    assert tone_entry["register"] in prompt, (
        f"register must appear verbatim; missing from {prompt!r}"
    )
    assert tone_entry["dialect_variant"] in prompt, (
        f"dialect_variant must appear verbatim"
    )
    # `notes` is YAML-loaded with `>` folded indicator — the loader
    # collapses whitespace; `in` check tolerates leading/trailing whitespace.
    assert tone_entry["notes"].strip() in prompt, (
        f"notes must appear verbatim (modulo strip); missing from {prompt!r}"
    )

    # Polarity: a different register value MUST NOT appear in the
    # prompt — confirms the field was rendered, not hardcoded.
    bogus = "formal_BOGUS_register_does_not_appear"
    assert bogus not in prompt, "polarity check failed (placeholder leak)"


# ---------------------------------------------------------------------------
# Test 6: shared helpers are aliased not re-implemented
# ---------------------------------------------------------------------------
def test_pure_helpers_are_re_exports_of_translate_i18n() -> None:
    """The adapter's `extract_placeholders`, `placeholders_match`,
    `collect_pairs`, `set_at_path`, `needs_translation`,
    `load_tone_yaml`, `write_locale`, `convert_zh_hant`, and the locale
    constants must be the SAME object as in translate-i18n.py.

    If anyone duplicates one of these helpers locally, the adapter's
    contract would silently drift from the Gemma path's contract — the
    placeholder regex sets, idempotent-fill predicate, or locale list
    could subtly differ run-to-run. The only correct way to mirror the
    contract is to re-export the same Python objects."""
    # The adapter's `_load_sibling_module` cached translate-i18n.py under
    # `sys.modules['translate_i18n']` at adapter import time. Reuse that
    # exact instance — loading the file a second time under a different
    # synthetic name would create independent module objects with
    # value-equal but identity-distinct constants, making `is` comparison
    # impossible by construction.
    sibling = sys.modules.get("translate_i18n")
    assert sibling is not None, (
        "translate-i18n.py should already be loaded under "
        "sys.modules['translate_i18n'] by adapter import; got None"
    )

    shared = [
        "SIDECAR_LOCALES",
        "NON_EN_LOCALES",
        "TONE_REQUIRED_FIELDS",
        "extract_placeholders",
        "placeholders_match",
        "load_tone_yaml",
        "collect_pairs",
        "set_at_path",
        "needs_translation",
        "write_locale",
        "convert_zh_hant",
    ]
    for name in shared:
        assert getattr(adapter, name) is getattr(sibling, name), (
            f"adapter.{name} must be the same object as translate_i18n.{name} "
            f"(re-export, not duplicate). got "
            f"adapter.{name}={getattr(adapter, name)!r} vs "
            f"sibling.{name}={getattr(sibling, name)!r}"
        )


# ---------------------------------------------------------------------------
# Test 7: do-not-translate YAML loads to the expected three-section schema
# ---------------------------------------------------------------------------
def test_yaml_config_loaded_correctly() -> None:
    """`load_do_not_translate` must accept the shipped
    `i18n-do-not-translate.yaml` and return a dict with the three
    required sections (`product_nouns`, `brand_technical_terms`,
    `shard_proper_nouns`), each containing a non-empty list of
    non-empty strings.

    This test's purpose is structural: the brand-term invariant the
    YAML enforces (Echo / Echoes / Multiverse Echoes / Shard / Tick
    / etc. must NEVER be translated) only holds if the YAML actually
    parses with these vocabulary terms present. A mis-spelled section
    name (`shard_propernouns`), a list-of-objects instead of list-of-
    strings, or an accidentally-empty section would all let the
    adapter ship a system prompt without the protection.

    Rule #30 invert: confirms via `flatten_do_not_translate` that the
    flattened list contains "Multiverse Echoes" + "Echo" + "Echoes"
    in exactly the order the YAML lists them — this catches both a
    mis-ordered YAML (longest-match-first invariant) and a missing
    canonical term."""
    vocab = adapter.load_do_not_translate()

    # Schema: three required sections.
    expected_sections = {"product_nouns", "brand_technical_terms", "shard_proper_nouns"}
    assert set(vocab.keys()) == expected_sections, (
        f"YAML section set drift. expected={sorted(expected_sections)} "
        f"got={sorted(vocab.keys())}"
    )

    # Every section must have at least one non-empty string entry.
    for section, entries in vocab.items():
        assert isinstance(entries, list), (
            f"section {section!r} must be a list; got {type(entries).__name__}"
        )
        assert len(entries) > 0, (
            f"section {section!r} is empty — at least one term required"
        )
        for i, term in enumerate(entries):
            assert isinstance(term, str) and term.strip(), (
                f"section {section!r} entry [{i}] must be a non-empty string; "
                f"got {term!r}"
            )

    # Canonical terms that anchor the brand-term invariant must be
    # present in product_nouns. If any of these go missing, the
    # adapter's system prompt loses the most-frequent-violation
    # protection and brand drift returns.
    canonical_product_nouns = {"Multiverse Echoes", "Echo", "Echoes", "Shard", "Tick"}
    actual_product_nouns = set(vocab["product_nouns"])
    missing = canonical_product_nouns - actual_product_nouns
    assert not missing, (
        f"product_nouns missing canonical terms: {sorted(missing)}. "
        f"actual product_nouns={vocab['product_nouns']}"
    )

    # Flattened list preserves the YAML's longest-match-first ordering.
    flat = adapter.flatten_do_not_translate(vocab)
    me_idx = flat.index("Multiverse Echoes")
    echoes_idx = flat.index("Echoes")
    echo_idx = flat.index("Echo")
    assert me_idx < echoes_idx < echo_idx, (
        f"YAML order broken — 'Multiverse Echoes' must precede 'Echoes' "
        f"which must precede 'Echo' so longest-match-first scanning works "
        f"in the system prompt. got indices: "
        f"Multiverse Echoes={me_idx} Echoes={echoes_idx} Echo={echo_idx}"
    )


# ---------------------------------------------------------------------------
# Test 8: build_system_prompt injects the do-not-translate vocabulary
# ---------------------------------------------------------------------------
def test_brand_terms_preserved_in_system_prompt() -> None:
    """The system prompt must include EVERY entry from the
    do-not-translate vocabulary verbatim, marked as a CRITICAL
    instruction that overrides the voice/tone guidance.

    This test catches the regression class that produced the initial
    17bd345 brand-term failures: if the adapter loads the YAML but
    doesn't actually inject the terms into the prompt sent to the
    model, brand vocabulary still gets translated. The test pins
    both halves of the invariant: (a) every term appears in the
    prompt, (b) the prompt explicitly tells the model these
    override the locale's natural register.

    Rule #30 invert below: confirms a NEW vocabulary term added to
    the input list also appears in the rendered prompt. Hardcoded
    fallback would pass the canonical-list assertion but fail this
    polarity check."""
    tone_entry = {
        "locale": "es",
        "register": "formal_usted",
        "dialect_variant": "International Spanish",
        "notes": "Use 'usted' for direct address.",
    }
    do_not_translate = [
        "Multiverse Echoes",
        "Echo",
        "Echoes",
        "Shard",
        "FLUX.2",
        "Cyber-Tokyo 2045",
    ]
    prompt = adapter.build_system_prompt("es", tone_entry, do_not_translate)

    # (a) Every vocabulary term appears verbatim.
    for term in do_not_translate:
        assert term in prompt, (
            f"vocabulary term {term!r} must appear verbatim in system prompt; "
            f"missing from prompt of length {len(prompt)}"
        )

    # (b) The prompt explicitly marks the section as overriding tone.
    assert "VERBATIM" in prompt or "verbatim" in prompt, (
        "system prompt must explicitly use the word 'VERBATIM' to convey "
        "the strict-preservation invariant"
    )
    assert "CRITICAL" in prompt, (
        "system prompt must mark the do-not-translate section as CRITICAL "
        "so the model treats it as overriding the tone register"
    )

    # Rule #30 polarity: a NEW term added to the input list MUST also
    # appear in the rendered prompt. If build_system_prompt hardcoded
    # the canonical list instead of rendering from input, this would
    # fail.
    sentinel = "ZZZ_SentinelBrandTerm_DoesNotExist_42"
    polarity_prompt = adapter.build_system_prompt(
        "es", tone_entry, do_not_translate + [sentinel]
    )
    assert sentinel in polarity_prompt, (
        f"polarity check failed: adding {sentinel!r} to the input list did "
        f"NOT cause it to appear in the rendered prompt — implies hardcoded "
        f"vocabulary instead of input-rendered"
    )

    # Polarity inverse: if the input list is empty, the do-not-translate
    # section should be omitted entirely (no "CRITICAL: DO-NOT-TRANSLATE"
    # marker should leak when there are no terms).
    empty_prompt = adapter.build_system_prompt("es", tone_entry, [])
    assert "DO-NOT-TRANSLATE VOCABULARY" not in empty_prompt, (
        "empty vocabulary list must omit the section header — otherwise "
        "the model sees 'CRITICAL: ... (empty list)' which is confusing"
    )


# ---------------------------------------------------------------------------
# Test 9: build_system_prompt enforces source-plural-form preservation
# ---------------------------------------------------------------------------
def test_plural_form_preservation_in_system_prompt() -> None:
    """The system prompt must include the PLURAL FORM PRESERVATION rule
    that requires sentence restructuring when locale grammar would
    otherwise collapse a source plural ('Echoes') to singular ('Echo').

    This test pins the regression class that surfaced after the initial
    do-not-translate fix: the model preserved 'Echo' verbatim (which IS
    in the YAML) but collapsed source plural 'Echoes' to singular 'Echo'
    in 4 locales (fr, pt-BR, tl, it) where natural quantifier-singular
    grammar pulled toward singular. Without the explicit
    "RESTRUCTURE the sentence" instruction, the model satisfies the
    do-not-translate rule on a substring basis (Echo ⊆ Echoes) while
    still failing the source-form-preservation invariant.

    Rule #30 polarity below: if the rule were absent, the polarity
    check that asserts 'PLURAL FORM PRESERVATION' header is absent
    from the empty-vocabulary prompt would still hold, but the
    presence assertion in the populated-vocabulary prompt would fail.
    Confirms the rule is conditional on do_not_translate being
    populated."""
    tone_entry = {
        "locale": "fr",
        "register": "formal_vous",
        "dialect_variant": "Standard French",
        "notes": "Address users with the formal 'vous' form.",
    }
    do_not_translate = ["Multiverse Echoes", "Echoes", "Echo"]
    prompt = adapter.build_system_prompt("fr", tone_entry, do_not_translate)

    # (a) The section header is present.
    assert "PLURAL FORM PRESERVATION" in prompt, (
        f"system prompt must include the 'PLURAL FORM PRESERVATION' "
        f"section so the model knows to restructure rather than collapse "
        f"plural→singular. missing from prompt of length {len(prompt)}"
    )

    # (b) The rule mentions the actual source/locale forms it's
    # disambiguating between — 'Echoes' (plural source) and 'Echo'
    # (singular). Without these tokens the rule is too abstract.
    assert "Echoes" in prompt and "Echo" in prompt, (
        "PLURAL rule must mention both 'Echoes' (source plural) and "
        "'Echo' (collapsed singular) to anchor the disambiguation"
    )

    # (c) The rule mentions the natural-grammar trigger words from at
    # least one of the four observed locales (aucun / nessun / nenhum /
    # ningún). If a future refactor drops these examples, the model
    # loses the most-vivid context for what restructuring looks like.
    triggers = ["aucun", "nessun", "nenhum", "ningún"]
    assert any(trigger in prompt for trigger in triggers), (
        f"PLURAL rule must reference at least one observed quantifier "
        f"trigger word (one of {triggers}); none found in prompt"
    )

    # (d) The rule explicitly uses the word RESTRUCTURE — that's the
    # action verb the model needs to know is permitted. Without it the
    # model defaults to literal translation and hits the morphology
    # mismatch.
    assert "RESTRUCTURE" in prompt or "restructure" in prompt.lower(), (
        "PLURAL rule must use the word 'RESTRUCTURE' (or lowercase) so "
        "the model knows sentence-level rewriting is permitted"
    )

    # Rule #30 polarity: when the do-not-translate list is empty, the
    # PLURAL FORM PRESERVATION section must also be absent (it's
    # conditional on the dnt block, not unconditional).
    empty_prompt = adapter.build_system_prompt("fr", tone_entry, [])
    assert "PLURAL FORM PRESERVATION" not in empty_prompt, (
        "empty vocabulary list must omit the PLURAL FORM PRESERVATION "
        "section — without brand terms there's nothing to preserve "
        "the plural form of"
    )


# ---------------------------------------------------------------------------
# Test 9: --derive-zh-hant default-OFF gate (Backlog #3 defensive guard)
# ---------------------------------------------------------------------------
# Mirrors the gate tests in `test_translate_i18n.py` but exercises the
# adapter-specific call site at translate-i18n-anthropic.py:712. The
# patch target is `adapter.convert_zh_hant` (the adapter's module-scope
# alias of the primary's helper) rather than `translate_i18n.convert_zh_hant`,
# so the test catches a regression in the adapter's plumbing without
# depending on the primary path.
def _seed_adapter_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Redirect LOCALES_DIR + EN_LOCALE to a tmp_path with only en.json,
    so the sidecar loop short-circuits per-locale and the test exercises
    only the zh-Hant gate."""
    en_path = tmp_path / "en.json"
    en_path.write_text(json.dumps({"a": "Hello"}), encoding="utf-8")
    monkeypatch.setattr(adapter, "LOCALES_DIR", tmp_path)
    monkeypatch.setattr(adapter, "EN_LOCALE", en_path)


def test_adapter_convert_zh_hant_skipped_when_flag_off(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Adapter `mode_translate(..., derive_zh_hant=False)` MUST NOT call
    `convert_zh_hant` AND MUST emit the deliberate skip-log line. Patches
    the adapter's module-scope alias (the same name `mode_translate`
    resolves at line 712), so a future drift between adapter.convert_zh_hant
    and the primary's binding would still be observable here."""
    _seed_adapter_env(tmp_path, monkeypatch)

    convert_mock = MagicMock()
    monkeypatch.setattr(adapter, "convert_zh_hant", convert_mock)

    rc = adapter.mode_translate(
        client=MagicMock(),
        tones={},
        do_not_translate=[],
        force=False,
        target_locales=["zh-Hans", "zh-Hant"],
        key_filter=None,
        derive_zh_hant=False,
    )
    captured = capsys.readouterr()

    convert_mock.assert_not_called()
    assert "--derive-zh-hant flag not set" in captured.out, (
        f"skip-log substring missing from stdout. Got: {captured.out!r}"
    )
    assert rc == 0, f"expected clean exit, got rc={rc}"


def test_adapter_convert_zh_hant_runs_when_flag_on(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Adapter `mode_translate(..., derive_zh_hant=True)` MUST call
    `convert_zh_hant` exactly once with no arguments AND MUST NOT emit
    the skip-log line."""
    _seed_adapter_env(tmp_path, monkeypatch)

    convert_mock = MagicMock(return_value={"status": "ok", "size": 1234})
    monkeypatch.setattr(adapter, "convert_zh_hant", convert_mock)

    rc = adapter.mode_translate(
        client=MagicMock(),
        tones={},
        do_not_translate=[],
        force=False,
        target_locales=["zh-Hans", "zh-Hant"],
        key_filter=None,
        derive_zh_hant=True,
    )
    captured = capsys.readouterr()

    convert_mock.assert_called_once_with()
    assert "--derive-zh-hant flag not set" not in captured.out, (
        f"skip-log substring leaked into flag-ON path. Got: {captured.out!r}"
    )
    assert rc == 0, f"expected clean exit, got rc={rc}"
