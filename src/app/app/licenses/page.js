'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import { Key, Search, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  expired:   { label: 'Expired',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  suspended: { label: 'Suspended', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  trial:     { label: 'Trial',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const TYPE_CONFIG = {
  perpetual:    'Perpetual',
  annual:       'Annual',
  monthly:      'Monthly',
  trial:        'Trial',
  enterprise:   'Enterprise',
};

export default function LicensesPage() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchWithAuth('/api/licenses')
      .then(r => r.json())
      .then(d => { setLicenses(d.licenses || d || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filtered = licenses.filter(l => {
    const matchSearch = !search ||
      l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.system_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.license_type?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total:     licenses.length,
    active:    licenses.filter(l => l.status === 'active').length,
    expired:   licenses.filter(l => l.status === 'expired').length,
    trial:     licenses.filter(l => l.status === 'trial').length,
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading licenses...</div>;
  if (error)   return <div className="p-6 text-destructive">Error: {error}</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">License Registry</h1>
            <p className="text-sm text-muted-foreground">All issued software licenses</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',   value: stats.total,   color: 'text-foreground' },
          { label: 'Active',  value: stats.active,  color: 'text-emerald-600' },
          { label: 'Expired', value: stats.expired, color: 'text-red-600' },
          { label: 'Trial',   value: stats.trial,   color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-4 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, system, type..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring [&>option]:bg-background"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Key className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No licenses found.</p>
          <p className="text-xs text-muted-foreground mt-1">Licenses are created when you record a deal for a system.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">System</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">End</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Deal Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(l => {
                  const sc = STATUS_CONFIG[l.status] || { label: l.status, color: 'bg-muted text-muted-foreground' };
                  const isExpiringSoon = l.end_date && new Date(l.end_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && l.status === 'active';
                  return (
                    <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {l.client_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {l.system_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                            {l.system_name}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {TYPE_CONFIG[l.license_type] || l.license_type || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          {sc.label}
                          {isExpiringSoon && <AlertCircle className="w-3 h-3" title="Expiring within 30 days" />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {l.start_date ? new Date(l.start_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {l.end_date ? (
                          <span className={isExpiringSoon ? 'text-yellow-600 font-medium' : ''}>
                            {new Date(l.end_date).toLocaleDateString()}
                          </span>
                        ) : <span>—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                        {l.deal_value ? formatCurrency(l.deal_value, l.deal_currency || 'UGX') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
            {filtered.length} license{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' || search ? ` (filtered from ${licenses.length} total)` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
