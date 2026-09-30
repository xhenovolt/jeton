# Jeton: Architecture Review and Phased Improvement Plan

_Review date: 2026-09-30 · Scope: the whole repository (Next.js 16 App Router, 129 app pages, 292 API routes, 113 SQL migrations)._

This document lists the architectural flaws found in the codebase and orders the fixes into phases. Items marked ✅ are done on branch `claude/tender-goodall-24d74d`.

## Progress

| Phase | Status |
|---|---|
| 0 · Security | ✅ Done |
| 0b · Leaks and dead open routes | ✅ Done, except rewriting git history (see below) |
| 1 · Reported UX defects | ✅ Done |
| 2 · Consolidate domains and routes | ✅ Done, except merging `employees` into `staff` (needs a data migration against production) |
| 3 · One way to do each thing | ✅ Toolkit, conventions and removals done. Migrating existing call sites is incremental (see Phase 3). |
| 4 · Lint, tests, CI | ✅ Done |
| 5 · Data layer and repo hygiene | ✅ Runner and cleanup done. Transactions, pagination and moving PDF generation to a worker remain. |

**Still needed from the repository owner:**
1. **Rewrite git history to purge the removed database dumps.** Deleting the files stops future exposure, but `jeton_db_backup_2026-03-09.sql` and `Backup/jeton_backup_2026-03-08.sql` are still in every clone's history. Run `git filter-repo --path jeton_db_backup_2026-03-09.sql --path Backup/jeton_backup_2026-03-08.sql --invert-paths` and force-push all branches. Then rotate the database password and any secrets or password hashes the dumps contained, and ask collaborators to re-clone.
2. **Baseline each existing database once:** `node scripts/migrate.mjs baseline --to 980`, then `node scripts/migrate.mjs up`. That applies migration 981 (the knowledge merge).
3. Set `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` in production.

---

## 1. Findings

### A. Security: critical

| # | Flaw | Evidence | Status |
|---|------|----------|--------|
| A1 | **Admin and user APIs with no authentication at all.** Anyone on the internet could create a user with any role, wipe any user's sessions, read or create salary accounts, run the orphan-cleanup function, or validate/activate licenses. | `api/admin/staff/create-with-account`, `api/auth/sessions/invalidate`, `api/salary-accounts`, `api/admin/data-consistency`, `api/admin/licenses/validate` | ✅ These now require a superadmin (`guardSuperAdmin`) |
| A2 | **More unauthenticated routes, all unused by the UI.** They are duplicates of routes that are properly guarded. | `api/follow-ups` (vs `api/followups`), `api/operations-log` (vs `api/operations`), `api/systems/[id]/tech-stack` (vs `api/tech-stacks`) | ✅ Deleted. `scripts/check-route-auth.mjs` fails CI on any new unguarded route. |
| A3 | **A production database backup is committed to git.** It holds real user, financial and staff data. | `jeton_db_backup_2026-03-09.sql` (245 KB), `Backup/jeton_backup_2026-03-08.sql` | ✅ Files removed. `.gitignore` blocks dumps and `scripts/check-no-db-dumps.mjs` fails CI on them. ⚠️ History rewrite still needed (see Progress). |
| A4 | **Anonymous passkey challenges could be taken by another login.** The login flow used whichever unexpired anonymous challenge happened to be in the table, so two logins at once could steal each other's challenge. | `lib/passkeys.js` `consumeChallenge({userId:null})` | ✅ The challenge is now tied to the browser with an httpOnly cookie (`consumeChallengeById`) |
| A5 | **Route guard opened the whole `/app/dashboard/*` tree to every role.** `/app/dashboard` was an open *prefix*, so every DRAIS control page and the integrations page skipped their permission check. | `components/layout/RoutePermissionGuard.js` | ✅ The dashboard is now an exact-match exception |
| A6 | **The integrations page lived outside the protected tree.** It sat at `/dashboard/integrations`, which the middleware does not cover, while the sidebar linked to `/app/dashboard/integrations`, which returned 404. | `src/app/dashboard/integrations` | ✅ Moved under `/app`. The old URL redirects. |
| A7 | **Each route created its own `pg.Pool`.** This bypassed the shared pool's SSL, retry and cold-start handling, and every Pool opened extra connections to Neon. | 9 files contained `new Pool(` | ✅ All route-level pools removed (6 moved to the shared pool, 3 deleted with A2). |
| A8 | The permission cache (`localStorage['jeton.auth.v1']`) was never cleared on sign-in, and the Navbar and MobileDrawer logouts did not clear it. The next account in the same browser briefly saw the previous user's menu. The code comment claimed the cache was "keyed on the session cookie", which was not true. | `PermissionProvider.js`, `Navbar.js`, `MobileDrawer.js` | ✅ The cache is now cleared on sign-in (`resetPermissions`) and on every logout path |

