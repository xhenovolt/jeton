'use client';

/**
 * /admin/permission-inspector
 * Permission Inspector — superadmin / roles.manage tool.
 *
 * Select any user → see their assigned roles, every effective permission
 * (grouped by module), allowed/blocked routes, and data scope.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Search, Shield, ShieldCheck, ShieldOff, User, RefreshCw,
  ChevronDown, ChevronRight, Loader2, AlertCircle,
  RouteOff, Globe2, Building2, Lock, Unlock, MapPin,
} from 'lucide-react';
import { usePermissions } from '@/components/providers/PermissionProvider';
import { fetchWithAuth } from '@/lib/fetch-client';

// ── Module display labels ──────────────────────────────────────────────────
const MODULE_LABELS = {
  dashboard: 'Dashboard', users: 'Users', staff: 'Staff',
  roles: 'Roles & Permissions', finance: 'Finance', deals: 'Deals',
  clients: 'Clients', prospects: 'Prospects', reports: 'Reports',
  settings: 'Settings', audit: 'Audit Logs', departments: 'Departments',
  assets: 'Assets', systems: 'Systems', invoices: 'Invoices',
  approvals: 'Approvals', allocations: 'Allocations',
  intelligence: 'Intelligence', knowledge: 'Knowledge Base',
  media: 'Media', documents: 'Documents', liabilities: 'Liabilities',
  budgets: 'Budgets', expenses: 'Expenses', payments: 'Payments',
  offerings: 'Offerings', services: 'Services', operations: 'Operations',
  activity_logs: 'Activity Logs', licenses: 'Licenses',
};

const ACTION_LABELS = {
  view: 'View', create: 'Create', update: 'Edit', delete: 'Delete',
  manage: 'Manage', export: 'Export',
};

const DATA_SCOPE_CONFIG = {
  OWN:        { label: 'Own Records',        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',  Icon: Lock },
  DEPARTMENT: { label: 'Department Records', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',     Icon: Building2 },
  GLOBAL:     { label: 'All Records',        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', Icon: Globe2 },
};

const TABS = ['permissions', 'routes', 'blocked'];

export default function PermissionInspectorPage() {
  const { user } = usePermissions();

  const [users, setUsers]         = useState([]);
  const [searchQuery, setSearch]  = useState('');
  const [selected, setSelected]   = useState(null);   // userId
  const [data, setData]           = useState(null);   // inspector result
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState({});     // module → boolean
  const [activeTab, setActiveTab] = useState('permissions');

  // Load user list
  useEffect(() => {
    fetchWithAuth('/api/admin/users')
      .then(r => r.json())
      .then(d => { if (d.success) setUsers(d.data); })
      .catch(() => {});
  }, []);

  const loadInspection = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded({});
    setActiveTab('permissions');
    try {
      const res = await fetchWithAuth(`/api/admin/user-permissions/${userId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
      // Auto-expand first few modules
      const mods = Object.keys(json.data.byModule).slice(0, 3);
      const initial = {};
      mods.forEach(m => { initial[m] = true; });
      setExpanded(initial);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = (userId) => {
    setSelected(userId);
    loadInspection(userId);
  };

  const toggleModule = (mod) =>
    setExpanded(prev => ({ ...prev, [mod]: !prev[mod] }));

  // ── Filtered user list ──
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.name?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  // ── Guard: superadmin or roles.manage ──
  if (user && !user.is_superadmin && !user.permissions?.includes('roles.manage')) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>Superadmin or roles.manage permission required.</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-500" />
          Permission Inspector
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect the effective permissions for any user in the system.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: User list ── */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users…"
              value={searchQuery}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {filteredUsers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
            )}
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelect(u.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  selected === u.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium truncate">{u.name || u.email}</div>
                <div className={`text-xs truncate ${selected === u.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {u.email} · <span className="capitalize">{u.role}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Inspector ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Empty state */}
          {!selected && !loading && (
            <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Select a user to inspect their permissions</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-card border rounded-xl p-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading permissions…
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-card border border-destructive rounded-xl p-6 flex items-center gap-3 text-destructive">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Results */}
          {data && !loading && (
            <>
              {/* User summary card */}
              <div className="bg-card border rounded-xl p-4 flex flex-wrap gap-6 items-start">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">User</div>
                  <div className="font-semibold">{data.user.name}</div>
                  <div className="text-sm text-muted-foreground">{data.user.email}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Base Role</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    data.user.is_superadmin
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {data.user.role}
                  </span>
                </div>
                {data.roles.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">RBAC Roles</div>
                    <div className="flex flex-wrap gap-1">
                      {data.roles.map(r => (
                        <span key={r.id} className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded">
                          {r.name}
                          {r.data_scope && r.data_scope !== 'GLOBAL' && (
                            <span className="ml-1 opacity-60">({r.data_scope})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Data Scope Badge */}
                {data.dataScope && (() => {
                  const scope = DATA_SCOPE_CONFIG[data.dataScope] || DATA_SCOPE_CONFIG.OWN;
                  const ScopeIcon = scope.Icon;
                  return (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data Scope</div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${scope.color}`}>
                        <ScopeIcon className="w-3.5 h-3.5" />
                        {scope.label}
                      </span>
                    </div>
                  );
                })()}
                <div className="ml-auto text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Permissions</div>
                  <div className="text-2xl font-bold">
                    {data.user.is_superadmin ? '∞' : data.permissions.length}
                  </div>
                </div>
                <button
                  onClick={() => loadInspection(selected)}
                  className="self-center p-2 rounded-lg hover:bg-accent transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Superadmin notice */}
              {data.user.is_superadmin && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-purple-500 shrink-0" />
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    This user is a <strong>superadmin</strong> and bypasses all permission checks. All resources are accessible.
                  </p>
                </div>
              )}

              {/* Tabs */}
              {!data.user.is_superadmin && (
                <div className="bg-card border rounded-xl overflow-hidden">
                  {/* Tab bar */}
                  <div className="flex border-b">
                    <button
                      onClick={() => setActiveTab('permissions')}
                      className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'permissions'
                          ? 'border-b-2 border-primary text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Permissions
                      <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                        {data.permissions.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('routes')}
                      className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'routes'
                          ? 'border-b-2 border-primary text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Unlock className="w-4 h-4" />
                      Allowed Routes
                      <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">
                        {data.allowedRoutes?.length ?? 0}
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('blocked')}
                      className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        activeTab === 'blocked'
                          ? 'border-b-2 border-destructive text-destructive'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Lock className="w-4 h-4" />
                      Blocked Routes
                      <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs px-1.5 py-0.5 rounded-full">
                        {data.blockedRoutes?.length ?? 0}
                      </span>
                    </button>
                  </div>

                  {/* Tab: Permissions by module */}
                  {activeTab === 'permissions' && (
                    <div>
                      <div className="px-4 py-3 flex items-center justify-between border-b">
                        <span className="font-medium text-sm">Grouped by Module</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const all = {};
                              Object.keys(data.byModule).forEach(m => { all[m] = true; });
                              setExpanded(all);
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Expand all
                          </button>
                          <span className="text-muted-foreground">·</span>
                          <button
                            onClick={() => setExpanded({})}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Collapse all
                          </button>
                        </div>
                      </div>

                      <div className="divide-y">
                        {Object.keys(data.byModule).sort().map(mod => (
                          <div key={mod}>
                            <button
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
                              onClick={() => toggleModule(mod)}
                            >
                              {expanded[mod]
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              }
                              <span className="font-medium text-sm flex-1">
                                {MODULE_LABELS[mod] || mod}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {data.byModule[mod].length} action{data.byModule[mod].length !== 1 ? 's' : ''}
                              </span>
                            </button>

                            {expanded[mod] && (
                              <div className="px-4 pb-3 flex flex-wrap gap-2 border-t bg-accent/20">
                                {data.byModule[mod].sort().map(action => (
                                  <span
                                    key={action}
                                    className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    {ACTION_LABELS[action] || action}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

                        {Object.keys(data.byModule).length === 0 && (
                          <div className="px-4 py-8 text-center text-muted-foreground">
                            <ShieldOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No permissions assigned to this user.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab: Allowed Routes */}
                  {activeTab === 'routes' && (
                    <div>
                      {(!data.allowedRoutes || data.allowedRoutes.length === 0) ? (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                          <RouteOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No routes accessible.</p>
                        </div>
                      ) : (
                        <div className="divide-y max-h-96 overflow-y-auto">
                          {data.allowedRoutes.map((route, i) => (
                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                              <Unlock className="w-4 h-4 text-green-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{route.label}</div>
                                <div className="text-xs text-muted-foreground font-mono truncate">{route.path}</div>
                              </div>
                              {route.requiredPermission && (
                                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                                  {route.requiredPermission}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab: Blocked Routes */}
                  {activeTab === 'blocked' && (
                    <div>
                      {(!data.blockedRoutes || data.blockedRoutes.length === 0) ? (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                          <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-40 text-green-500" />
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">No blocked routes — user has full access to all navigable pages.</p>
                        </div>
                      ) : (
                        <div className="divide-y max-h-96 overflow-y-auto">
                          {data.blockedRoutes.map((route, i) => (
                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                              <Lock className="w-4 h-4 text-red-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{route.label}</div>
                                <div className="text-xs text-muted-foreground font-mono truncate">{route.path}</div>
                              </div>
                              {route.reason && (
                                <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full shrink-0">
                                  {route.reason}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
