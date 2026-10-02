# Jeton — Architectural Audit

Audit date: 2026-10-02 · Baseline commit: `d580310` · Next.js 16.1.1 · React 19.2.3

Scope: repository-wide audit of routing, API contracts, authorization, database
integrity and the specific reported failures. Produced by static tracing across
152 page routes and 291 API route files, cross-referenced against the live
schema.

## Method and its limits — read this first

**What backs each finding below:**

- Static tracing of the full path: UI → state → request → API → SQL → response.
- Live schema and data reads against the production Neon database over its
  HTTPS SQL endpoint.
- Production build (`npm run build`), run before and after changes.

**What does NOT back them:** no finding here was reproduced in a running
browser session. Two blockers:

1. **Port 5432 is blocked from the audit machine.** TCP to the Neon host
   completes, then the server never answers the Postgres SSLRequest. Port 443
   to the *same IP* completes TLS in ~1.3s. So a middlebox blocks the Postgres
   port for every process on this machine, not just one. `/api/health` returns
   `{"database":"disconnected"}`. The app cannot talk to its own database here.
2. **No authenticated session.** Every `/app/*` route 307s to `/login`, so UI
   workflows could not be driven.

Consequently: compile-level and contract-level verification is real; **end-to-end
workflow verification is not done.** Items marked `NEEDS UI VERIFICATION` must
be exercised by a human on an environment with database access before being
considered closed.

**There is no test infrastructure.** No ESLint, no TypeScript compiler, no test
runner is installed or configured; `package.json` has only `dev`, `build`,
`start` and `check:contrast`. So "run lint / typecheck / existing tests" had
nothing to run, and no regression tests were added — there is no harness to add
them to. Standing up Vitest + Playwright is itself a P1 backlog item (B-1).

---

## P0 — Security

### P0-1 Unauthenticated staff + login account creation (FIXED)

`POST /api/admin/staff/create-with-account` had **no authentication of any
kind**. It creates a staff record and a user account from an unauthenticated
body, taking `role_name` from the caller — and **creates that role if it does
not exist**. Any anonymous caller who knew the path could mint an account with
arbitrary privileges.

- Data-integrity risk: arbitrary staff/user/role rows.
- Security risk: full unauthenticated privilege escalation.
- Fix: gated behind `staff.assign_any_role`.
- `NEEDS UI VERIFICATION`: confirm the legitimate staff-creation screen still
  works for an authorised admin.

### P0-2 Unauthenticated salary data (FIXED)

`GET /api/salary-accounts` had no authentication — anonymous read of every
staff member's compensation. `POST` likewise allowed anonymous salary
assignment.

- Fix: `GET` → `finance.view`, `POST` → `finance.manage`. Also moved off its
  private `new Pool()` onto the shared `db.js` layer.

### P0-3 Unauthenticated session invalidation / IDOR (FIXED)

`POST /api/auth/sessions/invalidate` had no authentication and accepted an
arbitrary `user_id`, calling `invalidate_user_sessions(...)`. Anyone could
force-log-out any user, including superadmin — a trivial denial of service.

- Fix: requires a session; callers may only invalidate their own sessions
  unless they hold `users.manage`.

### P0-4 Remaining unguarded routes (NOT FIXED — backlog B-2)

18 further route files contain no `requirePermission` call. Most are
legitimately public (`auth/login`, `auth/register`, `auth/logout`, `auth/me`,
`health`, `version`, `setup-password`, passkey options). These are **not**
clearly legitimate and each needs a decision:

| Route | Concern |
|---|---|
| `api/admin/data-consistency` | admin surface, no guard |
| `api/admin/licenses/validate` | admin surface, no guard |
| `api/assets` | no guard |
| `api/follow-ups` | no guard |
| `api/resources` | no guard |
| `api/profile/avatars` | no guard |
| `api/operations-log` | no guard |
| `api/systems/[id]/tech-stack` | no guard; also see P1-2 |
| `api/pricing/system/[system]` | no guard |
| `api/drais/webhook` | needs signature verification, not a session |

I did not blanket-patch these: several are called by unauthenticated flows and
guessing the right permission risks breaking working features. They need
per-route decisions.

---

## P1 — The dominant systemic defect

### P1-1 36 enforced permissions have no database row (MIGRATION WRITTEN, NOT RUN)

This is the single largest root cause found, and it explains several
independently-reported "feature is broken" complaints.

`permissions.hasPermission()` resolves a grant by `(module, action)`. I
extracted every permission string enforced across all 291 API route files and
every permission referenced by `navigation-config.js`, then diffed against the
`permissions` table:

- **30 distinct permission strings used by 104 API route files have no row.**
- **15 of 43 navigation permissions have no row.**
- **13 modules are absent outright**: `allocations`, `bug_tracking`,
  `decision_logs`, `drais`, `hrm`, `integrations`, `intelligence`,
  `issue_intelligence`, `knowledge`, `media`, `obligations`, `offerings`,
  `pricing`.

A permission with no row **can never be granted to any role**. So those
endpoints return 403 for every non-superadmin, and the matching nav entries are
invisible to them.