### B. Biometric authentication (the reported issue)

The backend (WebAuthn via `@simplewebauthn`) and a `/app/settings/security` page already existed. Users still couldn't set up a fingerprint for these reasons:

1. **The page couldn't be found.** It was missing from the Settings sidebar menu and the profile dropdown. The only way in was one tile on the General settings page. ✅ It now has a sidebar entry (**Settings → Security & Biometrics**), a profile-menu entry, and a status card at the top of Settings ("Not set up · Set up" / "Enabled on N devices").
2. **The Register button was disabled on most desktops.** The UI disabled it whenever there was no *built-in* sensor, and the server forced `authenticatorAttachment: 'platform'`. That ruled out a phone (QR/hybrid) or a security key. ✅ The attachment restriction is removed. The button is disabled only when WebAuthn is truly unavailable (no browser support, or not HTTPS). The login button follows the same rule.
3. **Enrollment failed with a generic error on any host that didn't exactly match `NEXT_PUBLIC_APP_URL`.** That covers Vercel preview URLs, custom domains, `www` vs apex, and LAN IPs. The RP ID and origin were read from environment variables only, and the verification error was swallowed as a 500. ✅ The RP ID and origin now come from `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` (the origin accepts a comma-separated list), with a fallback to the request's real origin. Verification errors are returned to the client.
4. The Settings page's "Change Password" and "Save Profile" buttons were **fakes** with no API behind them. The profile block never rendered because `/api/auth/me` returns `{ user }`, not `{ success, data }`. ✅ There is a new `POST /api/auth/change-password`: it checks the current password, applies the strength rules, revokes other sessions, and writes an audit entry. The profile block now reads the right shape and links to `/app/profile` for editing.

### C. "Dashboard shows real numbers only after a refresh" (the reported issue)

**Root cause:** `PermissionProvider` is mounted in the **root** layout, so it is already running on `/login`. There, `/api/auth/me` returns 401, which leaves the provider in the state `{user:null, loading:false}`. After sign-in, `LoginForm` did a *client-side* `router.push('/app/dashboard')`. The provider doesn't remount and never fetched again. On the dashboard, `can()` returned false for every widget, so every tile showed zero or nothing. A hard refresh remounted the provider and "fixed" it.

✅ Fixes:
- `LoginForm` now awaits `resetPermissions()`, which clears the cache and fetches `/api/auth/me`, before navigating. This covers password login, biometric login and the "already signed in" redirect.
- The provider fetches permissions again whenever the path enters `/app/*` while `user` is null. This safety net covers `/setup-password → /app` and any other client-side entry.
- The dashboard's data effect now depends on `user.id` and shows a skeleton until a user is resolved, never an empty permission-less layout.

### D. Route fragmentation (the reported issue)

