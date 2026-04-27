#!/usr/bin/env python3
"""Translate UI i18n keys from `client/src/locales/en.json` to per-locale JSONs via the Gemma 4 sidecar.

Runs during B200-on windows only. See docs/runbooks/translation-generation.md.

Reads `client/src/locales/en.json`, calls the translation sidecar at
`TRANSLATION_URL` (default `http://localhost:8200`) once per (locale,
batch-of-keys) pair using `/translate/batch`, writes per-locale outputs
to `client/src/locales/{locale}.json`.

Preserves the nested object structure of `en.json` and the placeholder
inventory of every translatable string (`{name}` named placeholders,
`<Tag>` JSX tags, `%s` / `%d` printf tokens). Translation results that
fail placeholder-count parity are retried up to 3 times with exponential
backoff before being logged and skipped.

zh-Hant is NOT translated by the sidecar directly; it is derived from
the zh-Hans output via OpenCC s2hk in a second pass after zh-Hans
completes. Same pattern as `translate-legal.py`.

Modes:

    --check          Dry-run. Exit non-zero if any non-English locale has
                     values still equal to the English source (i.e. an
                     unfilled placeholder slot from Commit 2 onwards).
                     Reaches the sidecar's `/health` endpoint anyway, so
                     a tunnel is required even for --check.

    --force          Overwrite all non-English values with fresh
                     translations regardless of current state.

    --locale CODE    Restrict to a single target locale.

    --test           Translate 3 canonical strings (with placeholder
                     tokens) into all 20 non-English locales, assert
                     placeholder preservation + non-empty output, exit
                     non-zero on any failure. Real locale files are
                     untouched.

    no flag (default)
                     Idempotent fill. For each (locale, key), translate
                     only when the target value equals the English
                     source — i.e. replace the English placeholder a
                     parity-satisfying commit left behind. Existing
                     translations are skipped.

Usage:

    python client/scripts/translate-i18n.py
    python client/scripts/translate-i18n.py --force
    python client/scripts/translate-i18n.py --locale ja
    python client/scripts/translate-i18n.py --check
    python client/scripts/translate-i18n.py --test
    TRANSLATION_URL=http://localhost:8200 python client/scripts/translate-i18n.py

Exit codes:

    0  all (locale, key) pairs translated (or already filled)
    1  sidecar unreachable at startup
    2  one or more (locale, key) pairs failed (details printed)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import yaml  # type: ignore[import-untyped]

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "src" / "locales"
EN_LOCALE = LOCALES_DIR / "en.json"
TONE_YAML = Path(__file__).resolve().parent / "i18n-tone.yaml"

# Locales the sidecar translates directly. zh-Hant is derived from
# zh-Hans via OpenCC s2hk (matches translate-legal.py).
SIDECAR_LOCALES: list[str] = [
    "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt-BR", "ru", "ur",
    "id", "de", "ja", "vi", "tr", "ko", "tl", "it", "th", "ms",
]

# All 20 non-English locales. MUST match `NON_EN_LOCALES` in
# `client/scripts/check-i18n-keys.js` exactly — drift would let
# parity-passing keys ship without a translation slot. Asserted by
# `test_translate_i18n.py::test_locale_lists_match_check_i18n_keys`.
NON_EN_LOCALES: list[str] = SIDECAR_LOCALES + ["zh-Hant"]

TRANSLATION_URL = os.environ.get("TRANSLATION_URL", "http://localhost:8200")

# Per-batch request timeout. Locale bundles can carry 1k+ keys; Gemma on
# vLLM usually completes each string in 1-3 s. 600 s budget is generous
# headroom for the largest expected bundle.
BATCH_TIMEOUT = 600.0

# Health probe timeout — fast fail when the SSH tunnel is not open.
HEALTH_TIMEOUT = 10.0

# Content-type passed to the sidecar. The sidecar's `_build_prompt`
# treats anything outside its hardcoded set (`diary`, `life_event`,
# `conversation`, `oracle`) as the default UI prompt — exactly what
# UI strings need.
CONTENT_TYPE = "ui_string"


SSH_TUNNEL_HINT = (
    "Open the SSH tunnel to the B200 and retry. Step-by-step in "
    "client/scripts/README.md. As of 2026-04-24:\n"
    "    vastai show instance 34370817 | grep -E 'ssh_host|ssh_port'\n"
    "    ssh -L 8200:localhost:8200 -N -f root@<ssh_host> -p <ssh_port> "
    "-i ~/.ssh/vastai_key\n"
    "    curl -sf http://localhost:8200/health"
)


# ---------------------------------------------------------------------------
# Placeholder extraction
# ---------------------------------------------------------------------------
# Three placeholder forms appear in the UI bundles:
#
#   {name}      i18next-style named interpolation. Most common form.
#               `[a-zA-Z_][a-zA-Z0-9_]*` keeps us out of CSS-in-JS
#               numeric-key edge cases.
#   <Tag> </Tag>  JSX inline tags for in-string formatting (Trans
#               component children). Must round-trip with the same set
#               of opening/closing markers; the regex captures the raw
#               tag text including angle brackets.
#   %s %d %i %f   printf-style tokens used by a small number of
#               legacy strings. Order- and count-sensitive.
#
# Compiled once at module load. Mismatch detection compares sorted
# match lists (order-independent for {name} / <Tag>; relies on the
# multiset for repeated tokens like "%s and %s").
_PH_BRACE = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")
_PH_TAG = re.compile(r"</?[a-zA-Z][a-zA-Z0-9]*>")
_PH_PRINTF = re.compile(r"%[sdif]")


def extract_placeholders(text: str) -> list[str]:
    """Return every placeholder token in `text`, sorted ascending.

    Sorting makes `extract_placeholders(en) == extract_placeholders(out)`
    a multiset comparison — two strings carrying the same placeholder
    inventory in any order match. Repeated placeholders (e.g. `%s ... %s`)
    are preserved in the result list, so a translation that drops one
    of two `%s` tokens still fails the comparison.
    """
    matches: list[str] = []
    matches.extend(_PH_BRACE.findall(text))
    matches.extend(_PH_TAG.findall(text))
    matches.extend(_PH_PRINTF.findall(text))
    return sorted(matches)


def placeholders_match(source: str, translated: str) -> bool:
    """True when `source` and `translated` carry the same placeholder multiset."""
    return extract_placeholders(source) == extract_placeholders(translated)


# ---------------------------------------------------------------------------
# Tone YAML loading + validation
# ---------------------------------------------------------------------------
TONE_REQUIRED_FIELDS = ("locale", "register", "dialect_variant", "notes")


def load_tone_yaml(path: Path = TONE_YAML) -> dict[str, dict[str, str]]:
    """Read i18n-tone.yaml. Schema-validates against the 21-locale set.

    Currently the result is loaded for verbose-mode logging only; no
    sidecar request body carries these values (sidecar API does not
    accept tone fields — see file header for the rationale). Validation
    runs anyway so a malformed YAML or missing locale entry is caught
    at script start, not silently ignored.
    """
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    if not isinstance(data, dict):
        raise ValueError(f"i18n-tone.yaml must parse to a top-level dict, got {type(data).__name__}")

    expected = {"en", *NON_EN_LOCALES}
    actual = set(data.keys())
    missing = expected - actual
    extra = actual - expected
    if missing or extra:
        raise ValueError(
            f"i18n-tone.yaml locale set out of sync. "
            f"missing={sorted(missing)} extra={sorted(extra)}"
        )

    for locale, entry in data.items():
        if not isinstance(entry, dict):
            raise ValueError(f"i18n-tone.yaml entry for '{locale}' must be a dict")
        for field in TONE_REQUIRED_FIELDS:
            if field not in entry:
                raise ValueError(f"i18n-tone.yaml entry for '{locale}' missing field '{field}'")
            if not isinstance(entry[field], str):
                raise ValueError(
                    f"i18n-tone.yaml entry for '{locale}' field '{field}' must be a string"
                )
        if entry["locale"] != locale:
            raise ValueError(
                f"i18n-tone.yaml entry key '{locale}' does not match its 'locale' field "
                f"'{entry['locale']}'"
            )

    return data


# ---------------------------------------------------------------------------
# JSON tree walking
# ---------------------------------------------------------------------------
def collect_pairs(
    en_obj: Any,
    target_obj: Any,
    path: list | None = None,
):
    """Yield `(path, en_text, target_text_or_None)` for every leaf string in `en_obj`.

    `target_obj` is the parallel locale tree (or None if missing). When
    the target tree is missing a key or the value at the key isn't a
    string, the third tuple element is `None` — the caller treats that
    as "needs translation".
    """
    if path is None:
        path = []
    if isinstance(en_obj, dict):
        for k, v in en_obj.items():
            tv = target_obj.get(k) if isinstance(target_obj, dict) else None
            yield from collect_pairs(v, tv, path + [k])
    elif isinstance(en_obj, list):
        for i, v in enumerate(en_obj):
            tv = target_obj[i] if isinstance(target_obj, list) and i < len(target_obj) else None
            yield from collect_pairs(v, tv, path + [i])
    elif isinstance(en_obj, str):
        yield (path, en_obj, target_obj if isinstance(target_obj, str) else None)


def set_at_path(obj: Any, path: list, value: Any) -> None:
    """Walk `obj` along `path` and set the leaf to `value`. Path must exist."""
    for p in path[:-1]:
        obj = obj[p]
    obj[path[-1]] = value


def needs_translation(en_text: str, target_text: str | None) -> bool:
    """Idempotent-fill predicate: target needs a translation when it is missing
    or still carries the English source verbatim."""
    return target_text is None or target_text == en_text


# ---------------------------------------------------------------------------
# Sidecar transport
# ---------------------------------------------------------------------------
def translate_batch(
    items: list[str],
    target_locale: str,
    content_type: str = CONTENT_TYPE,
) -> list[str]:
    """Call /translate/batch with `items`, return list of translated strings."""
    payload = {
        "items": [
            {
                "text": t,
                "source_locale": "en",
                "target_locale": target_locale,
                "content_type": content_type,
            }
            for t in items
        ]
    }
    with httpx.Client(timeout=BATCH_TIMEOUT) as client:
        r = client.post(f"{TRANSLATION_URL}/translate/batch", json=payload)
        r.raise_for_status()
        data = r.json()
    return [item["translated_text"] for item in data["results"]]


def translate_single(text: str, target_locale: str, content_type: str = CONTENT_TYPE) -> str:
    """Single-string translate via /translate. Used during placeholder retries."""
    payload = {
        "text": text,
        "source_locale": "en",
        "target_locale": target_locale,
        "content_type": content_type,
    }
    with httpx.Client(timeout=BATCH_TIMEOUT) as client:
        r = client.post(f"{TRANSLATION_URL}/translate", json=payload)
        r.raise_for_status()
        return r.json()["translated_text"]


def health_probe(url: str = TRANSLATION_URL) -> None:
    """Confirm the sidecar is reachable. Exits with code 1 + tunnel hint on failure."""
    try:
        with httpx.Client(timeout=HEALTH_TIMEOUT) as client:
            r = client.get(f"{url}/health")
            r.raise_for_status()
            info = r.json()
            print(
                f"Sidecar @ {url}: model={info.get('model')} "
                f"model_loaded={info.get('model_loaded')}"
            )
    except Exception as e:  # noqa: BLE001 — surface any failure to the operator
        print(f"FATAL: translation sidecar unreachable at {url}: {e}", file=sys.stderr)
        print(f"\n{SSH_TUNNEL_HINT}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Placeholder-aware translation with retry
# ---------------------------------------------------------------------------
def translate_with_placeholder_check(
    text: str,
    target_locale: str,
    initial_translated: str,
) -> tuple[str, str | None]:
    """Verify `initial_translated` has the same placeholder multiset as `text`.

    On mismatch, retry up to 3 single-string calls with exponential
    backoff (1s, 2s, 4s). Returns `(final_translated, error_message)`
    where `error_message` is None on success, populated on exhaustion.
    The returned string is always a candidate translation (for caller
    use even on failure-with-best-effort).
    """
    if placeholders_match(text, initial_translated):
        return (initial_translated, None)

    expected = extract_placeholders(text)
    last_attempt = initial_translated
    last_actual = extract_placeholders(initial_translated)

    for attempt in range(3):
        time.sleep(2 ** attempt)  # 1s, 2s, 4s
        try:
            retry = translate_single(text, target_locale)
        except Exception as e:  # noqa: BLE001 — retry path; structured failure
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
    target_locale: str,
    en_data: dict,
    target_data: dict,
    force: bool,
) -> dict:
    """Translate one locale. Mutates `target_data` in place."""
    # Identify pairs that need translation under the active mode.
    pending: list[tuple[list, str]] = []
    for path, en_text, tgt_text in collect_pairs(en_data, target_data):
        if force or needs_translation(en_text, tgt_text):
            pending.append((path, en_text))

    if not pending:
        return {"status": "ok", "count": 0, "elapsed_s": 0.0, "skipped": True}

    paths = [p for p, _ in pending]
    texts = [t for _, t in pending]

    start = time.monotonic()
    try:
        translated = translate_batch(texts, target_locale)
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:200] if e.response is not None else ""
        return {
            "status": "failed",
            "error": f"HTTP {e.response.status_code}: {detail}",
            "count": len(texts),
        }
    except Exception as e:  # noqa: BLE001 — any failure reported as-is
        return {"status": "failed", "error": f"{type(e).__name__}: {e}", "count": len(texts)}

    elapsed = time.monotonic() - start

    if len(translated) != len(texts):
        return {
            "status": "failed",
            "error": f"count mismatch: sent {len(texts)}, got {len(translated)}",
            "count": len(texts),
        }

    placeholder_failures: list[tuple[list, str]] = []
    for path, src_text, candidate in zip(paths, texts, translated):
        final, err = translate_with_placeholder_check(src_text, target_locale, candidate)
        if err is not None:
            placeholder_failures.append((path, err))
        set_at_path(target_data, path, final)

    return {
        "status": "ok",
        "count": len(texts),
        "elapsed_s": round(elapsed, 1),
        "placeholder_failures": placeholder_failures,
    }


def write_locale(target_locale: str, target_data: dict) -> dict:
    """Atomic-enough write with Windows-Defender retry (matches translate-legal.py).

    Python 3.13 + Windows + Defender has a transient write race: after
    a file is created, Defender queues a scan on it; a subsequent write
    in the same directory can hit `CreateFileW` mid-scan and return
    `ERROR_FILE_NOT_FOUND` rather than the more typical
    `ERROR_SHARING_VIOLATION`. Python maps this to FileNotFoundError.
    Observed rate: ~1/60 writes. Retry with linear backoff lets the scan
    window pass.
    """
    dst_path = LOCALES_DIR / f"{target_locale}.json"
    payload = json.dumps(target_data, ensure_ascii=False, indent=2) + "\n"
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            dst_path.write_text(payload, encoding="utf-8", newline="\n")
            return {"status": "ok", "size": dst_path.stat().st_size}
        except (FileNotFoundError, PermissionError, OSError) as err:
            last_err = err
            if attempt < 3:
                time.sleep(0.1 * (attempt + 1))  # 100ms, 200ms, 300ms
    return {
        "status": "failed",
        "error": f"write_text retries exhausted: {type(last_err).__name__}: {last_err}",
    }


def convert_zh_hant() -> dict:
    """Generate zh-Hant.json from zh-Hans.json via OpenCC s2hk.

    Matches the approach used for legal docs and `client/src/locales/zh-Hant.json`:
    character-level Simplified -> Hong Kong Traditional conversion. Run
    AFTER zh-Hans.json has been written by the sidecar pass.
    """
    try:
        from opencc import OpenCC
    except ImportError:
        return {"status": "failed", "error": "opencc-python-reimplemented not installed"}

    src_path = LOCALES_DIR / "zh-Hans.json"
    if not src_path.exists():
        return {
            "status": "failed",
            "error": f"{src_path.name} not found — zh-Hans translation must complete first",
        }

    cc = OpenCC("s2hk")
    src = json.loads(src_path.read_text(encoding="utf-8"))

    def walk(o: Any) -> Any:
        if isinstance(o, dict):
            return {k: walk(v) for k, v in o.items()}
        if isinstance(o, list):
            return [walk(x) for x in o]
        if isinstance(o, str):
            return cc.convert(o)
        return o

    dst = walk(src)
    write_result = write_locale("zh-Hant", dst)
    if write_result["status"] != "ok":
        return write_result
    return {"status": "ok", "size": write_result["size"]}


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------
def mode_check(en_data: dict) -> int:
    """Dry-run. Exit non-zero if any non-English locale carries values
    still equal to the English source (i.e. unfilled placeholder slots)."""
    failed = False
    for locale in NON_EN_LOCALES:
        path = LOCALES_DIR / f"{locale}.json"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            print(f"  {locale}: MISSING locale file {path.name}", file=sys.stderr)
            failed = True
            continue

        unfilled = sum(
            1 for _, en_text, tgt_text in collect_pairs(en_data, data)
            if needs_translation(en_text, tgt_text)
        )
        if unfilled > 0:
            print(f"  {locale}: {unfilled} keys still equal to English (need translation)")
            failed = True
        else:
            print(f"  {locale}: all keys translated")

    return 2 if failed else 0


def mode_test() -> int:
    """Translate 3 canonical placeholder-bearing strings into all 20 non-en
    locales, assert placeholder preservation + non-empty output."""
    canonical = [
        ("named-placeholder", "Hello {name}, welcome to Multiverse Echoes."),
        ("jsx-tag", "<strong>Important:</strong> please review your settings."),
        ("printf", "Created %d Echoes today."),
    ]

    failures: list[tuple[str, str, str]] = []
    for locale in SIDECAR_LOCALES:
        for label, src in canonical:
            print(f"[{locale:9}] {label:20} ... ", end="", flush=True)
            try:
                translated = translate_single(src, locale)
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
    print("\nAll 60 (locale × canonical) pairs translated with placeholder parity.")
    return 0


def mode_translate(force: bool, target_locales: list[str]) -> int:
    """Default + --force + --locale paths. Translate locales in `target_locales`."""
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
        result = translate_locale(locale, en_data, target_data, force=force)

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

    # zh-Hant derivation runs after zh-Hans completes.
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
        help="Translate 3 canonical strings × 20 locales, assert preservation.",
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
        "--verbose",
        action="store_true",
        help="Print tone guidance per locale before translating.",
    )
    args = ap.parse_args()

    # Load + validate the tone YAML at startup so a broken table is
    # caught here instead of mid-run.
    tones = load_tone_yaml()
    if args.verbose:
        for locale in NON_EN_LOCALES:
            entry = tones[locale]
            print(f"  {locale:9} register={entry['register']:30} variant={entry['dialect_variant']}")

    if args.check:
        # Even --check probes the sidecar so a misconfigured tunnel
        # surfaces early, but it never sends a translate request.
        health_probe()
        en_data = json.loads(EN_LOCALE.read_text(encoding="utf-8"))
        sys.exit(mode_check(en_data))

    if args.test:
        health_probe()
        sys.exit(mode_test())

    health_probe()

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

    sys.exit(mode_translate(args.force, targets))


if __name__ == "__main__":
    main()
