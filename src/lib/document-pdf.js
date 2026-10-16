/**
 * PDF rendering, and an honest answer when it is not available.
 *
 * THE DEPLOYMENT PROBLEM
 *
 * This repository depends on the full `puppeteer` package, which downloads a
 * Chromium into `~/.cache/puppeteer` at install time. That works on a
 * developer machine (verified: it launches here) but not on Vercel, where the
 * function bundle does not contain the browser and the cache directory does
 * not exist. The supported arrangement there is `puppeteer-core` plus a
 * serverless Chromium build.
 *
 * Rather than pretend, this module:
 *   - probes once whether a browser can actually launch, and caches the answer
 *   - renders a real PDF when it can
 *   - returns `{ ok: false, reason }` when it cannot, so the caller can serve
 *     the frozen HTML as a print-ready page instead
 *
 * The HTML fallback is not a downgrade in fidelity. The document stylesheet
 * carries the `@page`, `break-inside` and `thead` rules that drive pagination,
 * so a browser's own "Save as PDF" produces the same layout. What is lost is
 * server-side generation, not quality.
 *
 * To enable PDFs in production, install `puppeteer-core` and
 * `@sparticuz/chromium` and set PUPPETEER_EXECUTABLE_PATH; `resolveLauncher`
 * below already prefers that path when it is configured.
 */

let probe = null;   // { ok: boolean, reason?: string }

/**
 * Where to find a browser.
 *
 * PUPPETEER_EXECUTABLE_PATH wins, which is how a serverless Chromium is wired
 * in without changing code. Otherwise puppeteer's own downloaded binary.
 */
async function resolveLauncher() {
  const puppeteer = (await import('puppeteer')).default;

  const explicit = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (explicit) return { puppeteer, executablePath: explicit };

  try {
    const fs = await import('fs');
    const p = await puppeteer.executablePath();
    if (p && fs.existsSync(p)) return { puppeteer, executablePath: p };
    return { puppeteer, executablePath: null, missing: p };
  } catch {
    return { puppeteer, executablePath: null };
  }
}

/**
 * Can this process render a PDF? Probed once per server instance.
 *
 * `force` re-probes, which the settings screen uses to report current state
 * rather than a stale answer from boot.
 */
export async function pdfAvailable({ force = false } = {}) {
  if (probe && !force) return probe;

  if (process.env.DOCUMENT_PDF_DISABLED === '1') {
    probe = { ok: false, reason: 'PDF rendering is disabled by configuration (DOCUMENT_PDF_DISABLED=1).' };
    return probe;
  }

  try {
    const { puppeteer, executablePath, missing } = await resolveLauncher();
    if (!executablePath) {
      probe = {
        ok: false,
        reason: 'No Chromium executable is available in this environment' +
                (missing ? ` (expected at ${missing})` : '') +
                '. Documents are served as print-ready HTML instead.',
      };
      return probe;
    }
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    await browser.close();
    probe = { ok: true };
  } catch (e) {
    probe = { ok: false, reason: `Chromium could not start: ${e.message.split('\n')[0]}` };
  }
  return probe;
}

/**
 * Render frozen document HTML to a PDF buffer.
 *
 * `html` is the stored snapshot. Nothing is re-derived from a template here —
 * that is the whole point of storing it.
 *
 * @returns {Promise<{ok: true, buffer: Buffer} | {ok: false, reason: string}>}
 */
export async function renderPdf(html, { landscape = false, title = 'Document' } = {}) {
  const avail = await pdfAvailable();
  if (!avail.ok) return { ok: false, reason: avail.reason };

  const { puppeteer, executablePath } = await resolveLauncher();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();

    // `domcontentloaded`, not `networkidle0`: a document whose logo URL is
    // unreachable used to hang here until the navigation timeout.
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    // Give remote images a bounded chance to arrive, then proceed regardless.
    await page.evaluate(() => Promise.race([
      Promise.all(Array.from(document.images)
        .filter(i => !i.complete)
        .map(i => new Promise(res => { i.onload = i.onerror = res; }))),
      new Promise(res => setTimeout(res, 3000)),
    ]));

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      landscape,
      // Margins come from the @page rule in the document stylesheet; setting
      // them here as well would double them.
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font-size:8pt;color:#6B7280;padding:0 16mm;' +
        'display:flex;justify-content:space-between;">' +
        `<span>${escapeForTemplate(title)}</span>` +
        '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' +
        '</div>',
      timeout: 45_000,
    });

    return { ok: true, buffer: Buffer.from(buffer) };
  } catch (e) {
    return { ok: false, reason: `PDF rendering failed: ${e.message.split('\n')[0]}` };
  } finally {
    try { await browser?.close(); } catch { /* the process is going away anyway */ }
  }
}

/** The footer template is HTML injected into Chromium; keep data out of it. */
function escapeForTemplate(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').slice(0, 120);
}

/** A filename that is safe in a Content-Disposition header. */
export function safeFilename(name, ext = 'pdf') {
  const base = String(name ?? 'document')
    .replace(/[^A-Za-z0-9 ._-]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 80) || 'document';
  return `${base}.${ext}`;
}
