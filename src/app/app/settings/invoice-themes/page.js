'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { Plus, Save, Trash2, Star, StarOff, RefreshCw } from 'lucide-react';

/**
 * /app/settings/invoice-themes
 *
 * Superadmin surface for the invoice theming system built in commit
 * 345132a. Left column lists themes; middle column edits the selected
 * one; right column iframes /api/invoices/themes/[id]/preview so every
 * save shows up in the sample invoice on the same screen.
 *
 * PATCH is debounced-on-save (explicit button) rather than
 * auto-save-on-change to keep the preview refresh predictable and to
 * avoid spamming PATCH from the color picker.
 */

const COLOR_FIELDS = [
  { key: 'primary_color',    label: 'Primary' },
  { key: 'secondary_color',  label: 'Secondary' },
  { key: 'accent_color',     label: 'Accent' },
  { key: 'background_color', label: 'Background' },
  { key: 'text_color',       label: 'Text' },
  { key: 'muted_color',      label: 'Muted text' },
  { key: 'border_color',     label: 'Border' },
];

const TOGGLE_FIELDS = [
  ['show_signature',            'Signature block'],
  ['show_bank_details',         'Bank details'],
  ['show_tax_section',          'Tax section'],
  ['show_payment_instructions', 'Payment info section'],
  ['show_terms',                'Terms & conditions'],
  ['show_notes',                'Notes'],
  ['show_qr',                   'QR verification'],
  ['show_seal',                 'Company seal'],
  ['show_watermark',            'Watermark'],
  ['rounded_corners',           'Rounded corners'],
];

