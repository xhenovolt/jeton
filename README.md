# Jeton

Founder operating system: systems, deals, payments, licenses, finance, people and intelligence. Built on Next.js 16 (App Router) and PostgreSQL (Neon).

## Getting started

```bash
npm ci
cp .env.example .env.local     # or create it: DATABASE_URL=postgres://…
node scripts/migrate.mjs up    # apply database migrations
npm run dev                    # http://localhost:3000
```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run verify` | Everything CI runs except the build: dump check, route checks, lint, unit tests |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run lint` | ESLint (flat config, `eslint.config.mjs`) |
| `npm run check:routes` | Every API route has an auth guard, and every page resolves to a permission |
| `npm run check:dumps` | No database dumps are tracked by git |
| `npm run build` | Production build |

## Database migrations

All schema changes go in `migrations/NNN_description.sql` and are applied **only** through `scripts/migrate.mjs`. That script records applied files in the `schema_migrations` table.

```bash
node scripts/migrate.mjs status              # applied vs pending
node scripts/migrate.mjs up                  # apply pending, in order, one transaction per file
node scripts/migrate.mjs baseline --to 980   # existing DB: mark files up to 980 as already applied (run once)
node scripts/migrate.mjs lint                # naming rules; runs without a database
```

New files need a unique prefix above every existing one. Never commit database dumps or backups: `.gitignore` blocks them and CI fails on them.

## Conventions

- **API routes** use `withRoute()` from `src/lib/api/route.js`. It takes one of `permission: 'module.action'`, `signedIn`, `superadmin` or `public`, plus an optional zod `body` schema, and responds with `ok(data)` or `fail(status, message)`. A route that is genuinely public must also be allowlisted in `scripts/check-route-auth.mjs`.
- **Navigation and permissions:** `src/lib/navigation-config.js` is the single source for the sidebar, page permissions (`EXTRA_ROUTE_PERMISSIONS`), open pages (`OPEN_ROUTES`) and in-page section tabs (`getSectionTabs`).
- **Client requests:** use `api` / `apiRequest` from `src/lib/api-client.js` in new code.
- **Feedback:** use `useToast()` from `src/components/ui/Toast.js` for messages and `src/lib/confirm.js` for confirmations.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `WEBAUTHN_RP_ID` | Passkey relying-party ID, for example `jeton.example.com`. Recommended in production. |
| `WEBAUTHN_ORIGIN` | Allowed passkey origin(s), comma-separated. Recommended in production. |

## Documentation

- [`docs/ARCHITECTURE_REVIEW_AND_ROADMAP.md`](docs/ARCHITECTURE_REVIEW_AND_ROADMAP.md): architecture review, the phased improvement plan and its status.
- `docs/archive/`: historical implementation notes. They may be out of date.
