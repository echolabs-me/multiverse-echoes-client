#!/usr/bin/env python3
"""Translate English legal JSONs to per-locale JSONs via the Gemma 4 sidecar.

Reads `client/src/content/legal/{doc}.en.json`, calls the translation
sidecar at `TRANSLATION_URL` (default `http://localhost:8200`) once per
(doc, locale) pair using `/translate/batch`, writes per-locale outputs
to `client/src/content/legal/{doc}.{locale}.json`.

Preserves schema (sections, blocks) and markdown-inline formatting
(`**bold**`, `[text](url)`). Gemma 4 was validated to preserve both
across ES, JA, AR (incl. RTL) prior to writing this script.

zh-Hant is NOT translated by the sidecar (only 19 non-en locales
supported); it's derived from the zh-Hans output via OpenCC s2hk in a
second pass after zh-Hans completes. Matches the approach used for
`client/src/locales/zh-Hant.json`.

Usage:
    python client/scripts/translate-legal.py
    python client/scripts/translate-legal.py --docs terms,privacy
    python client/scripts/translate-legal.py --locales es,ja,ar --docs terms
    TRANSLATION_URL=http://localhost:8200 python client/scripts/translate-legal.py

Exit codes:
    0  all (doc, locale) pairs translated
    1  sidecar unreachable at startup
    2  one or more (doc, locale) pairs failed (details printed)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "src" / "content" / "legal"
DOCS = ["terms", "privacy", "accessibility"]

# 19 locales supported by the current sidecar LOCALE_TO_LANGUAGE map.
# zh-Hant (20th) is derived from zh-Hans via OpenCC s2hk (see below).
SIDECAR_LOCALES = [
    "zh-Hans", "hi", "es", "ar", "fr", "bn", "pt-BR", "ru", "ur",
    "id", "de", "ja", "vi", "tr", "ko", "tl", "it", "th", "ms",
]

TRANSLATION_URL = os.environ.get("TRANSLATION_URL", "http://localhost:8200")

# Per-batch request timeout. Legal docs ~30 strings; Gemma on vLLM usually
# completes each string in 1-3 s. 300 s budget is generous headroom.
BATCH_TIMEOUT = 300.0


def collect_strings(obj: Any, path: list | None = None):
    """Yield `(path, text)` for every translatable string in the JSON tree.

    Skip schema discriminators (`type` keys) and non-string scalars.
    Path is a list of dict keys and list indices showing where the string
    lives so the translated value can be written back to the same slot.
    """
    if path is None:
        path = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "type":  # block type discriminator — never translate
                continue
            yield from collect_strings(v, path + [k])
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from collect_strings(v, path + [i])
    elif isinstance(obj, str):
        yield (path, obj)


def set_at_path(obj: Any, path: list, value: Any) -> None:
    for p in path[:-1]:
        obj = obj[p]
    obj[path[-1]] = value


def translate_batch(items: list[str], target_locale: str) -> list[str]:
    """Call /translate/batch with items, return list of translated strings.
    content_type="legal_document" is a prompt hint — the current sidecar
    treats unknown content_types with the default prompt, which preserves
    markdown-inline syntax correctly per pre-run validation."""
    payload = {
        "items": [
            {
                "text": t,
                "source_locale": "en",
                "target_locale": target_locale,
                "content_type": "legal_document",
            }
            for t in items
        ]
    }
    with httpx.Client(timeout=BATCH_TIMEOUT) as client:
        r = client.post(f"{TRANSLATION_URL}/translate/batch", json=payload)
        r.raise_for_status()
        data = r.json()
    return [item["translated_text"] for item in data["results"]]


def translate_doc(doc_name: str, target_locale: str) -> dict:
    src_path = CONTENT_DIR / f"{doc_name}.en.json"
    # Re-read from disk rather than deep-copying so the translation output
    # starts from an untouched English structure every call.
    src = json.loads(src_path.read_text(encoding="utf-8"))
    dst = json.loads(src_path.read_text(encoding="utf-8"))

    pairs = list(collect_strings(src))
    paths = [p for p, _ in pairs]
    texts = [t for _, t in pairs]

    start = time.monotonic()
    try:
        translated = translate_batch(texts, target_locale)
    except httpx.HTTPStatusError as e:
        detail = e.response.text[:200] if hasattr(e, "response") else ""
        return {"status": "failed", "error": f"HTTP {e.response.status_code}: {detail}", "count": len(texts)}
    except Exception as e:  # noqa: BLE001 — any failure is reported as-is
        return {"status": "failed", "error": f"{type(e).__name__}: {e}", "count": len(texts)}

    elapsed = time.monotonic() - start

    if len(translated) != len(texts):
        return {
            "status": "failed",
            "error": f"count mismatch: sent {len(texts)}, got {len(translated)}",
            "count": len(texts),
        }

    for path, t in zip(paths, translated):
        set_at_path(dst, path, t)

    dst_path = CONTENT_DIR / f"{doc_name}.{target_locale}.json"
    payload = json.dumps(dst, ensure_ascii=False, indent=2) + "\n"

    # Python 3.13 + Windows + Defender has a transient write race: after a
    # file is created, Defender queues a scan on it; a subsequent write in
    # the same directory can hit CreateFileW mid-scan and return
    # ERROR_FILE_NOT_FOUND rather than the more typical
    # ERROR_SHARING_VIOLATION. Python maps this to FileNotFoundError.
    # Observed rate on this machine: ~1/60 writes. Retry with a short
    # backoff lets the scan window pass; the overall batch must NOT fail
    # catastrophically on a single transient I/O hiccup.
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            dst_path.write_text(payload, encoding="utf-8", newline="\n")
            last_err = None
            break
        except (FileNotFoundError, PermissionError, OSError) as err:
            last_err = err
            if attempt < 3:
                time.sleep(0.1 * (attempt + 1))  # 100ms, 200ms, 300ms
    if last_err is not None:
        return {
            "status": "failed",
            "error": f"write_text retries exhausted: {type(last_err).__name__}: {last_err}",
            "count": len(texts),
        }

    return {
        "status": "ok",
        "count": len(texts),
        "elapsed_s": round(elapsed, 1),
        "size": dst_path.stat().st_size,
    }


def convert_zh_hant(doc_name: str) -> dict:
    """Generate zh-Hant output from zh-Hans via OpenCC s2hk.
    Matches the approach used for `client/src/locales/zh-Hant.json`:
    character-level Simplified → Hong Kong Traditional conversion.
    """
    try:
        from opencc import OpenCC
    except ImportError:
        return {"status": "failed", "error": "opencc-python-reimplemented not installed"}

    src_path = CONTENT_DIR / f"{doc_name}.zh-Hans.json"
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
    dst_path = CONTENT_DIR / f"{doc_name}.zh-Hant.json"
    dst_path.write_text(
        json.dumps(dst, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {"status": "ok", "size": dst_path.stat().st_size}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--docs", default=",".join(DOCS), help="Comma-separated docs")
    ap.add_argument("--locales", default=",".join(SIDECAR_LOCALES), help="Comma-separated target locales")
    args = ap.parse_args()

    docs = [d.strip() for d in args.docs.split(",") if d.strip()]
    locales = [loc.strip() for loc in args.locales.split(",") if loc.strip()]

    # Health check: fail fast if sidecar isn't reachable.
    try:
        with httpx.Client(timeout=10.0) as client:
            h = client.get(f"{TRANSLATION_URL}/health")
            h.raise_for_status()
            info = h.json()
            print(f"Sidecar @ {TRANSLATION_URL}: model={info.get('model')} model_loaded={info.get('model_loaded')}")
    except Exception as e:  # noqa: BLE001
        print(f"FATAL: sidecar unreachable at {TRANSLATION_URL}: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Docs: {', '.join(docs)}")
    print(f"Locales: {', '.join(locales)} (+ zh-Hant via OpenCC s2hk)")
    print()

    failures: list[tuple[str, str, str]] = []
    total_strings = 0
    total_elapsed = 0.0

    for doc in docs:
        src_path = CONTENT_DIR / f"{doc}.en.json"
        if not src_path.exists():
            print(f"SKIP {doc}: {src_path.name} not found")
            continue
        for locale in locales:
            print(f"[{doc:14}] -> {locale:9} ... ", end="", flush=True)
            # Belt-and-braces: any unexpected exception from translate_doc
            # becomes a structured failure entry rather than aborting the
            # batch. A single transient sidecar or disk hiccup must not
            # cost the other ~N translations already completed.
            try:
                r = translate_doc(doc, locale)
            except Exception as exc:  # noqa: BLE001
                r = {
                    "status": "failed",
                    "error": f"unhandled {type(exc).__name__}: {exc}",
                    "count": 0,
                }
            if r["status"] == "ok":
                total_strings += r["count"]
                total_elapsed += r["elapsed_s"]
                print(f"OK  ({r['count']} strs, {r['elapsed_s']:>5.1f}s, {r['size']:>6} B)")
            else:
                failures.append((doc, locale, r["error"]))
                print(f"FAIL: {r['error']}")

    # zh-Hant pass: after all docs' zh-Hans outputs are written, convert each.
    if "zh-Hans" in locales:
        for doc in docs:
            src = CONTENT_DIR / f"{doc}.zh-Hans.json"
            if not src.exists():
                continue
            print(f"[{doc:14}] -> zh-Hant   ... ", end="", flush=True)
            r = convert_zh_hant(doc)
            if r["status"] == "ok":
                print(f"OK  (OpenCC s2hk, {r['size']} B)")
            else:
                print(f"FAIL: {r['error']}")
                failures.append((doc, "zh-Hant", r["error"]))

    print()
    print(f"Total: {total_strings} strings translated in {total_elapsed:.1f}s wall time")
    if failures:
        print(f"\nFAILURES ({len(failures)}):")
        for doc, locale, err in failures:
            print(f"  {doc} -> {locale}: {err}")
        print("\nRe-run failed pairs with: --docs <doc> --locales <locale>")
        sys.exit(2)
    print("All translations completed successfully.")


if __name__ == "__main__":
    main()
