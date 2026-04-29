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

## Noto Sans subsets for multilingual launch

The Noto Sans families are declared in `global.css` with `font-display: swap`
and `unicode-range` so English-only users pay zero bandwidth — a browser
only fetches a given woff2 when a codepoint in its range is actually
rendered on screen.

### Committed files (sizes per weight, 4 weights each)

| Family | Per weight | Total | Subset |
|---|---|---|---|
| Noto Sans SC | ~1.1 MB | ~4.6 MB | chinese-simplified |
| Noto Sans Devanagari | ~60 KB | ~250 KB | devanagari |
| Noto Sans Arabic | ~62 KB | ~255 KB | arabic |

The CJK subset dominates — inherent to the number of Chinese ideographs.
`unicode-range` ensures English-only users never download any of them.

### Reproduction (audit D11)

The committed files are the pre-subsetted woff2s published by google-webfonts-helper,
whose subsets match the CLDR coverage for each script and align with the
`unicode-range` declarations in `global.css`.

```bash
# 1. Download the three subset zips
curl -sL -o sc.zip  "https://gwfh.mranftl.com/api/fonts/noto-sans-sc?download=zip&subsets=chinese-simplified&variants=regular,500,600,700&formats=woff2"
curl -sL -o dev.zip "https://gwfh.mranftl.com/api/fonts/noto-sans-devanagari?download=zip&subsets=devanagari&variants=regular,500,600,700&formats=woff2"
curl -sL -o ar.zip  "https://gwfh.mranftl.com/api/fonts/noto-sans-arabic?download=zip&subsets=arabic&variants=regular,500,600,700&formats=woff2"

# 2. Unzip and rename to the filenames referenced from global.css
unzip sc.zip && unzip dev.zip && unzip ar.zip
# SC
mv noto-sans-sc-v*-chinese-simplified-regular.woff2 NotoSansSC-Regular.woff2
mv noto-sans-sc-v*-chinese-simplified-500.woff2     NotoSansSC-Medium.woff2
mv noto-sans-sc-v*-chinese-simplified-600.woff2     NotoSansSC-SemiBold.woff2
mv noto-sans-sc-v*-chinese-simplified-700.woff2     NotoSansSC-Bold.woff2
# Devanagari
mv noto-sans-devanagari-v*-devanagari-regular.woff2 NotoSansDevanagari-Regular.woff2
mv noto-sans-devanagari-v*-devanagari-500.woff2     NotoSansDevanagari-Medium.woff2
mv noto-sans-devanagari-v*-devanagari-600.woff2     NotoSansDevanagari-SemiBold.woff2
mv noto-sans-devanagari-v*-devanagari-700.woff2     NotoSansDevanagari-Bold.woff2
# Arabic
mv noto-sans-arabic-v*-arabic-regular.woff2         NotoSansArabic-Regular.woff2
mv noto-sans-arabic-v*-arabic-500.woff2             NotoSansArabic-Medium.woff2
mv noto-sans-arabic-v*-arabic-600.woff2             NotoSansArabic-SemiBold.woff2
mv noto-sans-arabic-v*-arabic-700.woff2             NotoSansArabic-Bold.woff2
```

If gwfh is ever unavailable, the same result can be produced by taking the
OFL-licensed variable fonts from <https://github.com/notofonts> and running
`pyftsubset` (from the `fonttools` pip package) against each weight with the
matching unicode-range from `global.css`, e.g.:

```bash
pip install fonttools brotli zopfli
pyftsubset NotoSansSC-VF.ttf \
  --unicodes='U+2E80-2EFF,U+3000-303F,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF' \
  --flavor=woff2 \
  --output-file=NotoSansSC-Regular.woff2
```

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
