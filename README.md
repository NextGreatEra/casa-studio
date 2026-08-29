# Casa Studio

Thin publishing harness for **one** book: *La casa de San Jacinto*.
Replit is the host. GitHub is the source of truth.
The manuscript stays in `NextGreatEra/la-casa-de-san-jacinto` (36 chapters + epílogo). This app does not clone or replace it.

## Stack

TypeScript, Vite + React (`client/`), Express (`server/`), Drizzle + Postgres (`shared/schema.ts`). One `package.json`. **npm**, not pnpm workspaces.

## Commands

```bash
npm install
npm run dev
npm run db:push
npm run fonts
npm run preflight
```

`npm run preflight` downloads OFL Literata + Source Sans 3 and writes a 136-page 7×10 PDF with those fonts **embedded**. It does not generate a cover. The existing wrap stays untouched.

## Environment

`XAI_API_KEY` goes in Replit Secrets later. Never commit the key. `server/lib/xai.ts` is a stub and throws `not wired`. No live model calls in this PR.

## Print lock

- Trim: 7×10
- Interior must be even-page and frozen before cover may run
- Do not ship Helvetica or Times (unembedded Type 1 is the current KDP blocker on the ReportLab masters)
- No fake `cover.pdf` download
