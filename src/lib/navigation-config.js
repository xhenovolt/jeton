/**
 * Navigation Configuration - Single Source of Truth
 * Used by both desktop sidebar and mobile drawer
 * Prevents duplicate menu definitions and ensures consistency
 */

import {
  Home,
  Building2,
  Zap,
  TrendingUp,
  Wallet,
  Handshake,
  Eye,
  Users,
  BookOpen,
  Settings,
  Plus,
  LogOut,
  Percent,
} from 'lucide-react';

/**
 * Main navigation menu items organized by category
 */
export const menuItems = [
  {
    label: 'Dashboard',
    href: '/app/dashboard',
    icon: Home,
    category: 'primary',
  },
  {
    label: 'Overview',
    href: '/app/overview',
    icon: Eye,
    category: 'primary',
  },
  {
    label: 'Operations',
    icon: Zap,
    category: 'sections',
    submenu: [
      { label: 'Staff', href: '/app/staff' },
      { label: 'Infrastructure', href: '/app/infrastructure' },
    ],
  },
  {
    label: 'Investments',
    icon: TrendingUp,
    category: 'sections',
    submenu: [
      { label: 'Deals', href: '/app/deals' },
      { label: 'Pipeline', href: '/app/pipeline' },
      { label: 'Valuation', href: '/app/valuation' },
    ],
  },
  {
    label: 'Finance',
    icon: Wallet,
    category: 'sections',
    submenu: [
      { label: 'Assets', href: '/app/assets-accounting' },
      { label: 'Liabilities', href: '/app/liabilities' },
      { label: 'Corporate Equity', href: '/app/equity' },
      { label: 'Share Allocations', href: '/app/shares' },
      { label: 'Sales', href: '/app/sales' },
    ],
  },
  {
    label: 'Intellectual Property',
    icon: Eye,
    category: 'sections',
    submenu: [{ label: 'IP Portfolio', href: '/app/intellectual-property' }],
  },
  {
    label: 'Admin',
    icon: Users,
    category: 'sections',
    submenu: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Roles & Permissions', href: '/admin/roles' },
      { label: 'Audit Logs', href: '/admin/audit-logs' },
      { label: 'Activity Analytics', href: '/admin/activity-analytics' },
    ],
  },
];

/**
 * Quick access links for mobile bottom navigation
 * Subset of main navigation for quick access
 */
export const quickAccessLinks = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/app/dashboard' },
  {
    id: 'assets',
    label: 'Assets',
    icon: Zap,
    href: '/app/assets-accounting',
  },
  {
    id: 'ip',
    label: 'IP',
    icon: TrendingUp,
    href: '/app/intellectual-property',
  },
];

/**
 * Protected routes that require authentication
 * These routes must not be accessible without a valid session
 */
export const protectedRoutes = [
  '/app',
  '/dashboard',
  '/app/dashboard',
  '/app/overview',
  '/app/assets',
  '/app/liabilities',
  '/app/deals',
  '/app/pipeline',
  '/app/reports',
  '/app/staff',
  '/app/settings',
  '/app/shares',
  '/app/infrastructure',
  '/app/intellectual-property',
  '/app/assets-accounting',
  '/app/equity',
  '/app/audit-logs',
  '/app/sales',
  '/app/valuation',
  '/admin/users',
  '/admin/roles',
  '/admin/audit-logs',
  '/admin/activity-analytics',
];

/**
 * Get all hrefs from menu items recursively
 * Useful for active state detection
 */
export function getAllHrefs(items = menuItems) {
  const hrefs = [];

  items.forEach((item) => {
    if (item.href) {
      hrefs.push(item.href);
    }
    if (item.submenu) {
      hrefs.push(...getAllHrefs(item.submenu));
    }
  });

  return hrefs;
}

/**
 * Find a menu item by href
 */
export function findMenuItemByHref(href, items = menuItems) {
  for (const item of items) {
    if (item.href === href) {
      return item;
    }
    if (item.submenu) {
      const found = findMenuItemByHref(href, item.submenu);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Check if a route is active
 */
export function isRouteActive(currentPath, menuPath) {
  return currentPath === menuPath;
}

/**
 * Get parent menu items (sections with submenus)
 */
export function getParentMenuItems(items = menuItems) {
  return items.filter((item) => item.submenu && item.submenu.length > 0);
}
