#!/usr/bin/env python3
"""Translate UI i18n keys via the Anthropic API (claude-opus-4-7).

Capacity-fallback adapter for `translate-i18n.py`. Activate when the
B200 / Gemma sidecar is unavailable (capacity-queued, scheduling hold,
infra outage). Same CLI surface, same translation contract — only the
network-call layer differs.

When to prefer this adapter
    The Gemma sidecar path (`translate-i18n.py`) remains the primary
    option: free, self-hosted, no per-fan-out cost. This adapter is
    the documented fallback when waiting on B200 capacity would block
    a commit on the i18n parity gate. Trade-off: cents-per-fan-out via
    the Anthropic API + an external dependency, against zero-second
    availability.

Contract preserved from `translate-i18n.py`
    - Identical placeholder-preservation rules ({name}, <Tag>, %s/%d/%i/%f)
    - Identical idempotent-fill semantics (target value missing OR equal
      to the English source ⇒ translate)
    - Identical tone-YAML schema validation at startup; tone is APPLIED
      to the system prompt for each Anthropic call (the Gemma sidecar
      applies tone internally; here we apply it client-side)
    - Identical key-set diff logic (only translates pending keys)
    - Identical output: in-place writes to `client/src/locales/<locale>.json`
      with UTF-8, 2-space indent, trailing newline, `ensure_ascii=False`
    - Identical zh-Hant derivation from zh-Hans via OpenCC s2hk
    - Identical CLI surface: `--check`, `--test`, `--force`, `--locale`,
      `--verbose`

Backend differences
    - No HTTP sidecar, no `/health` probe — `ANTHROPIC_API_KEY` env var
      check at startup; refuses to run if unset (no fallback)
    - One Anthropic `messages.create` call per locale per run, batching
      all pending strings into a single JSON-array round-trip
    - `claude-opus-4-7` (Opus, not Sonnet — translation is one-shot
      quality-sensitive work; cost differential is sub-dollar even at
      full fan-out)

Modes
    Identical to `translate-i18n.py`. See that script's docstring for
    full mode descriptions.

Usage
    ANTHROPIC_API_KEY=sk-ant-... python client/scripts/translate-i18n-anthropic.py
    ANTHROPIC_API_KEY=sk-ant-... python client/scripts/translate-i18n-anthropic.py --force
    ANTHROPIC_API_KEY=sk-ant-... python client/scripts/translate-i18n-anthropic.py --locale ja
    ANTHROPIC_API_KEY=sk-ant-... python client/scripts/translate-i18n-anthropic.py --check
    ANTHROPIC_API_KEY=sk-ant-... python client/scripts/translate-i18n-anthropic.py --test

Exit codes
    0  all (locale, key) pairs translated (or already filled)
    1  ANTHROPIC_API_KEY unset OR Anthropic SDK import failure
    2  one or more (locale, key) pairs failed (details printed)
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

# Reuse the shared helpers from translate-i18n.py rather than
# duplicating them. translate-i18n.py is a CLI script (hyphenated
# filename) so we load it via importlib under a synthetic module
# name — same pattern as test_translate_i18n.py uses for its tests.
THIS_DIR = Path(__file__).resolve().parent
SIBLING_PATH = THIS_DIR / "translate-i18n.py"


def _load_sibling_module() -> Any:
    spec = importlib.util.spec_from_file_location("translate_i18n", SIBLING_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module spec for {SIBLING_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("translate_i18n", module)
    spec.loader.exec_module(module)
    return module


_sibling = _load_sibling_module()

# Re-export the constants + pure helpers that this adapter mirrors.
# Aliasing here keeps the rest of the file readable while preserving
# the "single source of truth lives in translate-i18n.py" invariant.
SIDECAR_LOCALES = _sibling.SIDECAR_LOCALES
NON_EN_LOCALES = _sibling.NON_EN_LOCALES
TONE_REQUIRED_FIELDS = _sibling.TONE_REQUIRED_FIELDS
extract_placeholders = _sibling.extract_placeholders
placeholders_match = _sibling.placeholders_match
load_tone_yaml = _sibling.load_tone_yaml
collect_pairs = _sibling.collect_pairs
set_at_path = _sibling.set_at_path
needs_translation = _sibling.needs_translation
write_locale = _sibling.write_locale
convert_zh_hant = _sibling.convert_zh_hant

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "src" / "locales"
EN_LOCALE = LOCALES_DIR / "en.json"
DO_NOT_TRANSLATE_YAML = Path(__file__).resolve().parent / "i18n-do-not-translate.yaml"

# Anthropic model. Opus 4.7 chosen over Sonnet 4.6 because translation
# is one-shot quality-sensitive work — placeholder-preservation rate is
# the metric that matters, and Opus handles the placeholder-fidelity
# instruction better. Cost differential at full fan-out (20 locales ×
# ~20 strings) is sub-dollar.
MODEL = "claude-opus-4-7"

# Per-batch max output tokens. A locale bundle of ~50 strings translates
# into a JSON array of <5 KB; 4096 tokens is generous headroom.
MAX_TOKENS = 4096

# Anthropic SDK timeout (per call). Translation generation is bursty
# but each call should complete in well under 60 s; 120 s headroom for
# tail latency.
SDK_TIMEOUT = 120.0


# ---------------------------------------------------------------------------
# Do-not-translate vocabulary loading + flattening
# ---------------------------------------------------------------------------
DO_NOT_TRANSLATE_REQUIRED_SECTIONS = (
    "product_nouns",
    "brand_technical_terms",
    "shard_proper_nouns",
)


def load_do_not_translate(path: Path = DO_NOT_TRANSLATE_YAML) -> dict[str, list[str]]:
    """Read i18n-do-not-translate.yaml. Schema-validates the three
    required sections and confirms every entry is a non-empty string.

    Mirrors `load_tone_yaml`'s startup-validate-fail-fast pattern.
    A malformed YAML or missing section is caught at script start, not
    silently ignored — the consequence of a missing entry is a brand
    term getting translated, which is the regression class this
    config exists to prevent.
    """
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    if not isinstance(data, dict):
        raise ValueError(
            f"i18n-do-not-translate.yaml must parse to a top-level dict, "
            f"got {type(data).__name__}"
        )
    out: dict[str, list[str]] = {}
    for section in DO_NOT_TRANSLATE_REQUIRED_SECTIONS:
        if section not in data:
            raise ValueError(
                f"i18n-do-not-translate.yaml missing required section '{section}'"
            )
        entries = data[section]
        if not isinstance(entries, list):
            raise ValueError(
                f"i18n-do-not-translate.yaml section '{section}' must be a list, "
                f"got {type(entries).__name__}"
            )
        for i, entry in enumerate(entries):
            if not isinstance(entry, str) or not entry.strip():
                raise ValueError(
                    f"i18n-do-not-translate.yaml section '{section}' entry [{i}] "
                    f"must be a non-empty string, got {entry!r}"
                )
        out[section] = list(entries)
    # Reject extra top-level keys to catch typos like 'shard_propernouns'.
    extra = set(data.keys()) - set(DO_NOT_TRANSLATE_REQUIRED_SECTIONS)
    if extra:
        raise ValueError(
            f"i18n-do-not-translate.yaml has unexpected top-level sections: "
            f"{sorted(extra)}. Expected only: "
            f"{list(DO_NOT_TRANSLATE_REQUIRED_SECTIONS)}"
        )
    return out


def flatten_do_not_translate(vocab: dict[str, list[str]]) -> list[str]:
    """Flatten the three vocabulary sections into a single list,
    preserving order: product_nouns first (most-frequent), then
    brand_technical_terms, then shard_proper_nouns.

    Order matters for the system prompt — listing 'Multiverse Echoes'
    before 'Echoes' before 'Echo' (which is the YAML order) helps the
    model match longest-first when scanning candidate translations,
    so 'Multiverse Echoes' isn't accidentally split mid-token."""
    flat: list[str] = []
    for section in DO_NOT_TRANSLATE_REQUIRED_SECTIONS:
        flat.extend(vocab[section])
    return flat