| Cluster | Fragmentation | Status |
|---|---|---|
| **Intelligence** | 5 top-level trees: `/app/intelligence`, `/app/issue-intelligence`, `/app/tech-intelligence`, `/app/financial-intelligence`, `/app/prospects/intelligence`. The Intelligence menu also held unrelated items (HRM, Documents, Decision Log), and a link to a page that does not exist (`/app/engineering`). | ✅ Merged into one hub, `/app/intelligence/{financial,pipeline,issues,tech}`, with a shared tab bar (`intelligence/layout.js`) built from the same config as the sidebar. Old URLs get permanent redirects in `next.config.mjs`. HRM and Decision Log moved to **Company**, Document Center to **Organization Documents**. The Command Center's "Open Bugs" link now points to issues, not tech stacks. |
| **People / HR** | `/app/staff`, `/app/hr` (not linked anywhere), `/app/hrm`, `/app/org-hierarchy`, `/app/admin/users`. The APIs are split the same way: `api/staff`, `api/employees`, `api/employee-accounts`, `api/salary-accounts`, `api/payouts`. There are two tables (`staff`, `employees`). | Phase 2 |
| **Documents** | `/app/documents/*` (a thin UI over the `documents` table) and `/app/admin/documents/*` (the template and generation engine). Each has its own `settings`, `templates`, `generated` and `verify` subtree, and there is a third `/verify/*` public tree. | Phase 2 |
| **Follow-ups** | `api/followups` (used) and `api/follow-ups` (unused, no auth). | Phase 0b (delete) |
| **Operations** | `api/operations` (used) and `api/operations-log` (unused, no auth). | Phase 0b (delete) |
| **Knowledge** | `api/knowledge` → `knowledge_assets` (used), and `api/knowledge-base` → `knowledge_articles` (unused, a **different table**). | Phase 2: migrate any rows, then delete |
| **Tech stack** | `api/tech-stack` → `tech_stack_entries`, `api/tech-stacks/*` → `tech_stacks`, and `api/systems/[id]/tech-stack` → a third path. | Phase 2 |
| **Assets / Resources / Items** | `/app/assets` and `/app/resources` are client-side redirect stubs, and their APIs return 410. | ✅ Server-side redirects added. Delete the stubs in Phase 2. |
| **Activity / logs** | `api/activity`, `api/system-events`, `api/system-logs`, `api/operations-log`, `admin/audit-logs`, `lib/audit.js`, `lib/rbac-audit.js`, `lib/system-logs.js`, `lib/events.js`, `lib/system-events.js`. | Phase 3 |
| **Dashboards** | `/app/dashboard`, `/app/command-center`, `/app/control-tower`, `/app/intelligence`. Each has its own aggregate API (`api/dashboard`, `api/founder/command-center`, `api/org/control-tower`, `api/intelligence/dashboard`, `api/metrics`) and repeats the same SQL. | Phase 3 |
| **Legacy top-level redirects** | `/dashboard`, `/designs` and `/dashboard/integrations` exist only to redirect. | Phase 2: move them to `next.config.mjs` redirects |

### E. Duplicated core libraries (no single source of truth)

- **Auth and permissions: 6 overlapping modules.** `lib/auth.js` (password/user), `lib/auth-utils.js` (session → auth), `lib/session.js`, `lib/current-user.js` and `lib/current-user-full.js` (server components), `lib/permissions.js` (1,100 lines: DB-backed RBAC *and* a legacy static role matrix), `lib/rbac.js` (a second `canAccess` with a different signature), and `lib/authorization-engine.js`. Route handlers use three calling conventions: `requirePermission(req,'a.b')`, `requirePermission(req,'a','b')`, and bare `verifyAuth`. Superadmin is detected three different ways.
- **Five client HTTP helpers with incompatible result shapes.** `fetchWithAuth` (94 files, with a fake `.json()` shim), `api-client.apiRequest` (10 files), raw `fetch('/api…')` (54 files), `useFormSubmit`, and each hook's own fetch.
- **API response envelope not standardised.** Some routes return `{success,data}`, others `{user}`, `{error}` or a bare array, and status codes vary. The Settings page bug in B4 came from this.
- **Four notification/UI feedback systems.** A custom `ui/Toast` (85 files), `react-hot-toast` (6), `sweetalert2` (2), and `react-toastify` (installed, 0 uses). There are also `lib/confirm.js` and `lib/approval-prompt.js`.
- **Two currency formatters.** `lib/format-currency.js` and `lib/formatCurrency.ts` (0 uses). The codebase also mixes TS and JS in `lib/`.
- **Sidebar config is not the only route registry.** `getRoutePermission` walks the nav tree, so any page left out of the nav (for example `/app/hr`, `/app/issues`, `/app/approval-pipeline/*`) has **no client-side permission gate** and depends entirely on its APIs.

