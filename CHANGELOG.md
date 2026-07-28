# Jeton Changelog

Format: `MAJOR.MINOR.PATCH — YYYY-MM-DD — one-line reason`

Bump rules (used by `scripts/version.js`):

- **MAJOR** — architectural rebuild, breaking data-model change, module rewrite
  at the scale of the communication or invoice engine rewrites, or anything
  that requires a coordinated migration + deploy.
- **MINOR** — new feature or module (a new page, a new dashboard, a new
  end-to-end capability like prospect intelligence or media messaging).
- **PATCH** — bug fix, polish, copy change, additive idempotent migration,
  "coming soon" states, small UX improvements.

## 1.1.1 — 2026-07-28 — fix build: force-dynamic on new authenticated pages

## 1.1.0 — 2026-07-27 — invoice theme editor UI with live preview

## 1.0.1 — 2026-07-27 — fix sidebar first-load flash + introduce versioning system

## 1.0.0 — 2026-07-28 — post-rebuild baseline

First tagged version. Consolidates months of work into a single production
baseline: identity architecture recovery, communication module rewrite
(direct + group + department channels, polling realtime, notifications,
RBAC hardening), prospects intelligence dashboard with dormancy engine,
invoice engine rebuild with theming + QR verification + audit trail +
historical import + deal reconciliation, and DRAIS shadow consumer.
