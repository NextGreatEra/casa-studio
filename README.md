# Casa Studio

English human-in-the-loop xAI book studio.

- **GitHub** (`NextGreatEra/casa-studio`) is the source of truth.
- **Replit** is the host only. `.replit` runs `npm run dev`. Replit is not the IDE.

App chrome is English. The user talks to the app. Spanish lives in book artifacts, not UI chrome.

## First project

*La casa de San Jacinto* — Spanish A2 reader (Mexican Spanish). Spanish in the book, English in the app. Seeded as project 1. New projects default `language` to `en`; the seeded book still uses `BOOK_LANGUAGE` (`es`) explicitly.

## Slice 1

- Project list (`GET /api/projects`)
- Research notes persist as records (CRUD on `/api/projects/:bookId/research`), not chat residue
- Chat thread may exist in the UI; **Generate is not wired** (`POST /api/generate` returns 501 `{ error: "not wired" }`)
- No live xAI. CI does not call `api.x.ai`
- Print/fonts are an export stage: OFL Literata + Source Sans 3, 7×10, pdf-lib embed
- Cover wrap is untouched
- Human gates on draft and art stay

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

`npm run db:push` applies the Drizzle schema, including `research_notes`.

## Print / fonts (export stage)

Trim: **7×10 in**, white paper, no interior bleed. Interior preflight: **36 even pages** of live type (Literata + Source Sans 3 Regular, embedded). This edition is **Part I — chapters 1–8**. L2-only in the PDF.

Cover wrap is untouched. There is no `cover.pdf` download. Interior download is offered only when a real file exists under `artifacts/interiors/`.

| Face | Role | License |
| --- | --- | --- |
| Literata | Body | OFL (`fonts/OFL-Literata.txt`) |
| Source Sans 3 | UI / labels | OFL (`fonts/OFL-SourceSans3.txt`) |

Spanish glyphs in the book: `á é í ó ú ñ ü ¿ ¡`.

The TTFs are committed in git: fonts/Literata-Regular.ttf and fonts/SourceSans3-Regular.ttf.

- `@fontsource/literata` and `@fontsource/source-sans-3` power the web UI.
- scripts/copy-fonts.mjs only verifies those two Regulars exist. It does not download fonts.
- `npm run preflight` embeds those TTF files into the Part I PDF with pdf-lib and prints `name` + `embedded=true`.

KDP Print will re-check embedding with `pdffonts` (look for `emb yes`). Cover wrap is not generated. No live xAI.

## xAI

`server/lib/xai.ts` reads `process.env.XAI_API_KEY` (and `XAI_API_Key` for Replit) and throws `not wired`. Slice 1 Generate returns 501 without calling `fetch` or `api.x.ai`. No OpenAI, Anthropic, Google, or Midjourney SDKs.

Add `XAI_API_KEY` later through **Replit Secrets**. Never commit the key.

## Database

`shared/schema.ts`:

- `books` — id, title, language (default `en`; seeded La casa still uses `BOOK_LANGUAGE` `es`), variety (default `es-MX`), trim (default `7x10`), status
- `chapters` — id, bookId, number, title, status
- `jobs` — id, bookId, stage, status, error, artifactPath
- `research_notes` — id, bookId, title, body, source, createdAt

Stages: `outline`, `draft`, `pedagogy_gate`, `illustrate`, `art_gate`, `layout`, `print_gate`, `cover`.

The **cover** job refuses until the interior page count is even and frozen.

If `DATABASE_URL` is unset, the server uses an in-memory store so the workspace still boots. If Postgres is set but fails (including a missing `research_notes` table until `db:push`), it falls back to memory.
