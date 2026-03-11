/**
 * Navigation Configuration - JETON FOUNDER OS
 *
 * Single Source of Truth for all navigation
 * Core model: Systems → Deals → Payments → Licenses
 *
 * Every route here exists in /src/app/app/
 */

import {
  Home,
  Target,
  Briefcase,
  DollarSign,
  Package,
  BarChart3,
  Settings,
  Shield,
  Palette,
  Type,
  Monitor,
  Building2,
  Users,
  Activity,
  Layers,
  Workflow,
  PieChart,
  BookOpen,
  Wrench,
  Image,
  Calculator,
  ClipboardCheck,
  GitBranch,
  Brain,
  BoxSelect,
} from 'lucide-react';

/**
 * FOUNDER NAVIGATION
 * Systems → Deals → Payments → Licenses
 */
export const menuItems = [
  // === PRIMARY ===
  {
    label: 'Dashboard',
    href: '/app/dashboard',
    icon: Home,
    category: 'primary',
  },
  {
    label: 'Activity',
    href: '/app/activity',
    icon: Activity,
    category: 'primary',
  },

  // === SYSTEMS (core IP) ===
  {
    label: 'Systems',
    icon: Monitor,
    category: 'sections',
    submenu: [
      { label: 'All Systems', href: '/app/systems', description: 'Software platforms built by Xhenvolt' },
      { label: 'Licenses', href: '/app/licenses', description: 'Active license registry' },
      { label: 'Operations Log', href: '/app/operations', description: 'Daily founder workflow log' },
      { label: 'Dev Costs', href: '/app/system-costs', description: 'System development cost tracking' },
    ],
  },

  // === SERVICES ===
  {
    label: 'Services',
    href: '/app/services',
    icon: Layers,
    category: 'sections',
  },

  // === SALES PIPELINE ===
  {
    label: 'Pipeline',
    icon: Target,
    category: 'sections',
    submenu: [
      { label: 'Pipeline Board', href: '/app/pipeline', description: 'Visual pipeline intelligence' },
      { label: 'Prospects', href: '/app/prospects', description: 'Track and qualify leads' },
      { label: 'Follow-ups', href: '/app/followups', description: 'Scheduled touchpoints' },
      { label: 'Clients', href: '/app/clients', description: 'Converted prospects' },
    ],
  },

  // === DEALS & PAYMENTS ===
  {
    label: 'Deals',
    icon: Briefcase,
    category: 'sections',
    submenu: [
      { label: 'All Deals', href: '/app/deals', description: 'Active and completed deals' },
      { label: 'New Deal', href: '/app/deals/new', description: 'Record a licensing deal' },
      { label: 'Obligations', href: '/app/obligations', description: 'Client deliverable tracking' },
      { label: 'Payments', href: '/app/payments', description: 'Payment records' },
      { label: 'Allocations', href: '/app/allocations', description: 'Money allocation tracking' },
    ],
  },

  // === PRODUCTS ===
  {
    label: 'Products',
    href: '/app/products',
    icon: Package,
    category: 'sections',
  },

  // === COMPANY ===
  {
    label: 'Company',
    icon: Building2,
    category: 'sections',
    submenu: [
      { label: 'Staff', href: '/app/staff', description: 'Team members & hierarchy' },
      { label: 'Items', href: '/app/items', description: 'Unified assets, tools & infrastructure' },
      { label: 'Knowledge Base', href: '/app/knowledge', description: 'Company IP & documentation' },
      { label: 'Liabilities', href: '/app/liabilities', description: 'Obligations and debts' },
      { label: 'Offerings', href: '/app/offerings', description: 'Service catalog' },
      { label: 'Media', href: '/app/media', description: 'Files, images & documents' },
    ],
  },

  // === FINANCE ===
  {
    label: 'Finance',
    icon: DollarSign,
    category: 'sections',
    submenu: [
      { label: 'Overview', href: '/app/finance', description: 'Financial dashboard' },
      { label: 'Accounts', href: '/app/finance/accounts', description: 'Bank and cash accounts' },
      { label: 'Ledger', href: '/app/finance/ledger', description: 'Transaction history' },
      { label: 'Expenses', href: '/app/finance/expenses', description: 'Track spending' },
      { label: 'Transfers', href: '/app/finance/transfers', description: 'Move between accounts' },
      { label: 'Budgets', href: '/app/finance/budgets', description: 'Spending limits' },
    ],
  },

  // === DOCS ===
  {
    label: 'Docs',
    href: '/app/docs',
    icon: BookOpen,
    category: 'sections',
  },

  // === REPORTS ===
  {
    label: 'Reports',
    href: '/app/reports',
    icon: BarChart3,
    category: 'sections',
  },

  // === ADMIN ===
  {
    label: 'Admin',
    icon: Shield,
    category: 'sections',
    submenu: [
      { label: 'Users', href: '/app/admin/users', description: 'User accounts & roles' },
      { label: 'Roles', href: '/app/admin/roles', description: 'Manage roles & permissions' },
      { label: 'Audit Logs', href: '/app/admin/audit-logs', description: 'System audit trail' },
    ],
  },

  // === SETTINGS ===
  {
    label: 'Settings',
    icon: Settings,
    category: 'sections',
    submenu: [
      { label: 'General', href: '/app/settings', description: 'Account & preferences' },
      { label: 'Appearance', href: '/app/settings/appearance', icon: Palette, description: 'Colors, gradients, glass' },
      { label: 'Typography', href: '/app/settings/typography', icon: Type, description: 'Font family, size & weight' },
    ],
  },
];

/**
 * Quick access links for mobile bottom navigation
 */
export const quickAccessLinks = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/app/dashboard' },
  { id: 'systems', label: 'Systems', icon: Monitor, href: '/app/systems' },
  { id: 'deals', label: 'Deals', icon: Briefcase, href: '/app/deals' },
  { id: 'finance', label: 'Finance', icon: DollarSign, href: '/app/finance' },
];

/**
 * Protected routes that require authentication
 */
export const protectedRoutes = ['/app/*'];

/**
 * Settings route
 */
export const settingsRoute = {
  href: '/app/settings',
  label: 'Settings',
};

/**
 * Public routes
 */
export const publicRoutes = ['/login', '/register'];

/**
 * Get all hrefs from menu items recursively
 */
export function getAllHrefs(items = menuItems) {
  const hrefs = [];
  items.forEach((item) => {
    if (item.href) hrefs.push(item.href);
    if (item.submenu) hrefs.push(...getAllHrefs(item.submenu));
  });
  return hrefs;
}

/**
 * Find a menu item by href
 */
export function findMenuItemByHref(href, items = menuItems) {
  for (const item of items) {
    if (item.href === href) return item;
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

/**
 * Get all valid routes (flattened)
 */
export function getAllValidRoutes() {
  const routes = [];
  function traverse(items) {
    items.forEach((item) => {
      if (item.href) routes.push({ path: item.href, label: item.label, protected: item.href.startsWith('/app') });
      if (item.submenu) traverse(item.submenu);
    });
  }
  traverse(menuItems);
  return routes;
}
