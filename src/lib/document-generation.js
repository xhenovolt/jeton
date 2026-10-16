/**
 * Document generation core — numbering, verification crypto and presentation.
 *
 * This module was rewritten to close six defects that the audit in
 * docs/DOCUMENTATION_SYSTEM.md records in full:
 *
 *   1. Document numbers came from `SELECT COUNT(*) + 1`, which collides under
 *      concurrency and walks backwards into already-issued numbers after a
 *      deletion. Numbering is now an atomic counter row.
 *   2. The verification secret defaulted to the literal string
 *      'default-secret', which is committed to this repository — so every hash
 *      was forgeable. There is no default any more.
 *   3. `validateVerificationHash` called `timingSafeEqual` without a length
 *      check. That function throws on a length mismatch, so a short hash
 *      produced a 500 instead of "invalid".
 *   4. Placeholder values and branding fields were interpolated into HTML
 *      unescaped, giving stored XSS in the preview, the public verification
 *      page and inside Puppeteer. Everything variable is escaped here.
 *   5. The "verification QR code" was a hard-coded 1x1 transparent pixel.
 *      It is now a real QR code rendered as SVG.
 *   6. Substitution lived here and silently blanked missing values. It now
 *      lives in document-template-engine.js, which reports them.
 */

import crypto from 'crypto';
import { escapeHtml } from '@/lib/document-template-engine.js';

export { escapeHtml };

// Re-exported so existing importers keep working while they migrate.
export {
  render,
  renderBody,
  describeVariables,
  substitutePlaceholders,
  markdownToHtml,
} from '@/lib/document-template-engine.js';

/**
 * Allocate the next document number atomically.
 *
 * One row per `<PREFIX>-<YEAR>` scope. `INSERT … ON CONFLICT … DO UPDATE` with
 * `RETURNING` increments and reads in a single statement, so two concurrent
 * generations can never receive the same number, and a deleted document never
 * frees its number for reuse.
 *
 * Pass the transaction's own query function so the number is allocated inside
 * the same transaction as the document row.
 */
