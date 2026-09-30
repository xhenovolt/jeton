import { describe, it, expect } from 'vitest';
import {
  getRoutePermission, isOpenRoute, getSectionTabs, getRouteTitle, menuItems,
} from '@/lib/navigation-config';

describe('getRoutePermission', () => {
  it('resolves exact menu entries', () => {
    expect(getRoutePermission('/app/intelligence/financial')).toBe('finance.view');
    expect(getRoutePermission('/app/staff/payroll')).toBe('staff.view');
  });

  it('walks up to the nearest registered parent for detail pages', () => {
    expect(getRoutePermission('/app/intelligence/tech/abc-123')).toBe('systems.view');
    expect(getRoutePermission('/app/dashboard/drais/schools/42')).toBe('drais.view');
  });

  it('covers non-menu pages through EXTRA_ROUTE_PERMISSIONS', () => {
    expect(getRoutePermission('/app/settings/company')).toBe('settings.manage');
    expect(getRoutePermission('/app/admin/identity')).toBe('identity.view_health');
  });
});

describe('isOpenRoute', () => {
  it('opens personal settings and the dashboard', () => {
    expect(isOpenRoute('/app/dashboard')).toBe(true);
    expect(isOpenRoute('/app/settings/security')).toBe(true);
  });

  it('does not treat open routes as prefixes (regression: DRAIS / company settings)', () => {
    expect(isOpenRoute('/app/dashboard/drais/schools')).toBe(false);
    expect(isOpenRoute('/app/dashboard/integrations')).toBe(false);
    expect(isOpenRoute('/app/settings/company')).toBe(false);
    expect(isOpenRoute('/app/settings/invoice-themes')).toBe(false);
  });
});

describe('section tabs', () => {
  it('derives Intelligence tabs from the sidebar', () => {
    const hrefs = getSectionTabs('intelligence').map(t => t.href);
    expect(hrefs).toEqual([
      '/app/intelligence', '/app/intelligence/financial', '/app/intelligence/pipeline',
      '/app/intelligence/issues', '/app/intelligence/tech',
    ]);
  });

  it('keeps every People tab under /app/staff', () => {
    for (const tab of getSectionTabs('staff')) expect(tab.href.startsWith('/app/staff')).toBe(true);
  });

  it('returns [] for unknown sections', () => {
    expect(getSectionTabs('nope')).toEqual([]);
  });
});

describe('menu integrity', () => {
  it('has no duplicate hrefs', () => {
    const hrefs = [];
    const walk = items => items.forEach(i => { if (i.href && i.href !== '#') hrefs.push(i.href); if (i.submenu) walk(i.submenu); });
    walk(menuItems);
    expect(hrefs.length).toBe(new Set(hrefs).size);
  });

  it('exposes Security & Biometrics in Settings', () => {
    const settings = menuItems.find(i => i.label === 'Settings');
    expect(settings.submenu.some(s => s.href === '/app/settings/security')).toBe(true);
  });

  it('titles detail pages from their parent', () => {
    expect(getRouteTitle('/app/intelligence/tech/xyz')).toBe('Tech Stacks');
    expect(getRouteTitle('/app/nowhere')).toBeNull();
  });
});
