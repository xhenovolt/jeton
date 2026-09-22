'use client';

/**
 * DRAIS — Connection & Webhooks.
 * Shows the live platform connection status, the webhooks registered with DRAIS,
 * and a one-click button to register THIS Jeton's receiver (DRAIS mints the
 * signing secret; we store it so auto-suspend-on-expiry works immediately).
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plug, CheckCircle, XCircle, Webhook, AlertTriangle } from 'lucide-react';

const j = (u, opts) => fetch(u, opts).then((r) => r.json());

export default function DraisConnectionPage() {
  const [health, setHealth] = useState(null);
  const [hooks, setHooks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [h, w] = await Promise.all([
      j('/api/drais/health').catch(() => null),
      j('/api/drais/webhooks').catch(() => null),
    ]);
    setHealth(h);
    setHooks(w);
    setLoading(false);
    if (typeof window !== 'undefined' && !url) setUrl(`${window.location.origin}/api/drais/webhook`);
  }, [url]);

  useEffect(() => { load(); }, [load]);

  async function register() {
    setBusy(true); setMsg('');
    const r = await j('/api/drais/webhooks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(url ? { url } : {}),
    }).catch(() => null);
    setMsg(r?.success ? (r.message || 'Registered') : (r?.error || 'Registration failed'));
    setBusy(false);
    load();
  }

  const connected = !!health?.success && (health?.status === 'ok' || health?.status === 'healthy');
  const receiverConfigured = !!hooks?.receiver_configured;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">DRAIS Connection</h1>
          <p className="text-sm text-gray-500">Platform link & event webhooks</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Connection status */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <Plug className={connected ? 'text-green-500' : 'text-red-500'} size={22} />
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {connected ? 'Connected to DRAIS' : 'Not connected'}
            </p>
            <p className="text-xs text-gray-500">
              {connected ? 'Platform token valid — live data is flowing.' : (health?.error || 'Check DRAIS_PLATFORM_BASE_URL / DRAIS_PLATFORM_TOKEN.')}
            </p>
          </div>
          {connected ? <CheckCircle className="text-green-500" size={20} /> : <XCircle className="text-red-500" size={20} />}
        </div>
      </div>

      {/* Webhook registration */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Webhook size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Event webhooks</h2>
          {receiverConfigured
            ? <span className="ml-auto text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Receiver active</span>
            : <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Not registered</span>}
        </div>

        <p className="text-sm text-gray-500">
          Registering lets DRAIS push events to Jeton (auto-suspend on subscription expiry, payment alerts, etc.).
          DRAIS generates the signing secret; Jeton stores it automatically.
        </p>

        <label className="block">
          <span className="text-xs font-medium text-gray-500">Receiver URL (must be public https — not localhost)</span>
          <input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-jeton-domain/api/drais/webhook"
            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-sm text-gray-900 dark:text-white"
          />
        </label>

        {url.includes('localhost') && (
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            DRAIS can't reach localhost. Use your deployed Jeton URL for the receiver to actually fire.
          </div>
        )}

        <button onClick={register} disabled={busy || !connected}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
          <Webhook size={15} /> {busy ? 'Registering…' : 'Register this Jeton with DRAIS'}
        </button>

        {msg && <div className="text-sm rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-200">{msg}</div>}

        {/* Currently registered */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Registered with DRAIS</p>
          {!hooks ? <p className="text-sm text-gray-400">Loading…</p> : (hooks.registered || []).length === 0 ? (
            <p className="text-sm text-gray-400">None yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
              {hooks.registered.map((h, i) => (
                <li key={i} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-gray-700 dark:text-gray-200">{h.url}</span>
                  <span className={`text-xs ${h.is_active ? 'text-green-600' : 'text-gray-400'}`}>{h.is_active ? 'active' : 'inactive'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
