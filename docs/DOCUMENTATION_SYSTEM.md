# Jeton — Documentation & Contract Management

Status of this document: the audit in Part A is complete and every finding was
reproduced against the live database or the actual source. Part B describes the
architecture as implemented. Part C lists what is explicitly **not** built yet.

Nothing in Part B is aspirational. If a capability is listed in Part C it does
not exist in code.

---

## Part A — Audit of the pre-existing system (2026-10-15)

### A.0 Baseline before any change

`package.json` exposes four scripts: `dev`, `build`, `start`, `check:contrast`.
There is **no linter, no type-checker and no test runner** installed. The
baseline check is therefore `npm run build`, which passed before these changes
(three `Dynamic server usage` notices on `/docs/architecture`, `/login` and
`/register` are pre-existing and caused by prerender probing of routes that read
cookies).

### A.1 Two unrelated systems both called "documents"

The repository contains two document systems that share a name, a URL prefix and
one table, but nothing else:

| | Knowledge base | Contract generation |
|---|---|---|
| Core table | `documents` | `generated_documents` |
| Versions | `document_versions` | *(none)* |
| Approvals | `document_approvals` | *(none — FK points at `documents`)* |
| Audit | `document_audit_logs` → `generated_documents` | same table |
| Pages | `/app/documents/*` | `/app/admin/documents/*` |

Note the crossed wiring in the last two rows: `document_approvals.document_id`
references `documents.id`, so **issued contracts had no approval workflow at
all**, while `document_audit_logs.document_id` references
`generated_documents.id`, so the knowledge base had no audit trail. Each system
was using the other's table.

The page trees are also duplicated. `/app/documents/{templates,settings,verify,generated}`
are thin `Suspense` wrappers around `src/components/documents/*`, while
`/app/admin/documents/{templates,settings,verify,generated}` are separate
full implementations of the same four screens — roughly 1,200 lines of parallel
UI over one API.

### A.2 Issued documents were not immutable — they had no content at all

This was the most consequential architectural defect.

`generated_documents.html_content` exists as a column and was **never written
and never read** anywhere in the codebase (`grep -rn html_content src` returned
nothing). Both issued documents in the live database have `html_content IS NULL`.

Content was instead re-derived from the **live, mutable** template on every
read. `PUT /api/documents/templates/[id]` overwrites `document_templates.body`
in place with no version record. The consequence:

> Editing a template silently rewrote the content of every contract ever
> generated from it. An NDA issued in January would show February's terms.

There was no template version table, no clause record, and no snapshot — so
there was no way to recover what a document actually said when it was signed.

### A.3 Every downloaded PDF contained raw, unsubstituted placeholders

`GET /api/documents/pdf/[id]` called:

```js
formatDocumentWithBranding(document.template_body, branding, ...)
```

It passed the **template body**, not the substituted content. `placeholder_data`
was selected in the same query and never used. Every PDF therefore contained
literal `{{recipient_name}}`, `{{start_date}}` and so on.

The route could not actually reach that bug, because it also did
`const { id } = params` without `await`. On Next.js 16 `params` is a Promise, so
`id` was `undefined` and the route returned 400 on every request. The same
unawaited-`params` pattern exists in 25 route files repository-wide.

### A.4 The public verification endpoint exposed every contract

`GET /api/documents/verify` is intentionally public — `middleware.ts` excludes
`/api` and the route performs no authorization. It returned:

- `recipient_name`, `recipient_email`
- `rendered_body` — **the full contract text with all placeholder data substituted**

The token check was:

```js
if (token && doc.verification_token !== token) { /* reject */ }
```

Omitting `token` entirely skipped the check. Documents are addressed by
`unique_id`, which is `XTN-<TYPE>-<YEAR>-<0001>` — sequential and trivially
enumerable. Anyone on the internet could walk `XTN-EMP-2026-0001`, `0002`, …
and read every employment agreement, NDA and salary figure Jeton had issued.

### A.5 The same endpoint also crashed, three ways

Proven against the live database:

