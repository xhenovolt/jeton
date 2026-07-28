'use client';

import { useEffect, useState } from 'react';

// (Dynamic rendering is inherited from src/app/app/layout.js — every
// /app/* route is dynamic because the layout reads the session cookie.)

/**
 * /app/about — About Jeton
 *
 * Shows the running version + deploy metadata read from /api/version.
 * Also hosts a link out to the CHANGELOG in the repo. Deliberately
 * plain — this is a diagnostic page, not a marketing surface.
 */
export default function AboutPage() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setInfo)
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-semibold text-foreground">About Jeton</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Internal operating system for Xhenvolt Uganda SMC Limited.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Build</h2>
        </div>
        {err && (
          <div className="p-6 text-sm text-red-600">Failed to load version info: {err}</div>
        )}
        {info && (
          <dl className="divide-y divide-border text-sm">
            <Row k="Version"  v={<span className="font-mono">{info.version}</span>} />
            <Row k="Branch"   v={<span className="font-mono">{info.branch}</span>} />
            <Row k="Commit"   v={<span className="font-mono">{info.commit}</span>} />
            {info.commitMsg && <Row k="Commit message" v={info.commitMsg} />}
            <Row k="Environment" v={<span className="font-mono">{info.env}</span>} />
            <Row k="Booted at"   v={<span className="font-mono">{info.builtAt}</span>} />
          </dl>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        <p>
          Version bumps follow <span className="font-mono">MAJOR.MINOR.PATCH</span>.
          MAJOR for architectural rebuilds, MINOR for new features or modules,
          PATCH for fixes and polish. Use <span className="font-mono">node scripts/version.js</span> to bump.
        </p>
        <p className="mt-3">
          Full history in <span className="font-mono">CHANGELOG.md</span> at the repo root.
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="grid grid-cols-3 px-6 py-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="col-span-2 text-foreground">{v}</dd>
    </div>
  );
}
