'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Loader2, CheckCircle, ExternalLink, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const fmt = (n) => {
  const num = parseFloat(n || 0);
  return 'UGX ' + num.toLocaleString('en-UG', { minimumFractionDigits: 0 });
};

const CATEGORY_ICON = {
  attendance: '🔵', communication: '💬', analytics: '📊', academics: '📚',
  records: '🗂️', access: '📱', integration: '🔗', support: '🛟', base: '✅', general: '✅',
};

/** Right-panel live preview */
function ProposalPreview({ form, systems }) {
  const system = systems.find(s => s.id === form.system_id);
  const plan = system?.plans?.find(p => p.id === form.plan_id);
  const features = plan?.features || [];
  const schoolName = form.school_name || 'Your School';
  const discPct = parseFloat(form.discount_percent || 0);
  const installFee = parseFloat(plan?.installation_fee || 0);
  const annualSub = parseFloat(plan?.annual_subscription || 0);
  const discountAmt = (installFee + annualSub) * (discPct / 100);
  const today = new Date().toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });

  if (!system || !plan) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground gap-3">
        <FileText className="w-12 h-12 opacity-20" />
        <p className="text-sm">Select a system and plan to see live preview</p>
      </div>
    );
  }

  return (
    <div className="prose-sm text-foreground space-y-5 font-sans" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-foreground pb-4">
        <div>
          <div className="text-lg font-extrabold tracking-tight">Xhenvolt Technologies</div>
          <div className="text-xs text-muted-foreground">Intelligent Software Solutions for Africa</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold text-blue-600 tracking-widest">PROPOSAL</div>
          <div className="text-xs text-muted-foreground">{today}</div>
        </div>
      </div>

      {/* Intro */}
      <div>
        <p className="font-bold text-base">Dear {schoolName},</p>
        <p className="text-sm text-muted-foreground mt-1">
          We are pleased to present <strong className="text-foreground">{system.name}</strong> —{' '}
          {system.positioning} — designed to transform how your institution operates. This proposal
          outlines the <strong className="text-foreground">{plan.name} Plan</strong>.
        </p>
      </div>

      {/* System highlight */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
        <div className="text-base font-extrabold text-blue-700 dark:text-blue-300">{system.name}</div>
        <div className="text-xs text-blue-600 dark:text-blue-400 italic mt-1">"{system.positioning}"</div>
      </div>

      {/* Plan + features */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{plan.name}</span>
          {plan.is_popular && <span className="bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Most Popular</span>}
          <span className="text-xs text-muted-foreground">
            {plan.student_limit ? `Up to ${plan.student_limit.toLocaleString()} students` : 'Unlimited students'}
          </span>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-foreground text-background">
                <th className="p-2 w-7 text-center"></th>
                <th className="p-2 text-left">Feature</th>
                <th className="p-2 text-left w-24">Category</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.id || i} className="border-t border-border">
                  <td className="p-2 text-center">{CATEGORY_ICON[f.category] || '✅'}</td>
                  <td className="p-2">{f.feature_name}</td>
                  <td className="p-2 text-muted-foreground capitalize text-xs">{f.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Investment</div>
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>One-time installation</span>
            <span className="font-bold">{fmt(installFee)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Annual subscription</span>
            <span className="font-bold">{fmt(annualSub)} / yr</span>
          </div>
          {discPct > 0 && (
            <>
              <div className="flex justify-between text-sm text-emerald-600 border-t border-border pt-2">
                <span>Discount ({discPct}%)</span>
                <span>− {fmt(discountAmt)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm border-t-2 border-foreground pt-2">
                <span>Installation (after discount)</span>
                <span>{fmt(installFee - installFee * (discPct / 100))}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm">
                <span>Annual (after discount)</span>
                <span>{fmt(annualSub - annualSub * (discPct / 100))}</span>
              </div>
            </>
          )}
        </div>
        {form.payment_terms && (
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Payment terms:</strong> {form.payment_terms}
          </p>
        )}
      </div>

      {/* Notes */}
      {form.custom_notes && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Additional Notes</div>
          <p className="text-sm">{form.custom_notes}</p>
        </div>
      )}

      {/* CTA */}
      <div className="rounded-lg bg-foreground text-background p-4">
        <div className="font-bold text-sm mb-1">Ready to Transform {schoolName}?</div>
        <p className="text-xs opacity-80">
          We are ready to proceed with deployment. Our team will handle complete installation, staff training, and onboarding.
        </p>
      </div>
    </div>
  );
}

export default function ProposalGeneratorPage() {
  const { id: prospectId } = useParams();
  const router = useRouter();
  const toast = useToast();

  const [prospect, setProspect] = useState(null);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState(null); // created proposal

  const [form, setForm] = useState({
    system_id: '',
    plan_id: '',
    discount_percent: '',
    payment_terms: '',
    custom_notes: '',
    school_name: '',
  });

  useEffect(() => {
    Promise.all([
      fetchWithAuth(`/api/prospects/${prospectId}`).then(r => r.json()),
      fetchWithAuth('/api/drais/systems').then(r => r.json()),
    ]).then(([prospectData, systemsData]) => {
      if (prospectData.success) {
        setProspect(prospectData.data);
        setForm(prev => ({ ...prev, school_name: prospectData.data.company_name || '' }));
      }
      if (systemsData.success) {
        setSystems(systemsData.data || []);
        // Auto-select DRAIS if only one system
        if (systemsData.data?.length === 1) {
          setForm(prev => ({ ...prev, system_id: systemsData.data[0].id }));
        }
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [prospectId]);

  const updateForm = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const selectedSystem = systems.find(s => s.id === form.system_id);
  const selectedPlan = selectedSystem?.plans?.find(p => p.id === form.plan_id);

  const handleGenerate = async () => {
    if (!form.system_id || !form.plan_id) {
      toast.error('Please select a system and plan');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: prospectId,
          system_id: form.system_id,
          selected_plan_id: form.plan_id,
          custom_notes: form.custom_notes || null,
          discount_percent: parseFloat(form.discount_percent) || 0,
          payment_terms: form.payment_terms || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGenerated(json.data);
        toast.success('Proposal generated!');
      } else {
        toast.error(json.error || 'Failed to generate proposal');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prospect) {
    return <div className="p-6 text-muted-foreground">Prospect not found.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* Nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/app/prospects/${prospectId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-4 h-4" /> Back to {prospect.company_name}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Generate Proposal</span>
      </div>

      {/* Success banner */}
      {generated && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Proposal generated successfully!</p>
              <p className="text-xs opacity-80">Snapshot saved. You can now download the PDF.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`/api/proposals/${generated.id}/pdf`, '_blank')}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              <ExternalLink className="w-4 h-4" /> Download PDF
            </button>
            <Link
              href={`/app/proposals/${generated.id}`}
              className="flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition"
            >
              View Proposal
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Form */}
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-base text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Proposal Configuration
            </h2>

            {/* School name */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">School / Organisation Name</label>
              <input
                type="text"
                value={form.school_name}
                onChange={e => updateForm('school_name', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
                placeholder={prospect.company_name}
              />
            </div>

            {/* System selector */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">System</label>
              <select
                value={form.system_id}
                onChange={e => { updateForm('system_id', e.target.value); updateForm('plan_id', ''); }}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground [&>option]:bg-background"
              >
                <option value="">Select system…</option>
                {systems.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {selectedSystem && (
                <p className="text-xs text-muted-foreground mt-1 italic">{selectedSystem.positioning}</p>
              )}
            </div>

            {/* Plan selector */}
            {selectedSystem && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-2">Pricing Plan</label>
                <div className="grid gap-2">
                  {selectedSystem.plans?.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => updateForm('plan_id', plan.id)}
                      className={`relative w-full text-left border rounded-xl p-3 transition ${
                        form.plan_id === plan.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-border bg-background hover:bg-muted/40'
                      }`}
                    >
                      {plan.is_popular && (
                        <span className="absolute top-2 right-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⭐ Popular</span>
                      )}
                      <div className="font-semibold text-sm text-foreground">{plan.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {fmt(plan.installation_fee)} install · {fmt(plan.annual_subscription)}/yr
                        {plan.student_limit ? ` · up to ${plan.student_limit.toLocaleString()} students` : ' · unlimited students'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Discount */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Discount (% optional)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.discount_percent}
                onChange={e => updateForm('discount_percent', e.target.value)}
                placeholder="e.g. 10"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
              />
            </div>

            {/* Payment terms */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Terms (optional)</label>
              <input
                type="text"
                value={form.payment_terms}
                onChange={e => updateForm('payment_terms', e.target.value)}
                placeholder="e.g. 50% upfront, 50% on go-live"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
              />
            </div>

            {/* Custom notes */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Custom Notes (optional)</label>
              <textarea
                value={form.custom_notes}
                onChange={e => updateForm('custom_notes', e.target.value)}
                placeholder="Any additional context, special conditions, or personalised message…"
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground resize-none"
              />
            </div>

            {/* Validation hint */}
            {(!form.system_id || !form.plan_id) && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 mb-4">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Select a system and plan before generating
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={submitting || !form.system_id || !form.plan_id}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {submitting ? 'Generating…' : 'Generate Proposal'}
            </button>

            {generated && (
              <button
                onClick={() => window.open(`/api/proposals/${generated.id}/pdf`, '_blank')}
                className="w-full mt-2 flex items-center justify-center gap-2 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-medium py-2.5 rounded-xl transition text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <ExternalLink className="w-4 h-4" /> Download PDF
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — Live Preview */}
        <div className="bg-card border border-border rounded-xl p-5 overflow-auto max-h-[calc(100vh-180px)] sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-foreground uppercase tracking-wider">Live Preview</h2>
            <span className="text-xs text-muted-foreground">Updates as you edit</span>
          </div>
          <ProposalPreview
            form={{ ...form, school_name: form.school_name || prospect.company_name }}
            systems={systems}
          />
        </div>
      </div>
    </div>
  );
}