| Input | Result |
|---|---|
| `ip_address = '1.2.3.4, 5.6.7.8'` (Vercel's normal `x-forwarded-for`) | `invalid input syntax for type inet` |
| `ip_address = 'unknown'` (the route's own fallback) | `invalid input syntax for type inet` |
| `document_id = NULL` (the route's not-found branch) | `violates not-null constraint` |

So on Vercel the happy path raised a 500, and an unknown ID returned
`500 "Verification failed: null value in column …"` instead of a clean 404 —
leaking the schema to anonymous callers via `error.message`.

### A.6 Injection and crypto defects in the generation engine

`src/lib/document-generation.js`:

- **HTML injection.** `substitutePlaceholders` inserted values raw, and
  `formatDocumentWithBranding` interpolated branding fields raw, into HTML that
  is rendered in the browser and fed to Puppeteer. A value such as
  `<script>…</script>` or `<img onerror=…>` executed. Branding is editable from
  settings, making it stored XSS.
- **Regex injection.** `new RegExp(`{{${key}}}`, 'g')` built a pattern from the
  data key, so a key containing regex metacharacters corrupted or crashed
  substitution.
- **Silent data loss.** `String(value || '')` turned a missing, `null`, `0` or
  `false` value into an empty string. A contract could be issued with a blank
  salary or a blank date and look perfectly normal.
- **Forgeable verification.** `generateVerificationHash` defaulted to
  `process.env.VERIFICATION_SECRET || 'default-secret'`. With the env var unset
  — it is not in `.env.local` — every hash was computed from a constant that is
  committed to the repository, so anyone could forge one.
- **Crash on malformed input.** `validateVerificationHash` called
  `crypto.timingSafeEqual` without a length check. `timingSafeEqual` throws when
  buffer lengths differ, so a short `hash` produced a 500 rather than "invalid".
- **Colliding document IDs.** `generateUniqueDocumentId` used
  `SELECT COUNT(*) … + 1`. Two concurrent generations compute the same sequence,
  and one fails on the unique index; after any deletion the counter walks
  backwards into IDs already issued.

### A.7 PDF generation could not work in production

`package.json` depends on full `puppeteer` (`^25.0.2`), which downloads and
expects a local Chromium. The target is Vercel serverless, where that does not
run; the supported approach is `puppeteer-core` with a serverless Chromium
build. Separately, `POST /api/documents/generate` launched Puppeteer, produced
`pdfBuffer`, **discarded it**, and stored a URL pointing back at the regenerating
route — paying the full cost of a browser launch for nothing.

The QR code embedded in every PDF was the hard-coded string
`iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ…`, a 1×1 transparent pixel, under
the caption "Verify authenticity". `qrcode.react` was already a dependency.

### A.8 No clause engine, no profiles, no lifecycle, no subject

Absent entirely — not partially built:

- clauses and clause libraries, clause versioning, clause compatibility rules
- template profiles (the "standard / enhanced / strict / custom" requirement)
- template versions, and template status beyond a single `is_active` boolean
- legal metadata: jurisdiction, governing law, reviewer, review dates
- any link from an issued document to the **employee it concerns**.
  `generated_documents` stores `recipient_name` as free text and has no FK to
  `staff`. This is the same class of defect as the invoices that displayed
  "Unknown Client".
- signature state, participants, retention policy, renewal or amendment

### A.9 Template management was superadmin-only by accident

Eight document routes require `documents.manage`. That permission **does not
exist** in the `permissions` table. `requirePermission` returns early for
`superadmin`, which masked the gap — so template create/edit/delete and document
revocation silently denied every non-superadmin, including users explicitly
granted document rights.

---

### A.10 Two more constraints narrower than the code that wrote to them

Found by running the lifecycle end to end, not by reading:

- `document_audit_logs.action` allowed only
  `generated, viewed, downloaded, revoked, restored, updated`. The pre-existing
  edit handler wrote `'edited'`, inside a bare `try {} catch {}` — so **every
  edit to a generated document silently failed to be audited**.
- `document_verification_logs.verification_status` allowed only
  `success, failed, tampered`. The public verify route wrote `'not_found'`,
  `'revoked'` and `'expired'`, each of which raised a constraint violation that
  the outer catch turned into a 500 carrying the Postgres message.

Both widened in migration 990.

### A.12 Two UI defects found while making the token mandatory

- **The verification portal crashed.** `src/app/app/admin/documents/verify/page.js`
  rendered `<Link>` without importing it, so pressing "Verify Document" threw a
  `ReferenceError` and nothing happened. The page also told the reader that
  "verification URLs can be shared publicly without authentication" — true, and
  precisely the vulnerability in A.4.
- **Token-less public links.** Three places linked to `/verify/{id}` with no
  token: the portal, the generated-documents list, and the verification-log
  viewer. Once a token is required those all land on "no matching document",
  which reads as a bug rather than as the security boundary it is. The portal
  now accepts a pasted link or an id plus token; the list drops the link
  (tokens are deliberately absent from list responses); the detail page uses
  the tokenised `verification_url` the API returns, and shows a disabled
  control with an explanation when the caller may not read the token; the log
  viewer links to the internal document page instead.

### A.11 Summary of audited defects

| # | Defect | Severity | Fixed in |
|---|---|---|---|
| 1 | Public endpoint served full contracts + PII to anyone, no token needed, sequential ids | Critical | verify route, policy `token_required` |
| 2 | Issued documents had no content snapshot; template edits rewrote history | Critical | 989, service layer |
| 3 | Every PDF contained raw `{{placeholders}}` | Critical | pdf route |
| 4 | PDF route returned 400 always (`params` not awaited) | High | pdf route |
| 5 | Verification secret defaulted to a string in version control | Critical | `document-generation.js` |
| 6 | Placeholder/branding values interpolated into HTML unescaped (stored XSS) | High | template engine |
| 7 | Document numbers from `COUNT(*)+1` — collide, and reuse after deletion | High | 989 counter table |
| 8 | `timingSafeEqual` threw on a short hash, 500 instead of "invalid" | Medium | `validateVerificationHash` |
| 9 | `inet` column fed `'unknown'` and comma-joined XFF, 500 on the happy path | High | `clientIp()` |
| 10 | Verify logged `document_id = NULL` against a NOT NULL column, 500 | Medium | verify route |
| 11 | `documents.manage` permission never existed; 8 routes superadmin-only by accident | High | 989 |
| 12 | Revoking via PATCH wrote 4 non-existent columns, 500 | High | generated/[id] route |
| 13 | Executed contracts editable in place, no amendment trail | High | generated/[id] route, 989 |
| 14 | Hard delete of any issued document, unaudited | High | generated/[id] route |
| 15 | Audit/verification CHECK vocabularies too narrow; audit silently dropped | Medium | 990 |
| 16 | `expires_in_days` defaulted to 365 for every document type | Medium | policy setting |
| 17 | Puppeteer launched, PDF discarded, URL pointed at a regenerating route | Medium | `document-pdf.js` |
| 18 | "Verification QR" was a 1x1 transparent pixel | Medium | real QR via `qrcode.react` |
| 19 | Markdown template bodies never rendered | Medium | template engine |
| 20 | No clauses, profiles, versions, lifecycle, signatures, retention, employee link | Architectural | 989 + service layer |
| 21 | Verification portal threw ReferenceError (`Link` not imported) | Medium | verify portal page |
| 22 | Three token-less `/verify/{id}` links, now dead ends | Medium | portal, list, detail, log viewer |

---

## Part B — Architecture as implemented

### B.1 Domain model

```
document_templates ──┬── document_template_versions   (immutable publish history)
                     └── document_template_profiles ── document_profile_clauses ── document_clauses
                                                                                        │
                                                                     document_clause_versions (immutable)

generated_documents ──┬── generated_document_clauses  (exact clause versions used)
                      ├── document_signatures         (signature STATE only)
                      ├── document_approvals          (shared table, second subject column)
                      ├── document_audit_logs
                      └── generated_document_logs
                      └─> subject_staff_id -> staff   (no second employee store)
```

`document_policy_settings` is a singleton row holding company policy;
`document_number_sequences` holds one monotonic counter per `TYPE-YEAR`;
`document_retention_policies` describes how long each document type is kept.

### B.2 The immutability rule

A generated document stores, at generation time and never afterwards:

| Column | What it freezes |
|---|---|
| `template_version_id` | which published template version produced it |
| `html_content` | the fully composed, substituted body |
| `content_hash` | SHA-256 of that body, for tamper detection |
| `clause_manifest` | the exact clause ids, versions and order, as JSON |
| `resolved_data` | the data actually substituted, not the raw request |

**Nothing downstream re-renders.** The PDF route, the detail page and the
public verification page all read `html_content`. Verified by test: rewriting
the template body *and* a clause body leaves an issued document byte-identical,
with an unchanged hash.

A correction to an issued document does not edit it. Generating with
`amends_document_id` creates a new document at `revision + 1` and moves the
original to `superseded`, leaving its content intact.

### B.3 Trust boundary in the template engine

`src/lib/document-template-engine.js`

- **Template and clause bodies are trusted HTML.** They are authored by holders
  of `documents.manage` and are meant to contain markup, so they are emitted
  as-is.
- **Placeholder values are untrusted and always HTML-escaped.**
- The template is scanned once with a single regex. No pattern is ever compiled
  from data, which is what made a data key containing regex metacharacters
  corrupt the output before.
- Missing values are **reported, never invented**. `0` and `false` count as
  present; only `undefined`, `null` and blank strings are absent. Generation
  refuses a document with an unfilled required field rather than issuing a
  contract with a blank salary that looks correct.
- Syntax: `{{name}}`, `{{#if name}}...{{else}}...{{/if}}`, `{{#unless name}}`,
  dotted paths, and `{{clauses}}` as the clause-set slot. An unbalanced
  template is an error at publish time, not a silently mis-rendered contract.

### B.4 Lifecycle state machines

Template: `draft -> review -> approved -> published -> deprecated -> archived`.
Editing the body of a published template returns it to `draft`; the published
version stays in force until someone publishes again.

Document: `draft -> pending_approval -> approved -> issued -> executed`, with
`rejected`, `cancelled`, `expired`, `superseded` and `archived` as exits.

Signature state: `not_required -> prepared -> pending -> partially_signed ->
signed_uploaded -> executed`, plus `declined`.

### B.5 Signatures — what is and is not claimed

Jeton has **no electronic-signature capability** and does not imply one. It
records who is expected to sign, stores a signed copy that a human uploads, and
notes who recorded it and when. A document becomes `executed` only when every
*required* party has a copy on file. None of these states asserts that a
signature is legally valid. `document_signatures.provider` and
`provider_reference` are reserved, null, and exist so a real provider can be
added later without a schema change.

### B.6 Legal posture

Jeton records legal metadata; it does not determine legal effect.
`governing_law`, `jurisdiction`, `legal_reviewer`, `legal_reviewed_at` and
`next_review_date` are captured on templates and clauses and **copied into each
published version**, so an old contract can be read against the law it was
issued under. `document_policy_settings.require_approved_templates` lets a
company forbid generation from anything but a published template, and
`require_legal_review` on publish refuses to publish a template with no
recorded reviewer.

Profile `tier` orders profiles in the UI and carries **no** legal meaning. The
effect of a document comes from its clauses, its governing law and its context.
Profiles marked `requires_explicit_authorization` additionally demand the
`documents.issue_exceptional` permission.

### B.7 Security model

| Concern | Measure |
|---|---|
| Public verification | Token required by default, compared in constant time; a wrong token returns the same 404 as an unknown id, so ids cannot be enumerated |
| Document body on the public page | Withheld unless `public_show_document_body` is explicitly enabled; a `content_fingerprint` lets a holder check their copy without the text being published |
| Recipient identity | `recipient_email` never returned publicly; the name is masked (`Hamuza A.`) |
| Verification hashes | HMAC-SHA256 with a required `VERIFICATION_SECRET` (16+ chars); no default |
| Token comparison | `safeEqual` / `validateVerificationHash` — constant time, length-checked, cannot throw |
| Authorization | Every route calls `requirePermission` server-side; 8 new permissions seeded in 989 |
| Injection | All data HTML-escaped; branding colours, URLs and sizes validated, `javascript:` and `data:` URLs rejected |
| Error disclosure | `error.message` is never echoed to an anonymous caller |
| Snapshot rendering | Served into a sandboxed `iframe srcDoc` rather than `dangerouslySetInnerHTML` |
| Legal records | Issued documents cannot be hard-deleted; archive or revoke, both audited |

### B.8 PDF rendering

`src/lib/document-pdf.js` probes once whether a browser can launch and caches
the answer. Where it can, it renders a real PDF from the frozen snapshot, with
page numbers and `preferCSSPageSize`. Where it cannot, it returns
`{ ok: false, reason }` and the route serves the same frozen HTML as a
print-ready page with `X-Jeton-Pdf-Fallback: 1`. The document stylesheet
carries the `@page`, `break-inside` and `thead` rules, so the browser's own
"Save as PDF" produces the same pagination.

See Part C for what this means on Vercel.

### B.9 API surface

| Method and path | Purpose |
|---|---|
| `GET/POST /api/documents/templates` | library; create (always as a draft) |
| `GET/PUT/DELETE /api/documents/templates/[id]` | detail; partial update; archive (`?hard=1` only when unused) |
| `POST /api/documents/templates/[id]/publish` | freeze a version and put it in force |
| `GET /api/documents/templates/[id]/versions` | publish history; `?version=N` for a full body |
| `GET/POST /api/documents/templates/[id]/profiles` | restrictiveness profiles |
| `GET/PUT/DELETE /api/documents/profiles/[id]` | profile detail, with per-clause usability |
| `PUT /api/documents/profiles/[id]/clauses` | set the clause set; rejects self-contradicting sets |
| `GET/POST /api/documents/clauses` | clause library |
| `GET/PUT/DELETE /api/documents/clauses/[id]` | clause detail, incl. which issued documents contain it |
| `POST /api/documents/clauses/[id]/publish` | freeze a clause version |
| `POST /api/documents/preview` | compose without writing, via the same code path as generate |
| `POST/GET /api/documents/generate` | generate; list with filters, search, sort, paging |
| `GET/PATCH/DELETE /api/documents/generated/[id]` | detail with clauses/signatures/approvals/activity |
| `POST /api/documents/generated/[id]/approve` | approve or reject (reason required) |
| `POST /api/documents/generated/[id]/issue` | issue, optionally creating signature records |
| `GET/POST/PATCH /api/documents/generated/[id]/signatures` | signature state; record a received copy |
| `GET /api/documents/pdf/[id]` | download from the snapshot |
| `GET/POST /api/documents/verify` | public verification; revoke |
| `GET/PUT /api/documents/policy` | policy, plus honest environment reporting |
| `GET /api/staff/[id]/documents` | an employee's documents and what is missing |

### B.10 Testing

`npm test` — 73 assertions, no framework, no database:

- `tests/template-engine.test.mjs` (39) — escaping, regex-injection inertness,
  missing-value semantics incl. `0` and `false`, conditionals, dotted paths,
  variable discovery, markdown.
- `tests/clause-engine.test.mjs` (34) — required/optional handling, unusable
  clause rejection, document-type restriction incl. the `['']` case, symmetric
  incompatibility, ordering, composition, escaping.

Separately, a 69-assertion end-to-end run was executed against the live
database exercising the real service modules: clause publish, template publish,
profile differentiation, incompatibility refusal, missing-value refusal,
generation with snapshot/manifest/employee link, **the immutability test**,
exceptional-profile authorization, monotonic numbering across a deletion,
verification crypto, approval to issue to partial to executed signature flow,
amendment superseding, reload-from-database, and real PDF output. All 69 passed
and all probe rows were removed. That harness is not committed because it
depends on an HTTPS database shim specific to this machine (port 5432 is
blocked here); the two committed suites are the runnable regression net.

---

## Part C — Not implemented

Stated plainly so nothing above is read as more than it is.

1. **PDF rendering does not work on Vercel.** The repository depends on full
   `puppeteer`, which expects a Chromium in `~/.cache/puppeteer`. That exists
   on a developer machine (PDFs verified here: 2 pages, 75 KB, `%PDF-1.4`) but
   not in a Vercel function. In production every download currently takes the
   HTML fallback. To fix: add `puppeteer-core` and `@sparticuz/chromium` and
   set `PUPPETEER_EXECUTABLE_PATH`; `resolveLauncher()` already prefers it.
2. **`VERIFICATION_SECRET` must be set in Vercel.** It is generated into local
   `.env.local`. Until it is set in the deployment, generation returns 503 by
   design rather than issuing documents with forgeable verification.
3. **No UI for clauses, profiles or the new template lifecycle.** The APIs,
   engine and tests are complete; the admin screens still show the old
   name/description/body form. The NDA configuration workflow is therefore
   API-only today.
4. **Retention is descriptive, not active.** `document_retention_policies` and
   `retention_until` are stored and queryable. Nothing applies them on a
   schedule; `action_at_end` defaults to `review`, and no code deletes or
   anonymises anything.
5. **Approval is single-step.** `document_approvals.step_order` supports a
   chain, but generation opens exactly one step. Multi-step and role-targeted
   routing are not built.
6. **The duplicate page trees remain.** `/app/documents/*` and
   `/app/admin/documents/*` are still two implementations of four screens.
   Consolidating them is a UI task and was not attempted here.
7. **`document_templates` has no unique index on `name`**, so the 409 branch in
   POST is unreachable.
8. **24 other route files still destructure `params` without `await`.** The
   document routes are fixed; the rest of the repository is not.
9. **Template categories are not pre-seeded.** The category list from the brief
   (NDA, employment, contractor, SLA and the rest) is supported by the schema
   and the `category` / `document_type` fields, but no templates ship with the
   system.
10. **No e-signature integration**, by design — see B.5.
11. **Organization-level isolation** is not enforced on documents; Jeton is
    single-tenant today and documents follow that assumption.
