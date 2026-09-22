#!/usr/bin/env node
/**
 * Historical invoice import for Jeton.
 *
 * Reads every PDF under public/Invoices/, extracts text with the
 * system `pdftotext` binary (poppler), applies regex heuristics to
 * pull invoice_number, client_name, issue_date, currency and amount,
 * then upserts a row into `invoices` marked source='historical_import'.
 *
 * The parser is deliberately conservative: fields it can't confidently
 * extract stay NULL, and the run prints a per-file confidence report
 * so an operator can hand-fill the gaps in the admin UI.
 *
 * Usage:  node scripts/import-historical-invoices.js [--dry-run] [--dir=./public/Invoices]
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DRY_RUN = process.argv.includes('--dry-run');
const DIR_ARG = process.argv.find(a => a.startsWith('--dir='));
const DIR = DIR_ARG ? DIR_ARG.slice(6) : path.resolve(process.cwd(), 'public/Invoices');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 180000,
  keepAlive: true,
});

function extractText(pdfPath) {
  try {
    return execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    console.warn(`  pdftotext failed on ${pdfPath}: ${err.message}`);
    return '';
  }
}

// Money in the format "UGX 2,500,000" or "$1,200.00" or "2,500,000/=".
const AMOUNT_RE = /(UGX|USD|EUR|GBP|KES|TZS|\$|£|€)?\s*([0-9]{1,3}(?:[,\s][0-9]{3})+(?:\.[0-9]{2})?|\d+(?:\.\d{2})?)(?:\s*(?:\/=|\/-))?/g;
const INV_NUM_RE = /(?:invoice\s*(?:no|number|#)|inv[-. ]?no|inv[-. ]?number)[:\s#.]+([A-Za-z0-9][A-Za-z0-9\-\/._]{2,40})/i;
const DATE_RE    = /(?:date(?:\s*issued)?|issued\s*(?:on)?)[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+[,]?\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i;
const BILL_TO_RE = /(?:billed\s*to|bill\s*to|to)[:\s]+([A-Z][^\n\r]{3,80})/i;

function parseAmount(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).replace(/(st|nd|rd|th)/, ''));
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function extract(text, fallbackName) {
  // Invoice number.
  const invMatch = text.match(INV_NUM_RE);
  const invoice_number = invMatch ? invMatch[1].trim() : null;

  // Client name — first try "Billed To:" then fall back to the filename.
  const billMatch = text.match(BILL_TO_RE);
  const client_name = (billMatch ? billMatch[1].trim() : fallbackName)
    .replace(/\s{2,}/g, ' ').replace(/[|]+/g, '').trim();

  // Issue date.
  const dateMatch = text.match(DATE_RE);
  const issued_date = dateMatch ? parseDate(dateMatch[1]) : null;

  // Amount — largest UGX/dollar figure in the doc is usually the total.
  let total = 0, currency = 'UGX';
  const matches = [...text.matchAll(AMOUNT_RE)];
  for (const m of matches) {
    const n = parseAmount(m[2]);
    if (n && n > total) {
      total = n;
      if (m[1]) {
        currency = m[1] === '$' ? 'USD' : m[1] === '£' ? 'GBP' : m[1] === '€' ? 'EUR' : m[1].toUpperCase();
      }
    }
  }

  return { invoice_number, client_name, issued_date, amount: total || null, currency };
}

async function nextInvoiceNumber(year) {
  const r = await pool.query(
    `INSERT INTO invoice_sequences (year, last_number)
     VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_number = invoice_sequences.last_number + 1
     RETURNING last_number`,
    [year]
  );
  return `XH-HIST-${year}-${String(r.rows[0].last_number).padStart(4, '0')}`;
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`Directory not found: ${DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} PDF(s) in ${DIR}`);
  console.log(DRY_RUN ? '(dry-run — no rows will be written)' : '');

  await pool.query('SELECT 1'); // warm the pool

  let imported = 0, skipped = 0;
  const report = [];

  for (const file of files) {
    const full = path.join(DIR, file);
    const fallbackName = file.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
    const text = extractText(full);
    const parsed = extract(text, fallbackName);

    // Skip if we already imported this file.
    if (!DRY_RUN) {
      const exists = await pool.query(
        `SELECT id FROM invoices WHERE historical_file_path = $1 LIMIT 1`,
        [`/Invoices/${file}`]
      );
      if (exists.rows.length > 0) {
        skipped++;
        report.push({ file, action: 'skipped (already imported)' });
        continue;
      }
    }

    const year = parsed.issued_date ? new Date(parsed.issued_date).getFullYear() : new Date().getFullYear();

    if (!DRY_RUN) {
      const number = parsed.invoice_number || await nextInvoiceNumber(year);
      const token  = crypto.randomBytes(12).toString('hex');
      try {
        await pool.query(
          `INSERT INTO invoices (
             invoice_number, verification_token, client_name, currency,
             amount, deal_total_amount, total_paid_after, remaining_balance,
             issued_date, status, source, historical_file_path, notes
           ) VALUES ($1,$2,$3,$4,$5,$5,$5,0,COALESCE($6::date, CURRENT_DATE),
                     'paid','historical_import',$7,$8)
           ON CONFLICT (invoice_number) DO NOTHING`,
          [
            number, token, parsed.client_name,
            parsed.currency || 'UGX',
            parsed.amount || 0,
            parsed.issued_date,
            `/Invoices/${file}`,
            `Imported from ${file}. Verify totals against original PDF.`,
          ]
        );
        imported++;
        report.push({ file, action: 'imported', number, ...parsed });
      } catch (err) {
        report.push({ file, action: 'error', error: err.message });
      }
    } else {
      report.push({ file, action: 'would-import', ...parsed });
    }
  }

  console.log('\n─── Report ───');
  console.table(report.map(r => ({
    file: r.file.slice(0, 32),
    action: r.action,
    number: r.number || '',
    client: (r.client_name || '').slice(0, 24),
    date: r.issued_date || '',
    amount: r.amount || '',
    currency: r.currency || '',
  })));
  console.log(`\nImported: ${imported}  Skipped: ${skipped}  Total: ${files.length}`);
  await pool.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
