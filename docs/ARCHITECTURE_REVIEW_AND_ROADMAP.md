# Jeton: Architecture Review and Phased Improvement Plan

_Review date: 2026-09-30 · Scope: the whole repository (Next.js 16 App Router, 129 app pages, 292 API routes, 113 SQL migrations)._

This document lists the architectural flaws found in the codebase and orders the fixes into phases. Phase 0 and Phase 1 are **done on this branch**. Their items are marked ✅. Everything else is a plan.

---

## 1. Findings

### A. Security: critical

| # | Flaw | Evidence | Status |
|---|------|----------|--------|
| A1 | **Admin and user APIs with no authentication at all.** Anyone on the internet could create a user with any role, wipe any user's sessions, read or create salary accounts, run the orphan-cleanup function, or validate/activate licenses. | `api/admin/staff/create-with-account`, `api/auth/sessions/invalidate`, `api/salary-accounts`, `api/admin/data-consistency`, `api/admin/licenses/validate` | ✅ These now require a superadmin (`guardSuperAdmin`) |
| A2 | **More unauthenticated routes, all unused by the UI.** They are duplicates of routes that are properly guarded. | `api/follow-ups` (vs `api/followups`), `api/operations-log` (vs `api/operations`), `api/systems/[id]/tech-stack` (vs `api/tech-stacks`) | ⚠️ **Still open, needs you.** Deleting them was blocked by a tool permission in this session. Delete them or add `requirePermission`. |
| A3 | **A production database backup is committed to git.** It holds real user, financial and staff data. | `jeton_db_backup_2026-03-09.sql` (245 KB), `Backup/jeton_backup_2026-03-08.sql` | Planned for Phase 0b. Remove the files, purge them from history, and rotate any secrets or password hashes they contain. |
| A4 | **Anonymous passkey challenges could be taken by another login.** The login flow used whichever unexpired anonymous challenge happened to be in the table, so two logins at once could steal each other's challenge. | `lib/passkeys.js` `consumeChallenge({userId:null})` | ✅ The challenge is now tied to the browser with an httpOnly cookie (`consumeChallengeById`) |
| A5 | **Route guard opened the whole `/app/dashboard/*` tree to every role.** `/app/dashboard` was an open *prefix*, so every DRAIS control page and the integrations page skipped their permission check. | `components/layout/RoutePermissionGuard.js` | ✅ The dashboard is now an exact-match exception |
| A6 | **The integrations page lived outside the protected tree.** It sat at `/dashboard/integrations`, which the middleware does not cover, while the sidebar linked to `/app/dashboard/integrations`, which returned 404. | `src/app/dashboard/integrations` | ✅ Moved under `/app`. The old URL redirects. |
| A7 | **Each route created its own `pg.Pool`.** This bypassed the shared pool's SSL, retry and cold-start handling, and every Pool opened extra connections to Neon. | 9 files contained `new Pool(` | ✅ 6 files moved to the shared pool. The 3 files in A2 are still open. |
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

### Phase 0: Stop the bleeding (security) ✅ mostly done
- ✅ Superadmin guard on the 5 open admin/user endpoints (A1).
- ✅ Shared DB pool for those routes plus `auth/me/presence` (A7).
- ✅ Route-guard prefix bug (A5), integrations moved under `/app` (A6), permission cache cleared on sign-in and sign-out (A8).
- ✅ Passkey challenges tied to the browser (A4).

**Phase 0b: needs an owner. Do this first.**
1. Delete `api/follow-ups`, `api/operations-log` and `api/systems/[id]/tech-stack` (A2). None has a caller in the UI.
2. Remove `jeton_db_backup_2026-03-09.sql` and `Backup/*.sql` from the repo **and from git history** (`git filter-repo`), then rotate DB credentials and force a password reset for affected users (A3).
3. Add `*.sql` dumps, `Backup/` and `.env*` to `.gitignore`.
4. Run a one-off check: grep every `route.js` for handlers that lack `requirePermission` / `verifyAuth` / `guardSuperAdmin`, and have CI fail on any new ones (see Phase 4).