export async function generateUniqueDocumentId(prefix, queryFn) {
  const year = new Date().getFullYear();
  const prefixUpper = String(prefix || 'DOC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'DOC';
  const scope = `${prefixUpper}-${year}`;

  const r = await queryFn(
    `INSERT INTO document_number_sequences (scope, last_value)
          VALUES ($1, 1)
     ON CONFLICT (scope) DO UPDATE
            SET last_value = document_number_sequences.last_value + 1,
                updated_at = NOW()
       RETURNING last_value`,
    [scope]
  );

  const sequence = r.rows[0].last_value;
  return `XTN-${prefixUpper}-${year}-${String(sequence).padStart(4, '0')}`;
}

/** A 256-bit URL-safe token. This is the real access credential. */
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * The signing secret.
 *
 * Previously this fell back to the string 'default-secret'. Since that string
 * is in version control, every verification hash in the system was forgeable
 * by anyone who had read the repository. There is no fallback now: generation
 * fails loudly if the secret is absent, which is the correct outcome for a
 * misconfigured deployment.
 */
function verificationSecret() {
  const s = process.env.VERIFICATION_SECRET?.trim();
  if (!s || s.length < 16) {
    const e = new Error(
      'VERIFICATION_SECRET is not configured (needs at least 16 characters). ' +
      'Document verification cannot be trusted without it.'
    );
    e.code = 'VERIFICATION_SECRET_MISSING';
    throw e;
  }
  return s;
}

/** True when a usable secret is configured. Lets routes report config state. */
export function hasVerificationSecret() {
  try { verificationSecret(); return true; } catch { return false; }
}

/** HMAC over the document id. HMAC, not a bare SHA-256 of concatenated parts. */
export function generateVerificationHash(uniqueId) {
  return crypto.createHmac('sha256', verificationSecret())
    .update(String(uniqueId))
    .digest('hex');
}

/**
 * Constant-time comparison that cannot throw.
 *
 * `timingSafeEqual` requires equal lengths and throws otherwise, so the length
 * is checked first and compared without short-circuiting on content.
 */
export function validateVerificationHash(uniqueId, hash) {
  const expected = generateVerificationHash(uniqueId);
  const given = String(hash ?? '');
  if (given.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

/** Constant-time comparison of two opaque tokens of arbitrary length. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  if (x.length !== y.length) return false;
  try { return crypto.timingSafeEqual(x, y); } catch { return false; }
}

/** SHA-256 of the frozen document body, for tamper detection. */
export function contentHash(html) {
  return crypto.createHash('sha256').update(String(html ?? ''), 'utf8').digest('hex');
}

/**
 * Is this document still valid?
 *
 * Now lifecycle-aware. The old version checked only `is_revoked` and
 * `expires_at`, so a draft or a cancelled document read as valid.
 */
export function isDocumentValid(doc) {
  if (!doc) return false;
  if (doc.is_revoked) return false;
  if (doc.expires_at && new Date(doc.expires_at) < new Date()) return false;
  const bad = ['draft', 'pending_approval', 'rejected', 'cancelled', 'expired', 'superseded'];
  if (doc.lifecycle_status && bad.includes(doc.lifecycle_status)) return false;
  return true;
}

/**
 * A real QR code, as inline SVG.
 *
 * `qrcode.react` is already a dependency; rendering it with
 * `renderToStaticMarkup` produces a self-contained vector QR that stays sharp
 * in print and needs no image hosting. The previous implementation embedded a
 * hard-coded 1x1 transparent PNG under the caption "Verify authenticity".
 *
 * The renderer is imported dynamically and cached: Next.js refuses a static
 * `react-dom/server` import inside a route module, and this file is reached
 * from several routes.
 */
let qrRenderer = null;

async function loadQrRenderer() {
  if (!qrRenderer) {
    qrRenderer = (async () => {
      const [{ createElement }, { renderToStaticMarkup }, { QRCodeSVG }] = await Promise.all([
        import('react'),
        import('react-dom/server'),
        import('qrcode.react'),
      ]);
      // createElement, not a direct call: QRCodeSVG is a React component and
      // may use hooks, which only work inside the renderer.
      return (value, size) => renderToStaticMarkup(
        createElement(QRCodeSVG, { value: String(value), size, level: 'M', marginSize: 0 })
      );
    })();
  }
  return qrRenderer;
}

export async function qrCodeSvg(text, size = 160) {
  try {
    const renderQr = await loadQrRenderer();
    return renderQr(text, size);
  } catch (e) {
    // A document without its QR is still a valid document; a failed build is
    // not. Say so on the console rather than throwing.
    console.error('[Documents] QR rendering failed:', e.message);
    return '';
  }
}

/** The absolute public base URL, without a trailing slash. */
export function publicBaseUrl() {
  const raw = process.env.APP_PUBLIC_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * The verification URL printed on a document.
 *
 * The token is included because a bare document id proves nothing: ids are
 * sequential and guessable, so `?token=` is what actually authorises a read.
 */
export function verificationUrl(uniqueId, token) {
  const base = publicBaseUrl();
  return token
    ? `${base}/verify/${encodeURIComponent(uniqueId)}?token=${encodeURIComponent(token)}`
    : `${base}/verify/${encodeURIComponent(uniqueId)}`;
}

/** Only these colour forms are allowed into a style attribute. */
function safeColor(value, fallback) {
  const v = String(value ?? '').trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) || /^[a-zA-Z]{3,20}$/.test(v) ? v : fallback;
}

/** A URL safe to put in src=""; blocks javascript: and data: payloads. */
function safeUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\//.test(v)) return v;
  // data: and javascript: are rejected — branding is user-editable.
  return null;
}

function safeInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Wrap rendered document content in the company's letterhead.
 *
 * Every branding field is escaped or validated: branding is editable from the
 * settings screen, so an unescaped field here is stored XSS that fires in the
 * browser preview, on the public verification page and inside the PDF renderer.
 *
 * Layout notes: the `@page` rule and the `.doc-*` classes are what make
 * multi-page output behave — headings do not get orphaned, clause sections do
 * not split across a page boundary mid-title, and the footer repeats.
 */
export async function formatDocumentWithBranding(content, branding = {}, options = {}) {
  const {
    includeQr = true,
    qrText = null,
    documentId = '',
    documentTitle = 'Document',
    watermark = null,
    footerNote = null,
  } = options;

  const org = escapeHtml(branding.organization_name ?? 'Organization');
  const primary = safeColor(branding.primary_color, '#1F2937');
  const secondary = safeColor(branding.secondary_color, '#374151');
  const accent = safeColor(branding.accent_color, '#3B82F6');

  const logoUrl = safeUrl(branding.logo_url);
  const logoW = safeInt(branding.logo_width, 100, 16, 400);
  const logoH = safeInt(branding.logo_height, 60, 16, 400);
  const sigUrl = safeUrl(branding.signature_url);

  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" style="height:${logoH}px;width:${logoW}px;object-fit:contain;margin-bottom:16px;" />`
    : '';

  const signature = sigUrl || branding.signature_name
    ? `<div class="doc-signature">
         ${sigUrl ? `<img src="${escapeHtml(sigUrl)}" alt="" style="height:80px;margin-bottom:8px;" />` : '<div style="height:48px;"></div>'}
         <div class="doc-signature-rule">
           <p class="doc-signature-name">${escapeHtml(branding.signature_name ?? 'Authorized Signatory')}</p>
           ${branding.signature_title ? `<p class="doc-signature-title">${escapeHtml(branding.signature_title)}</p>` : ''}
         </div>
       </div>`
    : '';

  const qrSvg = includeQr && qrText ? await qrCodeSvg(qrText, 150) : '';
  const qr = qrSvg
    ? `<div class="doc-qr">
         <p class="doc-qr-caption">Scan to verify this document</p>
         ${qrSvg}
         <p class="doc-qr-id">${escapeHtml(documentId)}</p>
       </div>`
    : '';

  const watermarkEl = watermark
    ? `<div class="doc-watermark">${escapeHtml(watermark)}</div>`
    : '';

  const addressLine = [branding.address_line1, branding.city, branding.postal_code]
    .filter(Boolean).map(escapeHtml).join(', ');

  const contacts = [
    branding.phone ? `Tel: ${escapeHtml(branding.phone)}` : null,
    branding.email ? `Email: ${escapeHtml(branding.email)}` : null,
    branding.website ? `Web: ${escapeHtml(branding.website)}` : null,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(documentTitle)}</title>
<style>
  /* Page geometry. Margins leave room for the running footer so that a
     multi-page contract never prints body text over it. */
  @page { size: A4; margin: 18mm 16mm 22mm 16mm; }

  :root {
    --doc-primary: ${primary};
    --doc-secondary: ${secondary};
    --doc-accent: ${accent};
    --doc-ink: #1F2937;
    --doc-muted: #6B7280;
    --doc-rule: #E5E7EB;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    font-size: 11.5pt; line-height: 1.65; color: var(--doc-ink);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .doc-shell { max-width: 900px; margin: 0 auto; position: relative; }

  .doc-header {
    background: linear-gradient(135deg, var(--doc-primary) 0%, var(--doc-secondary) 100%);
    color: #fff; padding: 28px 32px; text-align: center;
    border-bottom: 3px solid var(--doc-accent);
  }
  .doc-header h1 { margin: 6px 0 0; font-size: 20pt; letter-spacing: .2px; }
  .doc-header p { margin: 4px 0 0; font-size: 10pt; opacity: .92; }

  .doc-body { padding: 32px 32px 8px; }

  /* Keep a heading with the text that follows it, and keep a clause whole
     where it fits on one page. Without these, a signature block or a clause
     title regularly ended up alone at the foot of a page. */
  .doc-body h1, .doc-body h2, .doc-body h3, .doc-body h4 {
    color: var(--doc-primary); line-height: 1.3;
    break-after: avoid; page-break-after: avoid;
  }
  .doc-body h1 { font-size: 17pt; margin: 1.4em 0 .5em; }
  .doc-body h2 { font-size: 14pt; margin: 1.3em 0 .45em; }
  .doc-body h3 { font-size: 12pt; margin: 1.2em 0 .4em; }
  .doc-body p { margin: 0 0 .85em; orphans: 3; widows: 3; }
  .doc-body ul, .doc-body ol { margin: 0 0 .9em 1.3em; padding: 0; }
  .doc-body li { margin: 0 0 .35em; }
  .doc-body hr { border: 0; border-top: 1px solid var(--doc-rule); margin: 1.6em 0; }
  .doc-body code { font-family: Consolas, Menlo, monospace; font-size: .92em; background: #F3F4F6; padding: 1px 4px; border-radius: 3px; }

  .doc-body table { width: 100%; border-collapse: collapse; margin: 0 0 1.1em; font-size: 10.5pt; }
  .doc-body th, .doc-body td { border: 1px solid var(--doc-rule); padding: 7px 9px; text-align: left; vertical-align: top; }
  .doc-body th { background: #F9FAFB; font-weight: 600; }
  .doc-body thead { display: table-header-group; }   /* repeat headers across pages */
  .doc-body tr { break-inside: avoid; page-break-inside: avoid; }

  .doc-clause { break-inside: avoid-page; page-break-inside: avoid; margin: 0 0 1.25em; }
  .doc-clause-title { font-size: 12pt; margin: 1.1em 0 .35em; }

  .doc-signature { margin-top: 44px; display: inline-block; text-align: center; break-inside: avoid; }
  .doc-signature-rule { border-top: 1px solid var(--doc-ink); padding-top: 7px; min-width: 230px; }
  .doc-signature-name { margin: 0; font-weight: 600; }
  .doc-signature-title { margin: 2px 0 0; font-size: 9.5pt; color: var(--doc-muted); }

  .doc-qr { margin-top: 30px; padding-top: 16px; border-top: 1px dashed #D1D5DB; text-align: center; break-inside: avoid; }
  .doc-qr-caption { margin: 0 0 8px; font-size: 9pt; color: var(--doc-muted); }
  .doc-qr-id { margin: 8px 0 0; font-size: 9pt; color: var(--doc-muted); font-family: Consolas, Menlo, monospace; }

  .doc-footer {
    margin-top: 26px; border-top: 1px solid var(--doc-rule); background: #F9FAFB;
    padding: 16px 32px; font-size: 8.5pt; color: var(--doc-muted);
    display: flex; justify-content: space-between; gap: 20px; align-items: flex-end;
  }
  .doc-footer p { margin: 0 0 3px; }

  .doc-watermark {
    position: fixed; top: 44%; left: 0; right: 0; text-align: center;
    font-size: 64pt; font-weight: 800; color: rgba(17, 24, 39, 0.07);
    transform: rotate(-24deg); letter-spacing: 6px; pointer-events: none; z-index: 0;
  }
  .doc-shell > * { position: relative; z-index: 1; }
</style>
</head>
<body>
${watermarkEl}
<div class="doc-shell">
  <header class="doc-header">
    ${logo}
    <h1>${org}</h1>
    ${branding.header_text ? `<p>${escapeHtml(branding.header_text)}</p>` : ''}
  </header>

  <main class="doc-body">
${content ?? ''}
    ${signature}
    ${qr}
  </main>

  <footer class="doc-footer">
    <div>
      <p><strong>${org}</strong></p>
      ${addressLine ? `<p>${addressLine}</p>` : ''}
      ${footerNote ? `<p>${escapeHtml(footerNote)}</p>` : ''}
    </div>
    <div style="text-align:right;">
      ${contacts ? `<p>${contacts}</p>` : ''}
      ${documentId ? `<p>Ref: ${escapeHtml(documentId)}</p>` : ''}
    </div>
  </footer>
</div>
</body>
</html>`;
}

/**
 * Append a generation-pipeline log line.
 *
 * Never throws: a failure to log must not fail a document that was otherwise
 * produced correctly. Failures are surfaced on the server console instead.
 */
export async function logDocumentGeneration(queryFn, generatedDocId, level, phase, message, details = {}, actorId = null) {
  try {
    return await queryFn(
      `INSERT INTO generated_document_logs (generated_document_id, level, phase, message, details, actor_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [generatedDocId, level, phase, String(message).slice(0, 2000), JSON.stringify(details ?? {}), actorId]
    );
  } catch (e) {
    console.error('[Documents] generation log failed:', e.message);
    return null;
  }
}

/**
 * Normalise a client address for an `inet` column.
 *
 * `x-forwarded-for` on Vercel is a comma-separated chain, and the previous code
 * passed it straight into an `inet` column along with the literal fallback
 * 'unknown'. Both are invalid inet syntax, so the public verification endpoint
 * raised a 500 on its normal path in production. Proven against the database;
 * see the audit, section A.5.
 */
export function clientIp(request) {
  const chain = request.headers.get('x-forwarded-for') ?? '';
  const first = chain.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || '';
  // Strip a port if one is present (IPv4 only; bracketed IPv6 keeps its colons).
  const bare = /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(first) ? first.split(':')[0] : first;
  if (!bare) return null;
  const ok = /^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || /^[0-9a-fA-F:]+$/.test(bare);
  return ok ? bare : null;
}
