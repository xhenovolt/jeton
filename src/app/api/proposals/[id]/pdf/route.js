import { NextResponse } from 'next/server';
import { query } from '@/lib/db.js';
import { requirePermission } from '@/lib/permissions.js';

const fmt = (n) => {
  const num = parseFloat(n || 0);
  return 'UGX ' + num.toLocaleString('en-UG', { minimumFractionDigits: 0 });
};

const featureGroups = {
  attendance:    '🔵',
  communication: '💬',
  analytics:     '📊',
  academics:     '📚',
  records:       '🗂️',
  access:        '📱',
  integration:   '🔗',
  support:       '🛟',
  base:          '✅',
  general:       '✅',
};

/**
 * GET /api/proposals/[id]/pdf
 * Returns print-optimised HTML that matches the live preview.
 * Browser opens it and user prints / saves as PDF.
 */
export async function GET(request, { params }) {
  const perm = await requirePermission(request, 'prospects.view');
  if (perm instanceof NextResponse) return perm;

  try {
    const { id } = await params;

    // Prefer snapshot for immutability
    const snapshotRes = await query(
      `SELECT full_payload FROM proposal_snapshots WHERE proposal_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    let data;
    if (snapshotRes.rows[0]) {
      data = snapshotRes.rows[0].full_payload;
    } else {
      // Fallback: build from live tables
      const pr = await query(
        `SELECT pr.*, p.company_name AS prospect_name, p.contact_name, p.email, p.phone,
                ds.name AS system_name, ds.positioning, ds.description AS system_description,
                pp.name AS plan_name, pp.installation_fee, pp.annual_subscription, pp.student_limit,
                pr.discount_percent, pr.custom_notes, pr.payment_terms
         FROM proposals pr
         JOIN prospects p ON p.id = pr.prospect_id
         JOIN drais_systems ds ON ds.id = pr.system_id
         JOIN pricing_plans pp ON pp.id = pr.selected_plan_id
         WHERE pr.id = $1`, [id]
      );
      if (!pr.rows[0]) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
      const row = pr.rows[0];
      const feats = await query(`SELECT * FROM pricing_features WHERE plan_id = $1 ORDER BY display_order`, [row.selected_plan_id]);
      data = {
        school_name: row.prospect_name,
        contact_name: row.contact_name,
        email: row.email,
        phone: row.phone,
        system: { name: row.system_name, positioning: row.positioning, description: row.system_description },
        plan: {
          name: row.plan_name,
          installation_fee: parseFloat(row.installation_fee),
          annual_subscription: parseFloat(row.annual_subscription),
          student_limit: row.student_limit,
        },
        features: feats.rows,
        discount_percent: parseFloat(row.discount_percent || 0),
        custom_notes: row.custom_notes,
        payment_terms: row.payment_terms,
        generated_at: new Date().toISOString(),
      };
    }

    const d = data;
    const planName = d.plan?.name || '';
    const installFee = parseFloat(d.plan?.installation_fee || 0);
    const annualSub = parseFloat(d.plan?.annual_subscription || 0);
    const discPct = parseFloat(d.discount_percent || 0);
    const discountAmt = (installFee + annualSub) * (discPct / 100);
    const totalInstall = installFee - installFee * (discPct / 100);
    const totalAnnual = annualSub - annualSub * (discPct / 100);
    const today = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });
    const schoolName = d.school_name || 'Valued School';
    const features = d.features || [];

    const featureRows = features.map(f => `
      <tr>
        <td class="feat-icon">${featureGroups[f.category] || '✅'}</td>
        <td>${f.feature_name}</td>
        <td class="feat-cat">${f.category || ''}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DRAIS Proposal – ${schoolName}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 860px; margin: 0 auto; font-size: 14px; line-height: 1.6; }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a2e; padding-bottom: 20px; margin-bottom: 32px; }
  .brand-left h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .brand-left p { font-size: 11px; color: #666; margin-top: 2px; }
  .brand-right { text-align: right; }
  .brand-right .doc-type { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: 2px; }
  .brand-right .doc-date { font-size: 11px; color: #666; margin-top: 4px; }
  .intro { margin-bottom: 28px; }
  .intro h2 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .intro p { color: #444; }
  .section { margin-bottom: 28px; }
  .section h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .section p { color: #444; margin-bottom: 8px; }
  .highlight-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
  .highlight-box .sys-name { font-size: 20px; font-weight: 800; color: #1d4ed8; }
  .highlight-box .sys-pos { font-size: 13px; color: #3730a3; margin-top: 4px; font-style: italic; }
  .plan-badge { display: inline-block; background: #1d4ed8; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 20px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
  .popular-badge { display: inline-block; background: #f59e0b; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 20px; margin-left: 8px; letter-spacing: 0.5px; }
  table.feat-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.feat-table th { background: #1a1a2e; color: #fff; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
  table.feat-table td { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  table.feat-table tr:last-child td { border-bottom: none; }
  td.feat-icon { width: 28px; text-align: center; }
  td.feat-cat { width: 110px; font-size: 11px; color: #999; text-transform: capitalize; }
  .pricing-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; }
  .pricing-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
  .pricing-row:last-child { border-bottom: none; }
  .pricing-row.total { font-size: 15px; font-weight: 800; border-top: 2px solid #1a1a2e; padding-top: 12px; margin-top: 4px; }
  .pricing-row.discount { color: #059669; }
  .cta-box { background: #1a1a2e; color: #fff; border-radius: 8px; padding: 24px 28px; margin-top: 32px; }
  .cta-box h3 { font-size: 16px; font-weight: 700; margin-bottom: 10px; letter-spacing: 0.5px; }
  .cta-box p { font-size: 13px; color: #cbd5e1; line-height: 1.7; }
  .contact-row { display: flex; gap: 32px; margin-top: 16px; }
  .contact-row span { font-size: 12px; color: #94a3b8; }
  .contact-row b { color: #fff; }
  .footer-note { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    .cta-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table.feat-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- Print button -->
<div class="no-print" style="text-align:right;margin-bottom:16px">
  <button onclick="window.print()"
    style="background:#2563eb;color:#fff;border:none;padding:10px 22px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">
    🖨️ Download / Print PDF
  </button>
</div>

<!-- HEADER -->
<div class="brand">
  <div class="brand-left">
    <h1>Xhenvolt Technologies</h1>
    <p>Intelligent Software Solutions for Africa</p>
  </div>
  <div class="brand-right">
    <div class="doc-type">PROPOSAL</div>
    <div class="doc-date">${today}</div>
  </div>
</div>

<!-- INTRO -->
<div class="intro">
  <h2>Dear ${schoolName},</h2>
  <p>
    We are pleased to present <strong>DRAIS</strong> — our ${d.system?.positioning || 'attendance-first school management system'}
    — designed to transform how your institution operates. This proposal outlines the
    <strong>${planName} Plan</strong>, carefully selected to match your school's needs and growth stage.
  </p>
</div>

<!-- SYSTEM OVERVIEW -->
<div class="section">
  <h3>About DRAIS</h3>
  <div class="highlight-box">
    <div class="sys-name">${d.system?.name || 'DRAIS'}</div>
    <div class="sys-pos">"${d.system?.positioning || ''}"</div>
  </div>
  <p>${d.system?.description || 'DRAIS is a complete school management platform built for African institutions.'}</p>
</div>

<!-- PROBLEM -->
<div class="section">
  <h3>The Challenge Schools Face</h3>
  <p>Many schools in Uganda and across Africa still rely on manual attendance registers, paper-based record keeping, and fragmented communication channels. This results in:</p>
  <p>❌ <strong>Inaccurate attendance data</strong> — late recording, false entries, manipulation</p>
  <p>❌ <strong>Limited parent visibility</strong> — parents unaware of absences until too late</p>
  <p>❌ <strong>Delayed reporting</strong> — weekly or monthly reports instead of real-time insight</p>
  <p>❌ <strong>Accountability gaps</strong> — inability to identify patterns or enforce discipline systematically</p>
</div>

<!-- SOLUTION -->
<div class="section">
  <h3>The DRAIS Solution</h3>
  <p>DRAIS solves these challenges by making <strong>attendance the intelligent core</strong> of your school's operations:</p>
  <p>✅ <strong>Real-time fingerprint attendance</strong> — every student's presence is recorded the moment they arrive</p>
  <p>✅ <strong>Instant parent SMS alerts</strong> — parents notified within minutes of absence</p>
  <p>✅ <strong>Live dashboards</strong> — headteachers and administrators see all data in real time</p>
  <p>✅ <strong>Automated reports</strong> — daily, weekly, and termly reports generated automatically</p>
</div>

<!-- WHY ATTENDANCE-FIRST -->
<div class="section">
  <h3>Why Attendance-First?</h3>
  <p>Attendance is not just a register — it is the <strong>heartbeat of a school</strong>. When you know who is present, everything else becomes possible:</p>
  <p>🔵 Discipline and accountability start with presence</p>
  <p>🔵 Academic performance correlates directly with attendance</p>
  <p>🔵 Fee collection is stronger when absence is tracked</p>
  <p>🔵 Parent trust increases when they have real-time visibility</p>
  <p>Data accuracy starts at presence. DRAIS ensures your foundation is solid before building the rest.</p>
</div>

<!-- PLAN -->
<div class="section">
  <h3>Your Selected Plan</h3>
  <div style="margin-bottom:16px">
    <span class="plan-badge">${planName}</span>
    ${d.plan?.is_popular ? '<span class="popular-badge">⭐ Most Popular</span>' : ''}
    ${d.plan?.student_limit ? `<span style="font-size:12px;color:#666;margin-left:12px">Up to ${d.plan.student_limit.toLocaleString()} students</span>` : '<span style="font-size:12px;color:#666;margin-left:12px">Unlimited students</span>'}
  </div>
  <table class="feat-table">
    <thead>
      <tr><th style="width:32px"></th><th>Feature</th><th>Category</th></tr>
    </thead>
    <tbody>
      ${featureRows}
    </tbody>
  </table>
</div>

<!-- PRICING -->
<div class="section">
  <h3>Investment Summary</h3>
  <div class="pricing-box">
    <div class="pricing-row">
      <span>One-time installation fee</span>
      <span><strong>${fmt(installFee)}</strong></span>
    </div>
    <div class="pricing-row">
      <span>Annual subscription</span>
      <span><strong>${fmt(annualSub)}</strong> / year</span>
    </div>
    ${discPct > 0 ? `
    <div class="pricing-row discount">
      <span>Discount (${discPct}%)</span>
      <span>− ${fmt(discountAmt)}</span>
    </div>
    <div class="pricing-row total">
      <span>Installation (after discount)</span>
      <span>${fmt(totalInstall)}</span>
    </div>
    <div class="pricing-row total">
      <span>Annual subscription (after discount)</span>
      <span>${fmt(totalAnnual)}</span>
    </div>` : ''}
  </div>
  ${d.payment_terms ? `<p style="margin-top:12px;color:#555"><strong>Payment Terms:</strong> ${d.payment_terms}</p>` : ''}
</div>

${d.custom_notes ? `
<div class="section">
  <h3>Additional Notes</h3>
  <p>${d.custom_notes}</p>
</div>` : ''}

<!-- CTA -->
<div class="cta-box">
  <h3>Ready to Transform ${schoolName}?</h3>
  <p>
    We are ready to proceed with deployment at your earliest convenience.
    Our team will handle the complete installation, staff training, and onboarding.
    We are committed to ensuring DRAIS becomes an indispensable part of your daily operations.
  </p>
  <p style="margin-top:10px">
    To accept this proposal, simply reply to this email or contact us below.
    We look forward to partnering with ${schoolName}.
  </p>
  <div class="contact-row">
    ${d.email ? `<span><b>Email:</b> ${d.email}</span>` : ''}
    ${d.phone ? `<span><b>Phone:</b> ${d.phone}</span>` : ''}
  </div>
</div>

<div class="footer-note">
  <span>Xhenvolt Technologies &middot; DRAIS School Management System</span>
  <span>Generated: ${today}</span>
</div>

</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Proposal-Id': id,
      },
    });
  } catch (error) {
    console.error('[Proposals PDF] error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  }
}
