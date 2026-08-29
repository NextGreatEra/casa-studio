# Fonts — KDP Print lock

Casa Studio ships **Literata** (body) and **Source Sans 3** (UI / labels).
Both are SIL Open Font License and include Spanish glyphs: `á é í ó ú ñ ü ¿ ¡`.

## Why TTF are not committed (yet)

GitHub MCP `push_files` / `create_or_update_file` take JSON strings. Binary TTF/OTF cannot be pushed faithfully through that path. Do not treat an empty `artifacts/` folder plus an "embed" flag as a font.

## What `npm install` does

Dependencies:

- `@fontsource/literata` — web UI (woff2)
- `@fontsource/source-sans-3` — web UI (woff2)

`scripts/copy-fonts.mjs` (postinstall) downloads **TTF** onto disk:

| File | Role | Source |
| --- | --- | --- |
| `fonts/Literata-Regular.ttf` | Body | Fontsource TTF CDN, latin 400 |
| `fonts/Literata-Bold.ttf` | Body emphasis | Fontsource TTF CDN, latin 700 |
| `fonts/SourceSans3-Regular.ttf` | UI / labels | Fontsource TTF CDN, latin 400; Adobe TTF fallback |
| `fonts/SourceSans3-Semibold.ttf` | UI emphasis | Fontsource TTF CDN, latin 600; Adobe TTF fallback |

`npm run preflight` embeds those TTF files into a 136-page 7×10 PDF with pdf-lib and prints `name` + `embedded=true`.

KDP Print will re-check with `pdffonts` (look for `emb yes`). This repo is a preflight proof, not a substitute for KDP's checker.

## Licenses

- `OFL-Literata.txt`
- `OFL-SourceSans3.txt`
