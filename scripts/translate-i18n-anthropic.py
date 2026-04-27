#!/usr/bin/env python3
"""Translate `client/src/locales/en.json` placeholders to per-locale JSONs
via the Anthropic Messages API.

Idempotent-fill semantics: for each non-English locale, collect every
flattened (key, value) pair where the value is byte-identical to the
English source — that's the convention the Lane E Commit 1b
`translate-i18n.py` (Gemma sidecar variant) used to mark
"needs-translation" rows, and the convention this script honours so the
two pipelines remain interchangeable. Existing translated values are
left untouched. zh-Hant is NOT translated directly; it's derived from
the zh-Hans output via OpenCC `s2hk` in a second pass after zh-Hans
completes (matches the convention used for the legal-document
translator and the original i18n translator).

One Anthropic API call per non-en locale: all needs-translation keys
for that locale are sent in a single message as a JSON object; the
model is asked to return a JSON object with the same keys whose values
are the translations. i18next interpolation placeholders (`{{key}}`)
must round-trip verbatim — the system prompt pins this contract.

Usage:
    export $(grep -E "^ANTHROPIC_API_KEY=" ../multiverse-echoes/.env | head -1 | xargs)
    python client/scripts/translate-i18n-anthropic.py
    python client/scripts/translate-i18n-anthropic.py --locale es,fr
    python client/scripts/translate-i18n-anthropic.py --check    # dry-run
    python client/scripts/translate-i18n-anthropic.py --force    # overwrite all non-en values

Exit codes:
    0  all locales processed (or nothing to do under --check)
    1  ANTHROPIC_API_KEY missing
    2  one or more locales failed (details printed)
    3  --check found at least one locale with placeholder values still equal to English
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "src" / "locales"
EN_PATH = LOCALES_DIR / "en.json"

# 19 locales the model translates directly. zh-Hant (20th) is derived
# from zh-Hans via OpenCC s2hk in a second pass — same convention as
# `translate-legal.py` and the original `translate-i18n.py`.
DIRECT_LOCALES = [
    "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt-BR", "ru", "ur",
    "id", "de", "ja", "vi", "tr", "ko", "tl", "it", "th", "ms",
]

# Anthropic Messages API endpoint + headers.
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
# Haiku-4.5 is the right tier for short UI strings — millisecond
# latency, low cost, strong instruction-following on JSON-output
# tasks per Anthropic Knowledge cutoff January 2026.
MODEL = "claude-haiku-4-5-20251001"

# Anthropic per-call wall-clock budget. Each call sends ~30 short UI
# strings; Haiku typically returns the full JSON in <5 s. 120 s gives
# generous headroom for cold-start + retries.
REQUEST_TIMEOUT = 120.0

# i18next interpolation placeholders. Tested against the actual key set
# for early-warning when a translated string drops a placeholder.
PLACEHOLDER_RE = re.compile(r"\{\{[a-zA-Z0-9_]+\}\}")

# Locale → human-readable name for the system prompt. Kept inline so
# the script has zero non-stdlib + httpx dependencies.
LOCALE_NAMES = {
    "zh-Hans": "Simplified Chinese (zh-Hans)",
    "hi": "Hindi",
    "es": "Spanish",
    "ar": "Arabic",
    "fr": "French",
    "bn": "Bengali",
    "pt-BR": "Brazilian Portuguese",
    "ru": "Russian",
    "ur": "Urdu",
    "id": "Indonesian",
    "de": "German",
    "ja": "Japanese",
    "vi": "Vietnamese",
    "tr": "Turkish",
    "ko": "Korean",
    "tl": "Filipino (Tagalog)",
    "it": "Italian",
    "th": "Thai",
    "ms": "Malay",
}


def flatten(obj: Any, prefix: str = "") -> dict[str, Any]:
    """Flatten nested dict to dot-notation keys; non-string leaves dropped
    (en.json contains only strings at the leaves today, but this is
    defense-in-depth for the future)."""
    out: dict[str, Any] = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            full = f"{prefix}.{k}" if prefix else k
            out.update(flatten(v, full))
    elif isinstance(obj, str):
        out[prefix] = obj
    # Other scalar types (int/bool/None) are not translatable; skip.
    return out


def set_at_path(obj: Any, dotted_key: str, value: Any) -> None:
    """Write `value` into the nested dict at the dot-notation key.
    Intermediate dicts must exist (we only ever write into keys that
    were already present in the locale bundle, since the scaffold step
    runs before us — same precondition the Gemma-sidecar translator
    relies on)."""
    parts = dotted_key.split(".")
    cur = obj
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def find_needs_translation(
    en_flat: dict[str, str],
    locale_flat: dict[str, str],
    *,
    force: bool,
) -> dict[str, str]:
    """Return the subset of (key, en_value) pairs where the locale's
    current value equals the English source — i.e. placeholders or
    untranslated rows. With --force, return all keys regardless."""
    needs: dict[str, str] = {}
    for key, en_value in en_flat.items():
        if force:
            needs[key] = en_value
        elif key not in locale_flat:
            # Should be impossible after the scaffold step, but defend.
            needs[key] = en_value
        elif locale_flat[key] == en_value:
            needs[key] = en_value
    return needs


def required_placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(text))


def translate_locale(
    api_key: str,
    locale: str,
    needs: dict[str, str],
) -> dict[str, str]:
    """Single-call translation of all needs-translation keys for one
    locale. Returns the translated dict; raises RuntimeError on
    placeholder-preservation failures."""
    if not needs:
        return {}

    locale_name = LOCALE_NAMES.get(locale, locale)
    system_prompt = (
        f"You translate UI strings from English to {locale_name} for a "
        "consumer web product called Multiverse Echoes (an autonomous "
        "AI life-simulation platform). The strings are admin-dashboard "
        "UI copy.\n\n"
        "Rules:\n"
        "1. Preserve every i18next interpolation placeholder of the "
        "form {{key}} verbatim — do NOT translate the placeholder name "
        "and do NOT remove the braces.\n"
        "2. Preserve markdown-inline formatting if present "
        "(**bold**, [text](url), `code`).\n"
        "3. Translate idiomatically for a software product, not "
        "literally — short, clear, action-oriented copy.\n"
        "4. Respond with a single JSON object whose keys are the "
        "exact English keys you were given and whose values are the "
        f"translations into {locale_name}. No commentary, no markdown "
        "fence, no extra keys."
    )

    user_message = (
        "Translate the values of this JSON object. Return a JSON object "
        "with the same keys.\n\n"
        f"{json.dumps(needs, ensure_ascii=False, indent=2)}"
    )

    body = {
        "model": MODEL,
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }

    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        resp = client.post(ANTHROPIC_URL, headers=headers, json=body)
    if resp.status_code != 200:
        raise RuntimeError(
            f"Anthropic API HTTP {resp.status_code} for {locale}: "
            f"{resp.text[:400]}"
        )

    data = resp.json()
    content_blocks = data.get("content") or []
    if not content_blocks:
        raise RuntimeError(f"Anthropic returned no content for {locale}")
    text = "".join(
        b.get("text", "")
        for b in content_blocks
        if b.get("type") == "text"
    ).strip()

    # Some models wrap JSON in a ```json fence. Strip if present.
    if text.startswith("```"):
        # Remove leading fence line + trailing fence line.
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines)

    try:
        translated = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            f"Anthropic returned non-JSON content for {locale}: "
            f"{e}; first 400 chars: {text[:400]!r}"
        ) from e

    if not isinstance(translated, dict):
        raise RuntimeError(
            f"Anthropic returned non-object JSON for {locale}: "
            f"{type(translated).__name__}"
        )

    # Validate: every input key present in output, placeholders
    # preserved.
    missing_keys = sorted(set(needs.keys()) - set(translated.keys()))
    if missing_keys:
        raise RuntimeError(
            f"{locale}: model dropped {len(missing_keys)} keys; "
            f"first 5: {missing_keys[:5]}"
        )

    placeholder_violations: list[str] = []
    for key, en_value in needs.items():
        expected = required_placeholders(en_value)
        got = required_placeholders(str(translated[key]))
        if expected != got:
            placeholder_violations.append(
                f"{key}: expected {sorted(expected)}, got {sorted(got)}"
            )
    if placeholder_violations:
        raise RuntimeError(
            f"{locale}: {len(placeholder_violations)} placeholder "
            f"violations; first 3: {placeholder_violations[:3]}"
        )

    return {k: str(v) for k, v in translated.items()}


def derive_zh_hant_from_zh_hans(needs: dict[str, str]) -> dict[str, str] | None:
    """Convert zh-Hans translations to zh-Hant (Hong Kong) via OpenCC
    s2hk. Returns None if opencc is not installed (caller falls back
    to leaving placeholders, which the next pipeline run can fill).
    Mirrors the precedent in translate-legal.py."""
    try:
        from opencc import OpenCC  # type: ignore
    except ImportError:
        return None
    cc = OpenCC("s2hk")
    return {k: cc.convert(v) for k, v in needs.items()}


def process_locale(
    api_key: str,
    locale: str,
    en_flat: dict[str, str],
    *,
    force: bool,
    check_only: bool,
) -> tuple[bool, int, str]:
    """Returns (changed, translated_count, message)."""
    path = LOCALES_DIR / f"{locale}.json"
    bundle = json.loads(path.read_text(encoding="utf-8"))
    locale_flat = flatten(bundle)
    needs = find_needs_translation(en_flat, locale_flat, force=force)
    if not needs:
        return (False, 0, f"{locale}: nothing to translate")

    if check_only:
        sample = ", ".join(list(needs.keys())[:3])
        return (
            True,
            len(needs),
            f"{locale}: {len(needs)} placeholder values "
            f"(sample: {sample}…)",
        )

    if locale == "zh-Hant":
        # zh-Hant is derived from zh-Hans, not translated directly.
        # Caller orchestrates the order so zh-Hans is processed first.
        zh_hans_path = LOCALES_DIR / "zh-Hans.json"
        zh_hans_bundle = json.loads(zh_hans_path.read_text(encoding="utf-8"))
        zh_hans_flat = flatten(zh_hans_bundle)
        zh_hans_needs = {k: zh_hans_flat[k] for k in needs.keys() if k in zh_hans_flat}
        derived = derive_zh_hant_from_zh_hans(zh_hans_needs)
        if derived is None:
            return (
                False,
                0,
                f"{locale}: opencc not installed — skipping derivation",
            )
        translated = derived
    else:
        translated = translate_locale(api_key, locale, needs)

    for key, value in translated.items():
        set_at_path(bundle, key, value)
    path.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return (True, len(translated), f"{locale}: translated {len(translated)} keys")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Translate placeholder i18n strings via Anthropic API."
    )
    parser.add_argument(
        "--locale",
        help="Comma-separated subset of target locales (default: all).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Dry-run: report locales with placeholder values; exit 3 if any.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite all non-en values regardless of placeholder check.",
    )
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not args.check and not api_key:
        print(
            "ERROR: ANTHROPIC_API_KEY not set. "
            "Run: export $(grep -E '^ANTHROPIC_API_KEY=' "
            "../multiverse-echoes/.env | head -1 | xargs)",
            file=sys.stderr,
        )
        return 1

    en_bundle = json.loads(EN_PATH.read_text(encoding="utf-8"))
    en_flat = flatten(en_bundle)
    print(f"Source: {len(en_flat)} keys in en.json")

    target_locales = (
        [s.strip() for s in args.locale.split(",")]
        if args.locale
        else DIRECT_LOCALES + ["zh-Hant"]
    )

    failures: list[str] = []
    any_pending = False
    for locale in target_locales:
        try:
            changed, count, message = process_locale(
                api_key,
                locale,
                en_flat,
                force=args.force,
                check_only=args.check,
            )
            print(f"  {message}")
            if args.check and changed:
                any_pending = True
        except Exception as e:  # noqa: BLE001 — surface anything
            failures.append(f"{locale}: {e}")
            print(f"  {locale}: FAILED — {e}", file=sys.stderr)

    if failures:
        print(f"\n{len(failures)} locale(s) failed.", file=sys.stderr)
        return 2
    if args.check and any_pending:
        print("\nPending translations exist — run without --check to fill.")
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