export default function InvoiceThemesPage() {
  const toast = useToast();
  const [themes, setThemes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/invoices/themes');
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed');
      setThemes(j.themes);
      if (j.themes.length > 0 && !selectedId) {
        const def = j.themes.find((t) => t.is_default) || j.themes[0];
        setSelectedId(def.id);
        setDraft(def);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, [selectedId, toast]);

  useEffect(() => { load(); }, [load]);

  const select = (theme) => {
    setSelectedId(theme.id);
    setDraft(theme);
  };

  const patch = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const save = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/invoices/themes/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Save failed');
      toast.success('Theme saved');
      // Refresh preview iframe so the change shows up.
      if (iframeRef.current) iframeRef.current.contentWindow.location.reload();
      setThemes((prev) => prev.map((t) => (t.id === j.theme.id ? j.theme : t)));
      setDraft(j.theme);
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const promoteDefault = async () => {
    if (!draft?.id) return;
    patch('is_default', true);
    // Save immediately — the server also unflags others in one call.
    await save();
  };

  const createTheme = async () => {
    const name = prompt('Name for the new theme?');
    if (!name) return;
    try {
      const res = await fetchWithAuth('/api/invoices/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Create failed');
      await load();
      setSelectedId(j.theme.id);
      setDraft(j.theme);
      toast.success('Theme created');
    } catch (e) {
      toast.error(e.message || 'Create failed');
    }
  };

  const deleteTheme = async () => {
    if (!draft?.id) return;
    if (!confirm(`Delete theme "${draft.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetchWithAuth(`/api/invoices/themes/${draft.id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error || 'Delete failed');
      toast.success('Theme deleted');
      setSelectedId(null); setDraft(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoice Themes</h1>
          <p className="text-sm text-muted-foreground">
            Every visual choice the invoice engine makes reads from here. The default theme applies to every new invoice.
          </p>
        </div>
        <button
          onClick={createTheme}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New theme
        </button>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* ── Left: theme list ─────────────────────────────────────────── */}
        <div className="col-span-2 rounded-lg border border-border bg-card overflow-y-auto">
          {loading && <div className="p-4 text-xs text-muted-foreground">Loading…</div>}
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => select(t)}
              className={`w-full text-left px-3 py-3 border-b border-border transition-colors ${
                t.id === selectedId ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-2">
                {t.is_default
                  ? <Star className="w-3.5 h-3.5 text-amber-500" />
                  : <StarOff className="w-3.5 h-3.5 text-muted-foreground/40" />}
                <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
              </div>
              <div className="mt-2 flex gap-1">
                {['primary_color','secondary_color','accent_color'].map((k) => (
                  <span key={k} className="w-4 h-4 rounded border border-border" style={{ background: t[k] }} />
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* ── Middle: editor ───────────────────────────────────────────── */}
        <div className="col-span-4 rounded-lg border border-border bg-card overflow-y-auto p-4">
          {!draft ? (
            <p className="text-sm text-muted-foreground">Select a theme to edit.</p>
          ) : (
            <div className="space-y-5">
              <Field label="Name">
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                  value={draft.name || ''}
                  onChange={(e) => patch('name', e.target.value)}
                />
              </Field>

              <Section title="Colors">
                <div className="grid grid-cols-2 gap-3">
                  {COLOR_FIELDS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="color"
                        value={draft[key] || '#000000'}
                        onChange={(e) => patch(key, e.target.value)}
                        className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-muted-foreground text-xs">{label}</div>
                        <input
                          type="text"
                          value={draft[key] || ''}
                          onChange={(e) => patch(key, e.target.value)}
                          className="w-full text-xs font-mono bg-transparent border-b border-border focus:outline-none focus:border-primary"
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </Section>

              <Section title="Typography">
                <Field label="Font family">
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    value={draft.font_family || ''}
                    onChange={(e) => patch('font_family', e.target.value)}
                  />
                </Field>
                <Field label={`Base font size (${draft.base_font_size || 14}px)`}>
                  <input
                    type="range" min="11" max="18"
                    value={draft.base_font_size || 14}
                    onChange={(e) => patch('base_font_size', parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </Field>
              </Section>

              <Section title="Layout">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Paper size">
                    <select
                      value={draft.paper_size || 'A4'}
                      onChange={(e) => patch('paper_size', e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option>A4</option><option>Letter</option>
                    </select>
                  </Field>
                  <Field label="Orientation">
                    <select
                      value={draft.orientation || 'portrait'}
                      onChange={(e) => patch('orientation', e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option>portrait</option><option>landscape</option>
                    </select>
                  </Field>
                  <Field label={`Logo size (${draft.logo_size_px || 80}px)`}>
                    <input
                      type="range" min="40" max="140"
                      value={draft.logo_size_px || 80}
                      onChange={(e) => patch('logo_size_px', parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                  </Field>
                  <Field label="QR position">
                    <select
                      value={draft.qr_position || 'footer-left'}
                      onChange={(e) => patch('qr_position', e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="footer-left">Footer · left</option>
                      <option value="footer-right">Footer · right</option>
                    </select>
                  </Field>
                </div>
                <Field label="Watermark text (optional)">
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    value={draft.watermark_text || ''}
                    onChange={(e) => patch('watermark_text', e.target.value || null)}
                    placeholder="e.g. PAID or DRAFT"
                  />
                </Field>
              </Section>

              <Section title="Sections">
                <div className="grid grid-cols-2 gap-2">
                  {TOGGLE_FIELDS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!draft[key]}
                        onChange={(e) => patch(key, e.target.checked)}
                        className="rounded border-border"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Section>

              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
                </button>
                {!draft.is_default && (
                  <button
                    onClick={promoteDefault}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted"
                  >
                    <Star className="w-4 h-4 text-amber-500" /> Make default
                  </button>
                )}
                {!draft.is_default && (
                  <button
                    onClick={deleteTheme}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: live preview ──────────────────────────────────────── */}
        <div className="col-span-6 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="text-xs text-muted-foreground">Preview — sample invoice with this theme applied</div>
            <button
              onClick={() => iframeRef.current?.contentWindow.location.reload()}
              className="p-1 hover:bg-muted rounded text-muted-foreground"
              title="Refresh preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {selectedId ? (
            <iframe
              ref={iframeRef}
              src={`/api/invoices/themes/${selectedId}/preview`}
              className="flex-1 w-full bg-white"
              title="Invoice preview"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a theme to preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