**Why this went unnoticed:** `requirePermission` returns early for
`role === 'superadmin'`, bypassing the check entirely. The founder account is
superadmin, so every one of these features works for the founder and is dead
for all staff. That asymmetry is the signature of this bug, and it is worth
checking any future "works for me" report against it.

Direct consequences for reported issues:

| Reported problem | Missing permission | Routes blocked |
|---|---|---|
| Tech Intelligence cannot add stacks | `systems.edit`, `systems.delete` | 14 |
| Documents detail/folders/templates | `documents.manage` | 14 |
| Decision Log inaccessible | `activity_logs.view`, `decision_logs.view` | 3 |
| Pricing plans (earlier session) | `pricing.*` | 10 |
| Subscriptions | `subscriptions.*` | 12 |

**Delivered:** `migrations/981_seed_missing_permissions.sql` — additive,
idempotent (`ON CONFLICT (module, action) DO NOTHING`), seeds all 36
definitions. It deliberately **grants nothing**: it only makes the permissions
grantable, so running it changes no user's access until an administrator
assigns them to roles. That grant step is a deliberate human decision, not
something to automate in a migration.

`NEEDS DB RUN`: not executed. Writes to the production database were blocked by
this environment's safety policy.

### P1-2 `params` not awaited in 61 route files (1 FIXED, 60 NOT — backlog B-3)

This is Next.js 16, where route `params` is a Promise. 61 route files do
`const { id } = params` instead of `await params`, so `id` is `undefined`.
Queries then run with `NULL`, producing empty reads and "not found" writes —
silent, confusing failures rather than errors. 164 routes do it correctly, so
this is an inconsistency, not a convention.

An earlier session fixed `systems/[id]/plans`, where this caused a 404 on every
pricing-plan create. `systems/[id]/tech-stack` has the same bug and is part of
the Tech Intelligence failure (P1-3).

Not fixed wholesale here: 60 files, each needing its own verification, is too
large to land safely without a test harness.

---

## P2 — Duplicated business entities

### P2-1 Four competing technology models (NOT FIXED — backlog B-4)

`/app/tech-intelligence` is served by four overlapping API surfaces:

- `api/tech-stack`
- `api/tech-stacks` (+ `/[id]`, `/items`, `/credentials`)
- `api/systems/[id]/tech-stack`
- `api/systems/[id]/tech-profiles`

`system_tech_stack` is a flat denormalised row —
`(system_id, language, framework, database, platform, notes)`. That is the
opposite of the requested architecture: there is **no technology catalog**, so
"Next.js" is re-typed as a string for every system that uses it, exactly the
duplication the brief forbids.

A correct model needs two tables — `technologies` (catalog: name, category,
vendor, website, status) and `system_technologies` (usage: system_id,
technology_id, version, notes) — plus a migration folding the existing flat
rows into it. That is a genuine re-architecture, not a patch, and it is
specified as B-4 rather than half-done here.

### P2-2 HRM / staff / hr triplication (NOT FIXED — backlog B-5)

Three parallel route trees exist: `/app/hrm`, `/app/hr`, `/app/staff`. `/app/hr`
is nav-orphaned. The `permissions` table has an `employees` module **and** a
`staff` module with overlapping actions, which suggests two entity models for
one domain. Consolidating this requires knowing which is authoritative for live
employee data — a data-model decision needing your input, and one that must not
be guessed at while payroll rows point at it.

### P2-3 Employee termination (NOT FIXED — backlog B-6)

Not investigated in depth this pass. Flagged as requested: termination and row
deletion are different operations, and the lifecycle
(`active → terminated`, with effective date, reason, actor, audit row, and
session revocation) does not yet exist. Deserves the same treatment the deal
deletion policy got in the previous session.

---

## Fixed this pass

### F-1 `e.map is not a function` on `/app/financial-intelligence` (FIXED)

A genuine API/frontend contract break, not bad data.

`GET /api/capital-allocation` returns:

```json
{ "success": true, "data": { "rules": [], "allocations": [], "total_revenue": "0" } }
```

The page read it one level too high:

```js
setRules(allocRes.data || []);            // data is an OBJECT
setSummaries(allocRes.summaries || []);   // does not exist here
setTotalRevenue(parseFloat(allocRes.total_revenue || 0)); // does not exist here
```

`allocRes.data` is the wrapper object. An object is truthy, so `|| []` never
fired, `rules` was set to an object, and the next render hit `rules.map(...)` →
`e.map is not a function` in the minified bundle. The other two silently
resolved to `[]` and `0`, so allocation totals never displayed even when the
page did render — a second, quieter bug from the same mistake.

Fix: read `data.rules` / `data.allocations` / `data.total_revenue`. Added an
`asArray(value, fieldName)` helper that returns `[]` **and logs the offending
field name** — deliberately not a silent `|| []`, so the next contract break is
visible instead of resurfacing as `.map` on a minified variable. Added the
error state and retry the page lacked entirely (a failed load previously
rendered as a silently empty page) and an empty state for allocation rules.

