'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Verification portal.
 *
 * Two pre-existing problems are fixed here:
 *
 *   1. The page rendered `<Link>` without importing it, so pressing "Verify
 *      Document" threw a ReferenceError and nothing happened.
 *
 *   2. It built a link containing only the document id, and told the reader
 *      that "verification URLs can be shared publicly without authentication".
 *      That was literally true and was the vulnerability: ids are sequential
 *      (XTN-TYPE-YEAR-0001), so anyone could walk them and read every contract.
 *      A verification link now carries the document's token, which is the part
 *      that actually authorises the read.
 *
 * So the portal accepts either a full verification link (the normal case —
 * scanned or pasted) or an id plus its token.
 */
export default function VerifyPage() {
  const [input, setInput] = useState('');
  const [token, setToken] = useState('');
  const [link, setLink] = useState(null);
  const [problem, setProblem] = useState('');

  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || '');

  const handleSearch = (e) => {
    e.preventDefault();
    setProblem('');
    setLink(null);

    const raw = input.trim();
    if (!raw) return;

    // A pasted verification URL already carries everything needed.
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/verify/')) {
      try {
        const u = new URL(raw, origin || 'http://localhost');
        const id = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '');
        const t = u.searchParams.get('token') ?? token.trim();
        if (!id) { setProblem('That link does not contain a document reference.'); return; }
        setLink({ id, token: t, href: t ? `/verify/${encodeURIComponent(id)}?token=${encodeURIComponent(t)}` : `/verify/${encodeURIComponent(id)}` });
      } catch {
        setProblem('That does not look like a verification link.');
      }
      return;
    }

    const id = raw.toUpperCase();
    const t = token.trim();
    setLink({
      id,
      token: t,
      href: t
        ? `/verify/${encodeURIComponent(id)}?token=${encodeURIComponent(t)}`
        : `/verify/${encodeURIComponent(id)}`,
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Document Verification Portal</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Check whether a document reference was genuinely issued and is still current
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Verification link, or document reference
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://…/verify/XTN-NDA-2026-0001?token=…   or   XTN-NDA-2026-0001"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Pasting the whole link is easiest — it already contains the token.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Verification token <span className="font-normal text-gray-500">(only if you entered a reference on its own)</span>
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="the token printed with the document reference"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium cursor-pointer"
            >
              Build verification link
            </button>
          </form>

          {problem && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
              {problem}
            </div>
          )}

          {link && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Verification link for <code className="font-mono">{link.id}</code>:
              </p>
              <Link
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition break-all text-sm"
              >
                {origin}{link.href}
              </Link>
              {!link.token && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No token supplied. Unless this organisation has deliberately allowed
                  reference-only verification, this link will report that no matching
                  document was found — that is the system refusing to confirm whether a
                  reference exists to someone who cannot prove they hold the document.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">How verification works</h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>
              Every issued document carries a reference and a QR code. Scanning the QR
              opens the verification page with the token already attached.
            </li>
            <li>
              The token is what authorises the check. A reference on its own is not
              enough, because references run in sequence and would otherwise let anyone
              enumerate the company&apos;s documents.
            </li>
            <li>
              Verification confirms that a reference was issued by this organisation and
              has not been revoked, superseded or expired. Whether the document text
              itself is shown is a policy setting, off by default.
            </li>
            <li>
              A revoked, expired or superseded document says so, with the reason where
              one was recorded.
            </li>
            <li>Every verification attempt is logged.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