### Phase 1: Fix the reported UX defects ✅ done
- ✅ Dashboard numbers right on the first launch (C).
- ✅ Biometric setup findable and working on every device class, with diagnosable errors (B1–B3).
- ✅ Real change-password flow, and the Settings profile block fixed (B4).
- ✅ Intelligence routes merged into `/app/intelligence/*` with redirects. Broken sidebar links fixed (`/app/engineering`, `/app/dashboard/integrations`) (D).

Deploy note: set `WEBAUTHN_RP_ID` (for example `jeton.example.com`) and `WEBAUTHN_ORIGIN` (for example `https://jeton.example.com,https://www.jeton.example.com`) in production. Without them, the request origin is used, which works but is less strict.

### Phase 2: Consolidate domains and routes (about 2–3 weeks)
1. **People:** keep one `staff` model. Merge `/app/hr` and `/app/hrm` into tabs under `/app/staff` (Directory · Departments · Payroll/Payouts · Accounts). Add a migration that folds `employees` into `staff`, and keep `api/employees` as a thin alias for one release.
2. **Documents:** one tree, `/app/documents/{library,templates,generated,settings}`. Retire `/app/admin/documents/*` by redirecting it. Keep `/verify/*` as the only public tree.
3. **Knowledge / tech stack:** migrate `knowledge_articles` → `knowledge_assets` and `tech_stack_entries` → `tech_stacks`, then delete `api/knowledge-base` and `api/tech-stack`.
4. Delete the redirect-only pages (`/app/assets`, `/app/resources`, `/dashboard`, `/designs`, `/dashboard/integrations`) now that `next.config.mjs` handles them.
5. **Make the route registry authoritative.** Add a `routeRegistry` (path → permission) that covers *every* page, not just nav items, and generate the sidebar from it. Fail the build if a `page.js` has no registry entry.

### Phase 3: One way to do each thing (about 3–4 weeks)
1. **Server auth API:** a single `lib/auth/` module exporting `getAuth(request)`, `requirePermission(request, 'module.action')` (one signature), `guardSuperAdmin`, and `getCurrentUser()` for RSC. Delete `rbac.js`, `authorization-engine.js` and the static role matrix in `permissions.js` once call sites are migrated. Have a codemod rewrite the `(req,'a','b')` call sites.
2. **API envelope:** add `ok(data, init)` / `fail(status, message, code)` helpers and adopt `{ success, data } | { success:false, error, code }` everywhere, `/api/auth/me` included. Move route handlers to a `withRoute({ permission }, handler)` wrapper that also turns `DatabaseUnavailableError` into a 503 and validates input with `zod` (already a dependency).
3. **Client data layer:** one `apiClient` that returns the envelope (no `.json()` shim), plus one `useApi(key, fetcher, {refreshInterval})` hook with a cache and stale-while-revalidate (SWR or TanStack Query). Delete `api-client.js`, `useFormSubmit` and the ad-hoc fetches.
4. **Feedback UI:** keep `ui/Toast` and one confirm dialog. Remove `react-hot-toast`, `react-toastify` and `sweetalert2`.
5. **Aggregates:** a single `lib/metrics/` service that the dashboard, command center, control tower and intelligence overview all read from. Retire the duplicated SQL in 5 routes.
6. **Events and audit:** one `recordEvent({type, actor, entity, payload})` that writes the audit log and fans out to activity feeds and notifications. Replace `audit.js`, `rbac-audit.js`, `system-logs.js`, `events.js` and `system-events.js`.

### Phase 4: Delivery safety net (runs alongside Phase 2)
1. `eslint` (next/core-web-vitals and react-hooks) plus `tsc --checkJs` on `lib/`. Use a `jsconfig` with `checkJs` and move gradually to TypeScript.
2. **Tests:** Vitest unit tests for `lib/permissions`, `lib/passkeys`, `nav-permissions` and the invoice/pricing engines. Playwright smoke tests: login → dashboard shows numbers without a reload; register a passkey with Chromium's virtual authenticator; old intelligence URLs redirect.
3. **Route-auth lint:** a script that fails CI if any `src/app/api/**/route.js` handler lacks an auth guard, unless it is on an explicit public allowlist (`health`, `version`, `auth/login`, `auth/register`, `passkeys/authenticate*`, `pricing/system/*`, DRAIS webhook).
4. **GitHub Actions:** install → lint → typecheck → test → `next build` on every PR.

### Phase 5: Data layer and repo hygiene (about 1–2 weeks)
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