### F. Data layer and migrations

- **No migration runner or tracking table.** 113 files include duplicate numeric prefixes (006, 007, 008, 028, 032, 202, 300, 946, 947, 952) and unnumbered files (`create_sales_tables.sql`). There are also ad-hoc scripts at the repo root (`run-migration-951.mjs`, `run-migration-952-v2.mjs`, …). No one can say which migrations have been applied to which database.
- Three schema snapshots are committed at the root (`jeton_*_schema_2026-03-09.sql`) and will drift from the migrations.
- Several write paths that must be atomic still chain separate `query()` calls, each taking a fresh client. `withTransaction` exists but few routes use it.
- Most list endpoints have no pagination.

### G. Repository hygiene and delivery

- **65 Markdown files at the root** (`*_COMPLETE.md`, `*_QUICK_REFERENCE.md`, several `PHASE_*` files) on top of `docs/` and `Documentation/`. Much of it is outdated and contradicts itself.
- **Junk files created by mistyped shell commands** are committed at the root: `leep 3`, `ource .env.local`, `ole.log('Payments in USD_');`, `t { Pool } = require('pg');`, `ql --no-pager -c SELECT…`, `suances_');`, `ty_payment.mjs`, plus `find_consty_payment.mjs`, `test_db.mjs`, `sidebar-links.txt`, and the `Backup/` folder.
- **No tests, no linter, no typecheck, no CI.** `package.json` has only `dev`, `build` and `start`. There is no `.github/workflows`.
- Heavy dependencies ship with the web app (`puppeteer`, full `html2canvas`), and `dev` forces `--webpack`.
- `api/auth/sessions/invalidate` reads `params` synchronously (a Promise in Next 16), and a `DELETE` there can never receive a `sessionId`. Dead code.

---

## 2. Phased execution plan

Each phase can ship on its own and leaves the app working. Phases 0 and 1 are done on this branch.

### Phase 0: Stop the bleeding (security) ✅
- ✅ Superadmin guard on the 5 open admin/user endpoints (A1).
- ✅ Shared DB pool for those routes plus `auth/me/presence` (A7).
- ✅ Route-guard prefix bug (A5), integrations moved under `/app` (A6), permission cache cleared on sign-in and sign-out (A8).
- ✅ Passkey challenges tied to the browser (A4).

**Phase 0b** ✅
1. ✅ Deleted `api/follow-ups`, `api/operations-log` and `api/systems/[id]/tech-stack` (A2).
2. ✅ Removed both data dumps and the two schema-only pg_dump snapshots. ⚠️ Purging them from git history is still owner work (see Progress).
3. ✅ `.gitignore` blocks dumps, backups and `.env*` (with a `.env.example` exception).
4. ✅ `scripts/check-route-auth.mjs` and `scripts/check-no-db-dumps.mjs` run in CI.

### Phase 1: Fix the reported UX defects ✅ done
- ✅ Dashboard numbers right on the first launch (C).
- ✅ Biometric setup findable and working on every device class, with diagnosable errors (B1–B3).
- ✅ Real change-password flow, and the Settings profile block fixed (B4).
- ✅ Intelligence routes merged into `/app/intelligence/*` with redirects. Broken sidebar links fixed (`/app/engineering`, `/app/dashboard/integrations`) (D).

Deploy note: set `WEBAUTHN_RP_ID` (for example `jeton.example.com`) and `WEBAUTHN_ORIGIN` (for example `https://jeton.example.com,https://www.jeton.example.com`) in production. Without them, the request origin is used, which works but is less strict.

