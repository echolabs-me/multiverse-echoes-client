# client/scripts

Client-side tooling — i18n, prerender, sitemap, dynamic-key checks. The
quick-start block below covers the **only** workflow that requires the
B200 to be running: `translate-i18n.py` (and `translate-legal.py`).
Every other script in this directory runs locally with no external
dependency.

## Quick Start — running the translation scripts

The translation sidecar lives at `services/translation/server.py` and
binds **127.0.0.1:8200 on the B200 only**. There is no public endpoint;
no nginx forward, no cloudflared ingress. To reach it from a developer
machine you open an SSH tunnel for the duration of the run.

The B200 is **off by default**. Translation scripts are run during
founder-scheduled B200-on windows, not at commit time. See
[docs/runbooks/translation-generation.md](../../docs/runbooks/translation-generation.md)
for when these windows happen and how Commit-N-vs-translation-pass
sequencing works.

### 1. Look up the current B200 SSH endpoint

```bash
vastai show instance 34370817 | grep -E "ssh_host|ssh_port"
```

Instance ID **34370817** is the Maryland B200 as of 2026-04-24. If the
pod has been replaced (vast.ai instance lifecycles reset on host churn),
find the current ID:

```bash
vastai show instances
```

Pick the row labelled `me-server` (or with a matching gpu_name like
`B200`) and use its `id`, `ssh_host`, `ssh_port`.

### 2. Open the tunnel

```bash
ssh -L 8200:localhost:8200 -N -f root@<ssh_host> -p <ssh_port> -i ~/.ssh/vastai_key
```

`-N` says "no remote command", `-f` backgrounds the tunnel so your
shell returns immediately. As of 2026-04-24 the live values were:

```bash
ssh -L 8200:localhost:8200 -N -f root@ssh1.vast.ai -p 10816 -i ~/.ssh/vastai_key
```

### 3. Verify

```bash
curl -sf http://localhost:8200/health
```

Expected output: a JSON body with `"status": "ok"`, `"model_loaded": true`,
and the `supported_locales` array. If `curl` returns nothing or a
non-zero exit code, the tunnel is not healthy — re-check steps 1 and 2.

### 4. Run translate-i18n.py

```bash
# Idempotent fill: translate any non-en value still equal to the English
# source. Safe to re-run; existing translations are skipped.
python client/scripts/translate-i18n.py

# Single-locale variant.
python client/scripts/translate-i18n.py --locale ja

# --check (dry-run): exits 2 if any non-en locale carries unfilled keys.
python client/scripts/translate-i18n.py --check

# --test: 3 canonical placeholder-bearing strings × 20 non-en locales,
# asserts placeholder preservation and non-empty output. Real locale
# files untouched.
python client/scripts/translate-i18n.py --test

# --force: overwrite all non-en values with fresh translations,
# regardless of current state. Use sparingly.
python client/scripts/translate-i18n.py --force
```

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | All requested (locale, key) pairs translated or already filled |
| 1 | Sidecar unreachable at startup (tunnel hint printed) |
| 2 | One or more (locale, key) pairs failed; see stderr |

### 5. Close the tunnel

```bash
lsof -ti:8200 | xargs kill
```

The `-f` background daemon stays alive across shell exits — clean it up
explicitly when you're done. On Git Bash / Windows, `lsof` is provided
by the `procps` package (already installed via `winget` if you followed
the project's standard tooling list); on Linux / macOS it is built-in.

## Other scripts

| Script | Purpose |
| --- | --- |
| `check-dynamic-keys.js` | i18n parity for runtime-computed keys (`t(`settings.${x}`)`). |
| `check-hardcoded-strings.js` | Catches user-visible strings missing from i18n. |
| `check-i18n-keys.js` | i18n key parity gate — every non-en bundle must match en.json's flattened key set. Runs in pre-commit AND CI. |
| `generate-choose-language-inline.js` | Builds `client/src/generated/choose-language-titles.ts` from the locale JSONs. Re-runs on every commit that touches a locale. |
| `generate-sitemap.js` | Builds `dist/sitemap.xml` at build time. |
| `prerender.js` | Static-prerenders public routes for OG tag rendering. |
| `probe-middleware.mjs` | Curl-equivalent test for Cloudflare Pages `_middleware.ts` redirect behaviour. |
| `translate-legal.py` | Translates `client/src/content/legal/{doc}.en.json` to per-locale JSON via the same sidecar. |
| `translate-i18n.py` | Translates `client/src/locales/en.json` UI strings — this script. |

## Python dependencies

The two translation scripts require:

```
httpx>=0.27,<1.0
pyyaml>=6.0
opencc-python-reimplemented>=0.1.7
```

See [`requirements.txt`](requirements.txt). Install with:

```bash
pip install -r client/scripts/requirements.txt
```
