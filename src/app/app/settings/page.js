'use client';

import { useState, useEffect } from 'react';
import { Save, User, Lock, Bell, DollarSign, Palette, ChevronRight, MessageSquare, Building2, ShieldCheck, Briefcase, Fingerprint, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import Link from 'next/link';
import { usePermissions } from '@/components/providers/PermissionProvider';
import { getRoutePermission, isOpenRoute } from '@/lib/navigation-config';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');
  const [error, setError] = useState('');
  const [passkeyCount, setPasskeyCount] = useState(null); // null = loading
  const { user: permUser, hasPermission } = usePermissions();
  // Only show tiles the user can actually open (company-wide settings need
  // settings.manage etc.) — same rule RoutePermissionGuard enforces.
  const canOpen = (href) => {
    if (isOpenRoute(href) || permUser?.is_superadmin) return true;
    const required = getRoutePermission(href);
    return !required || hasPermission(required);
  };

  useEffect(() => {
    // /api/auth/me responds with { user } (not the { success, data } envelope)
    fetchWithAuth('/api/auth/me').then(j => {
      if (j.user) setUser(j.user);
    }).catch(() => {});
    fetchWithAuth('/api/auth/passkeys').then(j => {
      setPasskeyCount(j.success ? (j.data || []).length : 0);
    }).catch(() => setPasskeyCount(0));
  }, []);

  const changePassword = async () => {
    setError(''); setPwMessage('');
    if (!passwordForm.current || !passwordForm.newPass) { setError('Fill in your current and new password.'); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { setError('New passwords do not match.'); return; }
    setPwSaving(true);
    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.newPass }),
      });
      if (res.success) {
        setPwMessage(res.data?.message || 'Password updated.');
        setPasswordForm({ current: '', newPass: '', confirm: '' });
      } else {
        setError(res.error || 'Failed to change password');
      }
    } catch (err) { setError(err.message); }
    finally { setPwSaving(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      {/* Biometric login — first-class, not buried */}
      <Link href="/app/settings/security" className="flex items-center justify-between gap-4 p-5 bg-card border border-border rounded-xl hover:bg-muted/50 transition group">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Fingerprint className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Biometric Login</p>
            <p className="text-sm text-muted-foreground">
              {passkeyCount === null
                ? 'Checking…'
                : passkeyCount > 0
                  ? `Enabled on ${passkeyCount} device${passkeyCount !== 1 ? 's' : ''} · manage fingerprint / Face ID`
                  : 'Not set up · sign in with your fingerprint, Face ID or Windows Hello'}
            </p>
          </div>
        </div>
        <span className={`text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap ${passkeyCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary text-primary-foreground'}`}>
          {passkeyCount > 0 ? 'Manage' : 'Set up'}
        </span>
      </Link>

      {/* Quick nav to sub-settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { href: '/app/settings/company', icon: Building2, label: 'Company Branding', desc: 'Logo, address & contact info' },
          { href: '/app/settings/financial', icon: DollarSign, label: 'Financial', desc: 'Currency & formatting' },
          { href: '/app/settings/deals', icon: Briefcase, label: 'Deals', desc: 'Deletion policy for deals with payments' },
          { href: '/app/settings/appearance', icon: Palette, label: 'Appearance', desc: 'Theme & colors' },
          { href: '/app/settings/communication', icon: MessageSquare, label: 'Communication', desc: 'Calls, chat & file sharing' },
          { href: '/app/settings/security', icon: ShieldCheck, label: 'Security', desc: 'Biometric login & passkeys' },
          { href: '/app/settings/sessions', icon: Lock, label: 'Active Sessions', desc: 'Signed-in devices' },
        ].filter(item => canOpen(item.href)).map(item => (
          <Link key={item.href} href={item.href} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <item.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>

      {/* Profile — editing lives on /app/profile (with approval workflow) */}
      <div className="bg-card rounded-xl border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Profile</h2>
          </div>
          <Link href="/app/profile" className="text-sm text-primary hover:underline">Edit profile →</Link>
        </div>
        {user ? (
          <div className="text-sm text-muted-foreground space-y-1">
            <div className="text-foreground font-medium">{user.name || user.full_name || user.email}</div>
            <div>{user.email}</div>
            <div className="text-xs">
              Role: <span className="capitalize font-medium">{user.role}</span>
              {user.created_at && <> &middot; Joined: {new Date(user.created_at).toLocaleDateString()}</>}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
      </div>

      {/* Security */}
      <div className="bg-card rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Password</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Current Password</label>
            <input type="password" value={passwordForm.current} onChange={e => setPasswordForm(f => ({ ...f, current: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">New Password</label>
              <input type="password" value={passwordForm.newPass} onChange={e => setPasswordForm(f => ({ ...f, newPass: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Confirm Password</label>
              <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={changePassword}
            disabled={pwSaving}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Change Password
          </button>
          {pwMessage && <span className="text-sm text-emerald-600">{pwMessage}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      {/* App Info */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">About</h2>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Jeton Founder OS</div>
          <div>Architecture: Ledger-based finance, event-driven</div>
          <div>Database: PostgreSQL on Neon</div>
        </div>
      </div>
    </div>
  );
}
