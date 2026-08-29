# Fonts — KDP Print lock

Ship **Literata** (body) and **Source Sans 3** (UI / labels), SIL OFL, Spanish glyphs (`á é í ó ú ñ ü ¿ ¡`).

Required in git (not downloaded at preflight):

- `fonts/Literata-Regular.ttf`
- `fonts/SourceSans3-Regular.ttf`

The GitHub plugin cannot faithfully commit binary TTF. Drop those two files onto `feat/npm-shell-fonts` (or use a Cloud Agent) and `npm run preflight` will embed them. Licenses: `OFL-Literata.txt`, `OFL-SourceSans3.txt`.