### Phase 2: Consolidate domains and routes ✅
1. ✅ **People:** one tree under `/app/staff`: Directory · Departments & HRM · Payroll · Org Hierarchy, with shared tabs. `/app/hr` never rendered (it used an undefined `styles` object) and is rebuilt as Payroll. *Remaining:* fold the `employees` table into `staff` with a data migration, once it can be checked against production data.
2. ✅ **Documents:** `/app/admin/documents/*` is canonical, because it is what the nav and every link use. The unlinked `/app/documents/{templates,generated,settings,verify}` wrappers and their duplicate `components/documents/*` implementations were removed and now redirect. `/app/documents` stays as the uploads library. *Follow-up:* the removed components had bulk/export/search UI that could be ported into the admin pages (recover them from git history before commit 7be295a).
3. ✅ **Knowledge / tech stack:** migration 981 copies `knowledge_articles` into `knowledge_assets`, and `api/knowledge-base` and `api/tech-stack` are deleted. `tech_stack_entries` (per-system components) is left alone: it isn't a duplicate of `tech_stacks` and has no UI yet.
4. ✅ Redirect-only pages are replaced by `next.config.mjs` redirects. `/app/sales` is removed: its `/api/sales` never existed.
5. ✅ **Route registry:** `EXTRA_ROUTE_PERMISSIONS` and `OPEN_ROUTES` in `navigation-config.js`. `scripts/check-route-registry.mjs` fails CI when a page resolves to no permission. This also fixed company-wide settings pages being open to every role, and `PATCH /api/settings/company` accepting `users.view`.

### Phase 3: One way to do each thing ✅ foundations · 🔄 call-site migration

Done: ✅ `withRoute`/`ok`/`fail` (`src/lib/api/route.js`) with zod validation and a standard envelope (adopted by change-password and passkeys; `/api/auth/me` returns the envelope as well). ✅ Every `requirePermission` call uses `'module.action'`. ✅ react-hot-toast screens moved to `ui/Toast`: no Toaster was mounted, so their messages never showed. ✅ react-hot-toast and react-toastify removed. ✅ Six dead libraries deleted. ✅ `api-client` designated as the client for new code.

Remaining, incremental (convert a route or page whenever you touch it):
1. **Server auth API:** a single `lib/auth/` module exporting `getAuth(request)`, `requirePermission(request, 'module.action')` (one signature), `guardSuperAdmin`, and `getCurrentUser()` for RSC. Delete `rbac.js`, `authorization-engine.js` and the static role matrix in `permissions.js` once call sites are migrated. Have a codemod rewrite the `(req,'a','b')` call sites.
2. **API envelope:** add `ok(data, init)` / `fail(status, message, code)` helpers and adopt `{ success, data } | { success:false, error, code }` everywhere, `/api/auth/me` included. Move route handlers to a `withRoute({ permission }, handler)` wrapper that also turns `DatabaseUnavailableError` into a 503 and validates input with `zod` (already a dependency).
3. **Client data layer:** one `apiClient` that returns the envelope (no `.json()` shim), plus one `useApi(key, fetcher, {refreshInterval})` hook with a cache and stale-while-revalidate (SWR or TanStack Query). Delete `api-client.js`, `useFormSubmit` and the ad-hoc fetches.
4. **Feedback UI:** keep `ui/Toast` and one confirm dialog. Remove `react-hot-toast`, `react-toastify` and `sweetalert2`.
5. **Aggregates:** a single `lib/metrics/` service that the dashboard, command center, control tower and intelligence overview all read from. Retire the duplicated SQL in 5 routes.
6. **Events and audit:** one `recordEvent({type, actor, entity, payload})` that writes the audit log and fans out to activity feeds and notifications. Replace `audit.js`, `rbac-audit.js`, `system-logs.js`, `events.js` and `system-events.js`.

