# Fonts — KDP Print lock

Casa Studio ships Literata Regular (body) and Source Sans 3 Regular (UI / labels).
Both are SIL Open Font License and include Spanish glyphs.

## What is in git

These files are committed:

- fonts/Literata-Regular.ttf — body, 26104 bytes
- fonts/SourceSans3-Regular.ttf — UI / labels
- fonts/OFL-Literata.txt
- fonts/OFL-SourceSans3.txt

Bold and Semibold faces are not in this repo. Do not synthesize fake bold from Regular.

## What scripts/copy-fonts.mjs does

It only verifies that the two Regular TTFs exist on disk. It does not download fonts from Fontsource, Adobe, or anywhere else. If a file is missing it throws: Commit the OFL TTF. Do not fetch.

Web UI still uses @fontsource/literata and @fontsource/source-sans-3 (woff2) for the browser. Print embedding uses the committed TTFs only.

npm run preflight embeds those Regulars into the Part I interior PDF with pdf-lib and prints name + embedded=true.

KDP Print will re-check with pdffonts (look for emb yes). This repo is a preflight proof, not a substitute for the KDP checker.

## Licenses

- OFL-Literata.txt
- OFL-SourceSans3.txt
