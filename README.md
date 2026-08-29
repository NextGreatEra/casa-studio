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

The real book is **36 chapters + epílogo**. There are no eight Part I placeholders.

Trim: **7×10 in**. Interior preflight: **136 even pages**.

Cover wrap is untouched. There is no `cover.pdf` download and no fake 404 link. Interior download is offered only when a real file exists under `artifacts/interiors/`.

## Fonts (KDP Print)

| Face | Role | License |
| --- | --- | --- |
| Literata | Body | OFL (`fonts/OFL-Literata.txt`) |
| Source Sans 3 | UI / labels | OFL (`fonts/OFL-SourceSans3.txt`) |

Spanish glyphs: `á é í ó ú ñ ü ¿ ¡`.

GitHub MCP cannot take binary font files, so this PR does not commit TTF bytes. Instead:

- `@fontsource/literata` and `@fontsource/source-sans-3` power the web UI.
- `scripts/copy-fonts.mjs` runs on `npm install` and writes TTF into `fonts/` from the Fontsource TTF CDN (Adobe TTF fallback for Source Sans 3).
- `npm run preflight` embeds those TTF files into the 136-page PDF with pdf-lib and prints `name` + `embedded=true`.

KDP Print will re-check embedding with `pdffonts` (look for `emb yes`). The preflight PDF is a numbered proof with running header *La casa de San Jacinto*. It is not a second manuscript dump. Cover wrap is not generated.

## xAI

`server/lib/xai.ts` reads `process.env.XAI_API_KEY` and throws `not wired`. No live calls. No OpenAI, Anthropic, Google, or Midjourney SDKs.

Add `XAI_API_KEY` later through **Replit Secrets**. Never commit the key.

## Database

`shared/schema.ts`:

- `books` — id, title, language (default `es`), variety (default `es-MX`), trim (default `7x10`), status
- `chapters` — id, bookId, number, title, status
- `jobs` — id, bookId, stage, status, error, artifactPath

Stages: `outline`, `draft`, `pedagogy_gate`, `illustrate`, `art_gate`, `layout`, `print_gate`, `cover`.

The **cover** job refuses until the interior page count is even and frozen.

If `DATABASE_URL` is unset, the server uses an in-memory store so the workspace still boots. With Postgres attached, run `npm run db:push`.
