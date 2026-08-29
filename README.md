# Casa Studio

Casa Studio is the Replit host for a thin publishing pipeline around one book:
**La casa de San Jacinto**, an illustrated Mexican-Spanish reader.

The manuscript source of truth remains the GitHub repository
`NextGreatEra/la-casa-de-san-jacinto`. This app does not clone, import, or replace
that manuscript.

## Scope

- One book workspace
- Eight Part I chapter placeholders
- Pipeline stages from outline through cover
- Human review controls for draft and art
- Print-readiness checks
- Job rows for all stub actions
- `interior.pdf` and `cover.pdf` downloads that return 404 until artifacts exist
- xAI-only provider stub; no live model calls

## Commands

```bash
pnpm --filter @workspace/casa-studio run dev
pnpm --filter @workspace/db run push
pnpm run build
```

The managed Replit workflows supply the ports and base paths needed by the web
and API services.

## Environment

`XAI_API_KEY` will be added later through Replit Secrets. Never commit the key.