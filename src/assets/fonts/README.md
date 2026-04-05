# Fonts

Self-hosted fonts loaded via `@font-face` declarations in
`client/src/styles/global.css`. Vite bundles the `.woff2` files at build
time via the relative URL imports in the CSS. No runtime CDN dependency.

## Current families

| Family | Script | Source | Weights | Files |
|---|---|---|---|---|
| Inter | Latin + Cyrillic | [rsms.me/inter](https://rsms.me/inter/) | 400/500/600/700 | `Inter-*.woff2`, `Inter-*-Cyrillic.woff2` |
| JetBrains Mono | Latin + Cyrillic (code) | [jetbrains.com/lp/mono](https://www.jetbrains.com/lp/mono/) | 400 | `JetBrainsMono-Regular*.woff2` |
| Noto Sans SC | Simplified Chinese | [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+SC) | 400/500/600/700 | `NotoSansSC-*.woff2` |
| Noto Sans Devanagari | Hindi | [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari) | 400/500/600/700 | `NotoSansDevanagari-*.woff2` |
| Noto Sans Arabic | Arabic | [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+Arabic) | 400/500/600/700 | `NotoSansArabic-*.woff2` |

## Downloading Noto Sans subsets for multilingual launch

The Noto Sans families are declared in `global.css` with `font-display: swap`
and `unicode-range` so English-only users pay zero bandwidth — a browser
only fetches a given woff2 when a codepoint in its range is actually
rendered on screen. Until the woff2 files are physically placed in this
directory, the browser falls through to the system sans-serif for those
scripts, which works but looks inconsistent across platforms.

### Expected filenames

```
NotoSansSC-Regular.woff2
NotoSansSC-Medium.woff2
NotoSansSC-SemiBold.woff2
NotoSansSC-Bold.woff2
NotoSansDevanagari-Regular.woff2
NotoSansDevanagari-Medium.woff2
NotoSansDevanagari-SemiBold.woff2
NotoSansDevanagari-Bold.woff2
NotoSansArabic-Regular.woff2
NotoSansArabic-Medium.woff2
NotoSansArabic-SemiBold.woff2
NotoSansArabic-Bold.woff2
```

### How to obtain them

**Option A — google-webfonts-helper (recommended, pre-subsetted):**

1. Visit <https://gwfh.mranftl.com/fonts>
2. Search for each family (Noto Sans SC, Noto Sans Devanagari, Noto Sans Arabic)
3. Select weights: 400, 500, 600, 700
4. Select "Best Support" character set to match the `unicode-range`
   declarations in `global.css`
5. Download "Modern Browsers" (woff2 only) archive
6. Rename files to match the expected filenames above (drop the hash and
   `-400`/`-500`/`-600`/`-700` suffixes, use `-Regular`/`-Medium`/`-SemiBold`/`-Bold`)
7. Drop into this directory

**Option B — Google Fonts direct download:**

1. Visit each family's page (see table above)
2. "Download family" → unzip
3. The static `.ttf` files need to be converted to `.woff2`:

   ```bash
   # Requires `woff2_compress` from https://github.com/google/woff2
   cd client/src/assets/fonts
   for ttf in path/to/NotoSansSC-Regular.ttf path/to/NotoSansSC-Medium.ttf ...; do
     woff2_compress "$ttf"
   done
   mv *.woff2 .
   ```

Expected compressed sizes after subsetting to the `unicode-range` from
`global.css`:

| Family | Per weight | Total (4 weights) |
|---|---|---|
| Noto Sans SC | ~1.2 MB | ~4.8 MB |
| Noto Sans Devanagari | ~120 KB | ~480 KB |
| Noto Sans Arabic | ~80 KB | ~320 KB |

The CJK subset dominates — this is inherent to the number of Chinese
characters. `unicode-range` ensures English users never download it.

### Verifying the load

1. Build and serve the client (`npm run dev` or `npm run build && npm run preview`)
2. Open DevTools → Network tab → filter by "Font"
3. Switch the app locale to `zh-Hans` (or render any Chinese characters)
4. Expect `NotoSansSC-Regular.woff2` to appear in the network tab
5. English-only flows should never trigger a Noto Sans SC/Devanagari/Arabic
   fetch

### Reference

- `client/src/styles/global.css` — `@font-face` declarations
- `client/src/styles/global.css` — `body { font-family: ... }` fallback chain
- `client/src/components/ShareModal.tsx` — `CANVAS_FONT_STACK` mirror for Canvas2D
- `docs/claude/i18n-multilingual-tasks.md` — CC TASK 4 Part C