### Phase 4: Delivery safety net ✅
Done: ESLint (0 errors; it found an unimported `<Link>`, a file that didn't parse, and missing keys), 31 Vitest tests, dump/route/registry/migration guard scripts, and a GitHub Actions workflow (`.github/workflows/ci.yml`). *Remaining:* Playwright smoke tests (login → dashboard, a virtual-authenticator passkey flow), and promoting the React-Compiler lint warnings to errors as code is cleaned up.

Original plan:
1. `eslint` (next/core-web-vitals and react-hooks) plus `tsc --checkJs` on `lib/`. Use a `jsconfig` with `checkJs` and move gradually to TypeScript.
2. **Tests:** Vitest unit tests for `lib/permissions`, `lib/passkeys`, `nav-permissions` and the invoice/pricing engines. Playwright smoke tests: login → dashboard shows numbers without a reload; register a passkey with Chromium's virtual authenticator; old intelligence URLs redirect.
3. **Route-auth lint:** a script that fails CI if any `src/app/api/**/route.js` handler lacks an auth guard, unless it is on an explicit public allowlist (`health`, `version`, `auth/login`, `auth/register`, `passkeys/authenticate*`, `pricing/system/*`, DRAIS webhook).
4. **GitHub Actions:** install → lint → typecheck → test → `next build` on every PR.

### Phase 5: Data layer and repo hygiene ✅ runner and cleanup · 🔄 transactions and pagination
Done: ✅ `scripts/migrate.mjs` (`schema_migrations` table with checksums, `status`/`up`/`baseline`/`lint`). It was tested against PostgreSQL 16, including a failed migration rolling back and baselining legacy files. It replaced the ten untracked runners. ✅ The root is now README + CHANGELOG. 64 status files moved to `docs/archive/root/`, `Documentation/` moved to `docs/archive/Documentation/`, and `Backup/` assets moved to `docs/reference/`. ✅ Shell-typo junk files and one-off scripts removed. ✅ `.env.example` added. *Remaining:* items 3 and 5 below. The unreferenced root `lib/design-system/` templates were kept, since they look like seed content, and can move under `src/`.

Original plan:
1. Adopt a real migration tool (`node-pg-migrate` or a `schema_migrations` table with a small runner). Renumber the duplicate prefixes, record which migrations have run in each environment, and delete the root `run-migration-*.mjs` scripts.
2. Delete the committed schema snapshots and generate them in CI when needed.
3. Wrap every multi-statement write that moves money or identity in `withTransaction`. Add pagination (`limit`/`cursor`) to list endpoints.
4. Move the 65 root Markdown files into `docs/` (keep README, CHANGELOG and this roadmap), delete the obsolete `*_COMPLETE.md` status files, and remove the junk shell-typo files and `Backup/`.
5. Move `puppeteer` PDF generation to a separate worker or serverless function, and drop the forced `--webpack` once nothing depends on it.

---

## 3. Changes on this branch

| Area | Files |
|---|---|
| Superadmin guard helper | `src/lib/auth-utils.js` (`guardSuperAdmin`) |
| Endpoints secured and moved to the shared pool | `api/admin/data-consistency`, `api/admin/licenses/validate`, `api/admin/staff/create-with-account`, `api/auth/sessions/invalidate`, `api/salary-accounts`, `api/auth/me/presence` |
| First-launch dashboard | `components/providers/PermissionProvider.js`, `components/auth/LoginForm.js`, `app/app/dashboard/page.js`, logout in `Navbar.js` / `MobileDrawer.js` |
| Biometrics | `lib/passkeys.js`, `api/auth/passkeys/*`, `app/app/settings/security/page.js`, `app/app/settings/page.js`, `lib/navigation-config.js`, `components/layout/Navbar.js` |
| Password change | `api/auth/change-password/route.js` (new) |
| Route guard | `components/layout/RoutePermissionGuard.js` |
| Intelligence hub | `app/app/intelligence/{layout.js,financial,pipeline,issues,tech}`, `next.config.mjs` redirects, `lib/navigation-config.js` (`INTELLIGENCE_TABS`), `app/app/command-center/page.js` |
| Integrations page | `app/app/dashboard/integrations/page.js` (moved), `app/dashboard/integrations/page.js` (now a redirect) |

`next build` compiles successfully with all of these changes.