`NEEDS UI VERIFICATION`: zero / one / many rules, and a forced API failure.

### F-2 Decision Log accepted one character at a time (FIXED)

Root cause: `DecisionForm` was declared **inside** `DecisionLogPage`'s body.
Every keystroke calls `setForm`, re-rendering the page and producing a **new
function identity** for `DecisionForm`. React compares element types by
identity, so it unmounted the entire form and mounted a fresh one on every
character — the input lost its DOM node and its focus each time. The user had to
click back in before typing the next letter, which presents exactly as "only one
character can be entered".

Fix: hoisted `DecisionForm` to module scope with `form`, `setForm`, `saving`,
`departments` passed as props. Identity is now stable across renders.

`NEEDS UI VERIFICATION`: sustained typing, paste, textarea fields, edit an
existing decision, save, reopen.

### F-3 Dead navigation links: 2 → 0 (FIXED)

- **`/app/engineering`** was advertised in nav but no page existed — a 404.
  The real engineering surface, `/app/issues` (293 lines, auto-logged errors +
  manual issue reports), was itself unreachable from nav. Rather than duplicate
  the module, nav now points at `/app/issues`, and `/app/engineering/page.js` is
  a redirect so older links keep resolving.
- **`/app/dashboard/integrations`** was advertised in nav, but the page lived at
  `src/app/dashboard/integrations/` — a second route tree *outside* `/app`,
  therefore outside `middleware.ts`'s `PROTECTED_PREFIXES` (`/app`,
  `/setup-password`) and outside `AppLayout`'s session guard. Moved into
  `src/app/app/dashboard/integrations/`, which fixes the dead link and brings
  the page inside the protected tree. (It is a client component, so its data was
  always API-gated — the shell was reachable anonymously, but no data leaked.)

`src/app/dashboard/page.js` is a deliberate documented `/dashboard` →
`/app/dashboard` compatibility redirect and was left alone.

---

## Not addressed — backlog

Jeton has no issue tracker reachable from this environment, so these are
recorded here rather than silently dropped. Each is specified enough to pick up.

| ID | Item | Priority |
|---|---|---|
| B-1 | Stand up test infrastructure (Vitest + Playwright); no harness exists | P1 |
| B-2 | Decide a guard for each of the 10 unclear unguarded routes (P0-4) | P0 |
| B-3 | Sweep `await params` across the remaining 60 route files | P1 |
| B-4 | Re-architect technology model: `technologies` catalog + `system_technologies` usage; fold in `system_tech_stack`; retire 3 of the 4 APIs | P2 |
| B-5 | Consolidate `/app/hrm`, `/app/hr`, `/app/staff`; reconcile `employees` vs `staff` entities | P2 |
| B-6 | Employee termination lifecycle with audit + session revocation | P1 |
| B-7 | `/app/documents` detail view — not investigated this pass | P1 |
| B-8 | Invoice themes end-to-end (create → preview → select → rendered invoice) — not investigated | P1 |
| B-9 | Design editor foundation + PSD import — **not started**, see below | P3 |
| B-10 | 31 `/app` pages unreachable from navigation — triage: link, merge or delete | P3 |
| B-11 | Consolidate alias permissions (`systems.edit` vs `systems.manage`, `staff.edit` vs `staff.update`, `clients.edit` vs `clients.update`) rather than carrying both | P2 |
| B-12 | 9 routes bypass `db.js` with private `new Pool()`, losing retry/timeout/`DatabaseUnavailableError` handling | P2 |
| B-13 | 2 invoices still read "Unknown Client" (Albayan, XHV-INV-2026-0022/0023) — data backfill pending approval | P1 |
| B-14 | Unblock port 5432, or standardise on Neon's HTTPS driver, so the app can reach its database from developer machines | P0 |

### On the design editor (B-9)

Nothing was implemented. Being direct, because the brief asked for honesty here:
a browser-based editor that meaningfully displaces Photoshop is a multi-quarter
product in its own right, not a remediation item alongside 13 other repairs. It
should not be started until the P0/P1 items above are closed.

When it is started, the sequencing question that matters most is the document
model — a layer tree with non-destructive adjustments, serialisable and
versionable — because that is the decision which, if taken wrongly, forces the
rewrite the brief warns about. Canvas, tools and export all follow from it.

On PSD import specifically: no library in the current dependency set reads PSD.
`ag-psd` is the realistic candidate and can extract layer trees. Full fidelity
is not achievable — Photoshop's adjustment layers, layer styles and smart
objects have no faithful web equivalent. The honest shape is layer-tree
extraction plus a flattened composite fallback, and the UI must say which one
the user got. Claiming layered PSD fidelity would be the false-success failure
the brief explicitly rejects.

---

## Baseline

| Check | Result |
|---|---|
| `npm run build` | passes, exit 0, 202 pages (before: 201) |
| Lint | not installed |
| Typecheck | not installed (note: `middleware.ts` is TypeScript with no typechecker) |
| Tests | none exist |
| Dead nav links | 2 → 0 |
| Unguarded P0 routes | 3 fixed, 10 outstanding |
