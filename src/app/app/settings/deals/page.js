'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

export default function DealSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWithAuth('/api/settings/system')
      .then(r => r.json())
      .then(j => {
        if (j.success) setSettings((j.data || []).filter(s => s.group === 'deals'));
        else setError(j.error || 'Failed to load settings');
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (setting) => {
    const next = setting.value === 'true' ? 'false' : 'true';
    setSavingKey(setting.key);
    setError('');
    try {
      const res = await fetchWithAuth('/api/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [setting.key]: next }),
      });
      const json = await res.json();
      if (json.success) {
        setSettings(prev => prev.map(s => (s.key === setting.key ? { ...s, value: next } : s)));
        toast.success('Setting saved');
      } else {
        setError(json.error || 'Failed to save setting');
      }
    } catch {
      setError('Network error');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/app/settings" className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deal Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Policy for deleting deals that carry money</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Loading...</div>
      ) : settings.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">No deal settings available</div>
      ) : (
        <div className="space-y-3">
          {settings.map(s => {
            const on = s.value === 'true';
            return (
              <div key={s.key} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{s.label}</p>
                      {!on && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                          recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.description}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={s.label}
                    disabled={savingKey === s.key}
                    onClick={() => toggle(s)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                      on ? 'bg-red-600' : 'bg-muted-foreground/30'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      on ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>

                {on && (
                  <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Deleting a deal now also permanently removes its payments, ledger entries and
                      invoices. This keeps account balances correct, but the money history cannot be
                      recovered. Only the audit log will record that it happened.
                    </span>
                  </div>
                )}
                {!on && (
                  <div className="mt-3 flex items-start gap-2 bg-muted/50 text-muted-foreground px-3 py-2 rounded-lg text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Deals with payments or invoices cannot be deleted, so every amount on record
                      belongs to a deal you can still open.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
