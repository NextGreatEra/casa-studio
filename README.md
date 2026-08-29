# Casa Studio

Thin publishing harness for **one book**: *La casa de San Jacinto* (Mexican Spanish reader).

- **GitHub** (`NextGreatEra/casa-studio`) is the source of truth.
- **Replit** is the host. `.replit` runs `npm run dev`. Replit is not the IDE.
- The manuscript stays in `NextGreatEra/la-casa-de-san-jacinto`. This repo does not clone, copy, or replace that book.

## Stack

One package, **npm** (not pnpm workspaces, no `pnpm --filter`):

- TypeScript
- Vite + React (`client/`)
- Express (`server/`)
- Drizzle + Postgres (`shared/schema.ts`)

## Commands

```bash
npm install
npm run dev
npm run build
npm run db:push
npm run preflight
```

## Book

This edition is **Parte I — La casa, chapters 1–8**. It is not the 36-chapter + epílogo / 136-page glyph proof.

Trim: **7×10 in**, white paper, no interior bleed. Interior preflight: **36 even pages** of live type (Literata + Source Sans 3 Regular, embedded). L2-only in the PDF. Chapters 9–36 stay in the manuscript.

Cover wrap is untouched. There is no `cover.pdf` download and no fake 404 link. Interior download is offered only when a real file exists under `artifacts/interiors/`.

## Fonts (KDP Print)

| Face | Role | License |
| --- | --- | --- |
| Literata | Body | OFL (`fonts/OFL-Literata.txt`) |
| Source Sans 3 | UI / labels | OFL (`fonts/OFL-SourceSans3.txt`) |

Spanish glyphs: `á é í ó ú ñ ü ¿ ¡`.

The TTFs are committed in git: fonts/Literata-Regular.ttf (26104 bytes) and fonts/SourceSans3-Regular.ttf.

- `@fontsource/literata` and `@fontsource/source-sans-3` power the web UI.
- scripts/copy-fonts.mjs only verifies those two Regulars exist. It does not download fonts.
- `npm run preflight` embeds those TTF files into the Part I PDF with pdf-lib and prints `name` + `embedded=true`.

KDP Print will re-check embedding with `pdffonts` (look for `emb yes`). The preflight PDF is the Part I live-type interior. Cover wrap is not generated. No live xAI.

## xAI

`server/lib/xai.ts` reads `process.env.XAI_API_KEY` (and `XAI_API_Key` for Replit) and throws `not wired`. No live calls. No OpenAI, Anthropic, Google, or Midjourney SDKs.

Add `XAI_API_KEY` later through **Replit Secrets**. Never commit the key.

## Database

`shared/schema.ts`:

- `books` — id, title, language (default `es`), variety (default `es-MX`), trim (default `7x10`), status
- `chapters` — id, bookId, number, title, status
- `jobs` — id, bookId, stage, status, error, artifactPath

Stages: `outline`, `draft`, `pedagogy_gate`, `illustrate`, `art_gate`, `layout`, `print_gate`, `cover`.

The **cover** job refuses until the interior page count is even and frozen.

If `DATABASE_URL` is unset, the server uses an in-memory store so the workspace still boots. With Postgres attached, run `npm run db:push`.