# ---------------------------------------------------------------------------
# Anthropic SDK plumbing
# ---------------------------------------------------------------------------
def _import_anthropic() -> Any:
    """Import the `anthropic` SDK or surface a precise error.

    Kept as a function (not a module-level import) so the test suite
    can mock the SDK via `sys.modules['anthropic']` without triggering
    a real-network import path during test discovery.
    """
    try:
        from anthropic import Anthropic
    except ImportError as e:
        print(
            f"FATAL: anthropic SDK import failed: {e}\n"
            "Install with: pip install -r client/scripts/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)
    return Anthropic


def _ensure_api_key() -> None:
    """Refuse to run unless ANTHROPIC_API_KEY is set. No fallback."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "FATAL: ANTHROPIC_API_KEY is not set in the environment.\n"
            "Set it via your shell profile, .env, or a one-off:\n"
            "    ANTHROPIC_API_KEY=sk-ant-... python client/scripts/translate-i18n-anthropic.py",
            file=sys.stderr,
        )
        sys.exit(1)


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------
def build_system_prompt(
    locale: str,
    tone_entry: dict[str, str],
    do_not_translate: list[str] | None = None,
) -> str:
    """Compose the system prompt for one locale.

    Encodes the placeholder-preservation invariant in the same multiset
    terms `placeholders_match` checks, the locale-specific tone
    guidance from i18n-tone.yaml, AND a CRITICAL do-not-translate
    vocabulary list (product nouns, brand technical terms, shard
    proper nouns) that must appear verbatim in every translation
    regardless of locale. The Gemma sidecar embeds equivalent rules
    internally; this adapter ships them client-side because we control
    the prompt directly.

    `do_not_translate` is the flattened list from
    `flatten_do_not_translate(load_do_not_translate())`. When None,
    the do-not-translate section is omitted (used by the legacy test
    fixtures that predate the YAML config; production code always
    passes a populated list).
    """
    dnt_block = ""
    if do_not_translate:
        joined = "\n".join(f"  - {term}" for term in do_not_translate)
        dnt_block = (
            f"CRITICAL: DO-NOT-TRANSLATE VOCABULARY\n"
            f"  The following terms must appear VERBATIM in your output,\n"
            f"  in their listed Latin / English form, in every locale.\n"
            f"  Never translate, never transliterate, never pluralise\n"
            f"  these terms differently from their listed form. They\n"
            f"  are product nouns, brand names, and proper nouns that\n"
            f"  define the product's identity across all locales:\n"
            f"{joined}\n"
            f"  If you encounter any of these terms in the source text,\n"
            f"  output them EXACTLY as listed. This rule overrides the\n"
            f"  voice/tone guidance below — preserve brand identity\n"
            f"  even if the locale's natural register would localise\n"
            f"  the term.\n\n"
            f"PLURAL FORM PRESERVATION\n"
            f"  Source plural forms of brand terms (e.g. 'Echoes' rather\n"
            f"  than 'Echo', 'Shards' rather than 'Shard') MUST be\n"
            f"  preserved verbatim in your output, even when the target\n"
            f"  locale's natural grammar suggests a singular form would\n"
            f"  be more idiomatic. If the locale's quantifier construction\n"
            f"  (French 'aucun', Italian 'nessun', Portuguese 'nenhum',\n"
            f"  Spanish 'ningún', etc.) would naturally pair with a\n"
            f"  singular noun, RESTRUCTURE the sentence to use a\n"
            f"  different construction that accepts plural.\n"
            f"  Examples of acceptable restructuring:\n"
            f"    Source EN:    'No public Echoes yet.'\n"
            f"    GOOD FR:      \"Pas encore d'Echoes publics.\"  (use 'pas de')\n"
            f"    GOOD IT:      'Non ci sono ancora Echoes pubblici.'\n"
            f"    GOOD PT-BR:   'Ainda não há Echoes públicos.'\n"
            f"    GOOD ES:      'Aún no hay Echoes públicos.'\n"
            f"    BAD (avoid):  'Aucun Echo public…' or 'Nessun Echo…'\n"
            f"                  (mismatched grammar — collapses Echoes→Echo)\n"
            f"  The principle: brand identity (preserve the literal source\n"
            f"  form of brand vocabulary including pluralisation) takes\n"
            f"  priority over natural-locale-grammar preferences.\n"
            f"  Restructure the non-brand portion of the sentence as\n"
            f"  needed.\n\n"
        )
    return (
        f"You are a professional translator translating UI strings from "
        f"English into {locale}.\n\n"
        f"{dnt_block}"
        f"VOICE & TONE\n"
        f"  Register:        {tone_entry['register']}\n"
        f"  Dialect variant: {tone_entry['dialect_variant']}\n"
        f"  Notes:           {tone_entry['notes'].strip()}\n\n"
        f"PLACEHOLDER PRESERVATION RULES\n"
        f"  Each input string may contain placeholders in three forms:\n"
        f"    - {{name}}       i18next named interpolation (most common)\n"
        f"    - <Tag></Tag>    JSX inline formatting tags\n"
        f"    - %s %d %i %f    printf-style tokens\n"
        f"  Every placeholder MUST appear in the translation EXACTLY as\n"
        f"  it appears in the source — same spelling, same case, same\n"
        f"  punctuation. Do not translate placeholder contents. Do not\n"
        f"  add or drop placeholders. Do not reorder repeated placeholders\n"
        f"  beyond what target-language grammar requires.\n\n"
        f"OUTPUT RULES\n"
        f"  Translation must be production-grade UI copy in {locale} that\n"
        f"  reads naturally to a native speaker of the target dialect.\n"
        f"  Do not add explanatory text, markdown, or commentary.\n"
    )


def build_user_prompt_batch(strings: list[str]) -> str:
    """Compose the user prompt asking for a JSON array of translations.

    Returns a prompt asking the model to emit ONLY a JSON array of N
    translated strings, in the same order as the input. The caller
    parses the response with `_parse_json_array_response`.
    """
    indexed = "\n".join(f"  {i}: {s!r}" for i, s in enumerate(strings))
    n = len(strings)
    return (
        f"Translate these {n} English UI strings.\n\n"
        f"INPUT (numbered for reference; do NOT echo numbers in the output):\n"
        f"{indexed}\n\n"
        f"OUTPUT FORMAT\n"
        f"  Return ONLY a single JSON array of {n} translated strings, in\n"
        f"  the same order as the inputs. No commentary, no markdown\n"
        f"  fences, no surrounding text. Example shape:\n"
        f"    [\"translation 0\", \"translation 1\", ...]\n"
    )


def build_user_prompt_single(text: str) -> str:
    """Compose the user prompt for a single-string retry round-trip.

    Used when a batch translation fails placeholder-multiset parity on
    one entry — a tighter, single-string prompt usually recovers the
    placeholder. Mirrors the `translate_single` retry path in
    translate-i18n.py.
    """
    return (
        f"Translate this single English UI string. Return ONLY the\n"
        f"translated string — no quotes, no markdown, no commentary.\n\n"
        f"{text}"
    )


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------
_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(.*?)\n```\s*$", re.DOTALL)


def _strip_markdown_fence(raw: str) -> str:
    """Strip ```json ... ``` fences if a model wraps its JSON output.

    The system prompt forbids fences, but defensive parsing avoids a
    whole-locale failure on a single instruction-following lapse.
    """
    s = raw.strip()
    m = _FENCE_RE.match(s)
    if m:
        return m.group(1).strip()
    return s


def parse_json_array_response(raw: str, expected_n: int) -> list[str]:
    """Parse a JSON array of `expected_n` strings out of the model's text.

    Raises `ValueError` with a precise diagnostic on any of:
      - Markdown-stripped payload doesn't parse as JSON
      - Parsed payload isn't a list
      - List length != expected_n
      - Any element isn't a string
    """
    cleaned = _strip_markdown_fence(raw)
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"response is not valid JSON: {e.msg} (line {e.lineno}, col {e.colno}). "
            f"first 200 chars: {cleaned[:200]!r}"
        ) from e
    if not isinstance(parsed, list):
        raise ValueError(
            f"response JSON is {type(parsed).__name__}, expected list of {expected_n} strings"
        )
    if len(parsed) != expected_n:
        raise ValueError(
            f"response array length {len(parsed)} != expected {expected_n}"
        )
    out: list[str] = []
    for i, item in enumerate(parsed):
        if not isinstance(item, str):
            raise ValueError(
                f"response array item {i} is {type(item).__name__}, expected str"
            )
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# Anthropic transport
# ---------------------------------------------------------------------------
def translate_batch_anthropic(
    client: Any,
    items: list[str],
    target_locale: str,
    tone_entry: dict[str, str],
    do_not_translate: list[str] | None,
) -> list[str]:
    """Call Anthropic with a batched-translation prompt.

    One API call per locale per run. Returns the parsed list of
    translations (length == len(items), order == input order). Raises
    on transport failure or response-shape failure; the caller treats
    any exception as a whole-locale failure (no partial writes).
    """
    system = build_system_prompt(target_locale, tone_entry, do_not_translate)
    user = build_user_prompt_batch(items)
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    if not response.content:
        raise ValueError("Anthropic response.content is empty")
    raw = response.content[0].text
    return parse_json_array_response(raw, expected_n=len(items))


def translate_single_anthropic(
    client: Any,
    text: str,
    target_locale: str,
    tone_entry: dict[str, str],
    do_not_translate: list[str] | None,
) -> str:
    """Single-string Anthropic round-trip. Used during placeholder retries."""
    system = build_system_prompt(target_locale, tone_entry, do_not_translate)
    user = build_user_prompt_single(text)
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    if not response.content:
        raise ValueError("Anthropic response.content is empty")
    return response.content[0].text.strip()


# ---------------------------------------------------------------------------
# Placeholder-aware translation with retry
# ---------------------------------------------------------------------------
def translate_with_placeholder_check(
    client: Any,
    text: str,
    target_locale: str,
    tone_entry: dict[str, str],
    initial_translated: str,
    do_not_translate: list[str] | None,
) -> tuple[str, str | None]:
    """Mirror of translate-i18n.py's same-named helper, Anthropic backend.

    Verify `initial_translated` carries the same placeholder multiset as
    `text`. On mismatch, retry up to 3 single-string Anthropic calls
    with exponential backoff (1s, 2s, 4s). Returns
    `(final_translated, error_message)` where `error_message` is None
    on success.
    """
    if placeholders_match(text, initial_translated):
        return (initial_translated, None)

    expected = extract_placeholders(text)
    last_attempt = initial_translated
    last_actual = extract_placeholders(initial_translated)

    for attempt in range(3):
        time.sleep(2 ** attempt)  # 1s, 2s, 4s — same backoff as Gemma path
        try:
            retry = translate_single_anthropic(
                client, text, target_locale, tone_entry, do_not_translate
            )
        except Exception as e:  # noqa: BLE001 — structured failure surfaced to caller
            return (
                last_attempt,
                f"placeholder retry {attempt + 1}/3 raised {type(e).__name__}: {e}",
            )
        last_attempt = retry
        last_actual = extract_placeholders(retry)
        if last_actual == expected:
            return (retry, None)

    return (
        last_attempt,
        f"placeholder mismatch persists after 3 retries. "
        f"expected={expected} actual={last_actual}",
    )


# ---------------------------------------------------------------------------
# Locale-level translation orchestration
# ---------------------------------------------------------------------------
def translate_locale(
    client: Any,
    target_locale: str,
    en_data: dict,
    target_data: dict,
    tones: dict[str, dict[str, str]],
    force: bool,
    do_not_translate: list[str] | None,
    key_filter: set[str] | None = None,
) -> dict:
    """Translate one locale. Mutates `target_data` in place.

    `key_filter`, when provided, restricts translation to the listed
    dotted-path keys (e.g. {"userProfile.echoesHeading", ...}). All
    other keys are skipped regardless of force / idempotent-fill mode.
    Used by --keys for scoped re-translation (Rule #14 fold-in for
    the brand-term recovery path — re-translates a small subset of
    keys without touching the other ~1240).

    Returns a result dict with the same shape translate-i18n.py uses,
    so the orchestrator in `mode_translate` can be code-shared (well —
    structurally shared; the call site is duplicated here so the
    Anthropic client gets threaded through).
    """
    pending: list[tuple[list, str]] = []
    for path, en_text, tgt_text in collect_pairs(en_data, target_data):
        if key_filter is not None:
            dotted = ".".join(str(p) for p in path)
            if dotted not in key_filter:
                continue
        if force or needs_translation(en_text, tgt_text):
            pending.append((path, en_text))

    if not pending:
        return {"status": "ok", "count": 0, "elapsed_s": 0.0, "skipped": True}

    paths = [p for p, _ in pending]
    texts = [t for _, t in pending]
    tone_entry = tones[target_locale]

    start = time.monotonic()
    try:
        translated = translate_batch_anthropic(
            client, texts, target_locale, tone_entry, do_not_translate
        )
    except Exception as e:  # noqa: BLE001 — any failure reported as-is, no partial write
        return {"status": "failed", "error": f"{type(e).__name__}: {e}", "count": len(texts)}

    elapsed = time.monotonic() - start

    placeholder_failures: list[tuple[list, str]] = []
    for path, src_text, candidate in zip(paths, texts, translated):
        final, err = translate_with_placeholder_check(
            client, src_text, target_locale, tone_entry, candidate, do_not_translate
        )
        if err is not None:
            placeholder_failures.append((path, err))
        set_at_path(target_data, path, final)

    return {
        "status": "ok",
        "count": len(texts),
        "elapsed_s": round(elapsed, 1),
        "placeholder_failures": placeholder_failures,
    }


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------
def mode_check(en_data: dict) -> int:
    """Identical to translate-i18n.py — pure-helper-based, no API call."""
    return _sibling.mode_check(en_data)


def mode_test(
    client: Any,
    tones: dict[str, dict[str, str]],
    do_not_translate: list[str],
) -> int:
    """Translate 3 canonical placeholder-bearing strings into all 19
    sidecar-translated locales, assert placeholder preservation +
    non-empty output. Mirrors translate-i18n.py's mode_test."""
    canonical = [
        ("named-placeholder", "Hello {name}, welcome to Multiverse Echoes."),
        ("jsx-tag", "<strong>Important:</strong> please review your settings."),
        ("printf", "Created %d Echoes today."),
    ]

    failures: list[tuple[str, str, str]] = []
    for locale in SIDECAR_LOCALES:
        tone_entry = tones[locale]
        for label, src in canonical:
            print(f"[{locale:9}] {label:20} ... ", end="", flush=True)
            try:
                translated = translate_single_anthropic(
                    client, src, locale, tone_entry, do_not_translate
                )
            except Exception as e:  # noqa: BLE001
                print(f"FAIL ({type(e).__name__}: {e})")
                failures.append((locale, label, str(e)))
                continue

            if not translated.strip():
                print("FAIL (empty translation)")
                failures.append((locale, label, "empty translation"))
                continue
            if not placeholders_match(src, translated):
                expected = extract_placeholders(src)
                actual = extract_placeholders(translated)
                print(f"FAIL (placeholder drift: expected={expected} actual={actual})")
                failures.append(
                    (locale, label, f"placeholder drift expected={expected} actual={actual}")
                )
                continue
            print("OK")

    if failures:
        print(f"\nFAILURES ({len(failures)}):", file=sys.stderr)
        for locale, label, err in failures:
            print(f"  {locale} [{label}]: {err}", file=sys.stderr)
        return 2
    print(f"\nAll {len(SIDECAR_LOCALES) * len(canonical)} (locale × canonical) pairs translated with placeholder parity.")
    return 0


def mode_translate(
    client: Any,
    tones: dict[str, dict[str, str]],
    do_not_translate: list[str],
    force: bool,
    target_locales: list[str],
    key_filter: set[str] | None = None,
) -> int:
    """Default + --force + --locale + --keys paths. Mirrors
    translate-i18n.py with the addition of `--keys` for scoped
    re-translation."""
    en_data = json.loads(EN_LOCALE.read_text(encoding="utf-8"))

    failures: list[tuple[str, str]] = []
    placeholder_warns: list[tuple[str, list, str]] = []
    total_strings = 0
    total_elapsed = 0.0

    sidecar_targets = [t for t in target_locales if t in SIDECAR_LOCALES]
    derived_targets = [t for t in target_locales if t == "zh-Hant"]

    for locale in sidecar_targets:
        path = LOCALES_DIR / f"{locale}.json"
        if not path.exists():
            print(f"  {locale:9} -> SKIP: locale file {path.name} not found")
            continue
        target_data = json.loads(path.read_text(encoding="utf-8"))

        print(f"  {locale:9} -> ... ", end="", flush=True)
        result = translate_locale(
            client,
            locale,
            en_data,
            target_data,
            tones,
            force=force,
            do_not_translate=do_not_translate,
            key_filter=key_filter,
        )

        if result.get("skipped"):
            print("OK (no pending keys)")
            continue
        if result["status"] != "ok":
            print(f"FAIL: {result['error']}")
            failures.append((locale, result["error"]))
            continue

        write_result = write_locale(locale, target_data)
        if write_result["status"] != "ok":
            print(f"FAIL (write): {write_result['error']}")
            failures.append((locale, write_result["error"]))
            continue

        total_strings += result["count"]
        total_elapsed += result["elapsed_s"]
        for path_, err in result.get("placeholder_failures", []):
            placeholder_warns.append((locale, path_, err))
        print(f"OK ({result['count']} strs, {result['elapsed_s']:>5.1f}s, {write_result['size']:>7} B)")

    # zh-Hant derivation runs after zh-Hans completes — same OpenCC
    # conversion as translate-i18n.py.
    if derived_targets:
        if "zh-Hans" not in target_locales:
            print("  zh-Hant -> SKIP: zh-Hans must be in target_locales for OpenCC derivation")
            failures.append(("zh-Hant", "zh-Hans not translated this run"))
        else:
            print("  zh-Hant   -> ", end="", flush=True)
            result = convert_zh_hant()
            if result["status"] == "ok":
                print(f"OK (OpenCC s2hk, {result['size']} B)")
            else:
                print(f"FAIL: {result['error']}")
                failures.append(("zh-Hant", result["error"]))

    print(f"\nTotal: {total_strings} strings translated in {total_elapsed:.1f}s wall time")
    if placeholder_warns:
        print(f"Placeholder retries that exhausted ({len(placeholder_warns)}):", file=sys.stderr)
        for locale, key_path, err in placeholder_warns:
            print(f"  {locale} {'.'.join(str(p) for p in key_path)}: {err}", file=sys.stderr)
    if failures:
        print(f"\nFAILURES ({len(failures)}):", file=sys.stderr)
        for locale, err in failures:
            print(f"  {locale}: {err}", file=sys.stderr)
        return 2
    return 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    mode_group = ap.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--check",
        action="store_true",
        help="Dry-run; exit non-zero if any locale has English-equal values.",
    )
    mode_group.add_argument(
        "--test",
        action="store_true",
        help="Translate 3 canonical strings × 19 sidecar locales, assert preservation.",
    )
    mode_group.add_argument(
        "--force",
        action="store_true",
        help="Overwrite all non-English values with fresh translations.",
    )
    ap.add_argument(
        "--locale",
        default=None,
        help="Restrict to one target locale (e.g. ja). Default: all 20 non-en.",
    )
    ap.add_argument(
        "--keys",
        default=None,
        help=(
            "Restrict translation to a comma-separated list of dotted-path "
            "keys (e.g. userProfile.echoesHeading,userProfile.foundingEcho). "
            "Combine with --force to retranslate even non-English values "
            "for the listed keys. Used by Lane E Commit 2's brand-term "
            "recovery path to re-translate a small subset under the fixed "
            "do-not-translate adapter without touching ~1240 unaffected keys."
        ),
    )
    ap.add_argument(
        "--verbose",
        action="store_true",
        help="Print tone guidance per locale before translating.",
    )
    args = ap.parse_args()

    tones = load_tone_yaml()
    do_not_translate = flatten_do_not_translate(load_do_not_translate())
    if args.verbose:
        for locale in NON_EN_LOCALES:
            entry = tones[locale]
            print(f"  {locale:9} register={entry['register']:30} variant={entry['dialect_variant']}")
        print(f"  do-not-translate vocabulary: {len(do_not_translate)} terms")

    if args.check:
        # --check is offline (pure-helper-based). No API call.
        en_data = json.loads(EN_LOCALE.read_text(encoding="utf-8"))
        sys.exit(mode_check(en_data))

    # All non-check modes hit the API → enforce key + import.
    _ensure_api_key()
    Anthropic = _import_anthropic()
    client = Anthropic(timeout=SDK_TIMEOUT)

    if args.test:
        sys.exit(mode_test(client, tones, do_not_translate))

    if args.locale is not None:
        if args.locale not in NON_EN_LOCALES:
            print(
                f"FATAL: --locale must be one of {NON_EN_LOCALES}, got {args.locale!r}",
                file=sys.stderr,
            )
            sys.exit(2)
        targets = [args.locale]
    else:
        targets = list(NON_EN_LOCALES)

    key_filter: set[str] | None = None
    if args.keys is not None:
        key_filter = {k.strip() for k in args.keys.split(",") if k.strip()}
        if not key_filter:
            print("FATAL: --keys parsed to empty set", file=sys.stderr)
            sys.exit(2)
        print(f"  key filter active: {len(key_filter)} keys ({sorted(key_filter)[:5]}{'...' if len(key_filter) > 5 else ''})")

    sys.exit(mode_translate(
        client, tones, do_not_translate, args.force, targets, key_filter=key_filter
    ))


if __name__ == "__main__":
    main()
