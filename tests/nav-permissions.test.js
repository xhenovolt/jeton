import { describe, it, expect } from 'vitest';
import { filterMenuByPermissions } from '@/lib/nav-permissions';

const menu = [
  { label: 'Dash', href: '/d', permission: 'dashboard.view' },
  { label: 'Fin', module: 'finance', submenu: [
    { label: 'Overview', href: '/f', permission: 'finance.view' },
    { label: 'Banking', href: '/b', permission: 'finance.manage' },
  ] },
  { label: 'Admin', minHierarchy: 3, submenu: [{ label: 'Users', href: '/u', permission: 'users.view' }] },
];

const ctx = (perms, extra = {}) => ({
  user: { id: 'u1', ...extra.user },
  permLoading: false,
  hierarchyLevel: extra.hierarchyLevel ?? 5,
  hasPermission: p => perms.includes(p),
  hasModuleAccess: m => perms.some(p => p.startsWith(m + '.')),
});

describe('filterMenuByPermissions', () => {
  it('returns null while loading with no user (render skeleton)', () => {
    expect(filterMenuByPermissions(menu, { user: null, permLoading: true })).toBeNull();
  });

  it('superadmin sees everything', () => {
    expect(filterMenuByPermissions(menu, ctx([], { user: { is_superadmin: true } }))).toBe(menu);
  });

  it('filters sub-items and drops empty parents', () => {
    const out = filterMenuByPermissions(menu, ctx(['finance.view']));
    expect(out.map(i => i.label)).toEqual(['Fin']);
    expect(out[0].submenu.map(s => s.label)).toEqual(['Overview']);
  });

  it('enforces minHierarchy', () => {
    expect(filterMenuByPermissions(menu, ctx(['users.view'], { hierarchyLevel: 5 }))).toEqual([]);
    expect(filterMenuByPermissions(menu, ctx(['users.view'], { hierarchyLevel: 2 })).map(i => i.label)).toEqual(['Admin']);
  });
});
