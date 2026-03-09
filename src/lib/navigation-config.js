/**
 * Navigation Configuration - JETON FOUNDER OS
 * 
 * Single Source of Truth for all navigation
 * Workflow: Prospect → Follow-up → Convert → Deal → Payment → Ledger
 * 
 * Every route here exists in /src/app/app/
 */

import {
  Home,
  Target,
  Bell,
  Users,
  Briefcase,
  CreditCard,
  DollarSign,
  Wallet,
  BookOpen as LedgerIcon,
  Receipt,
  ArrowRightLeft,
  PiggyBank,
  Package,
  BarChart3,
  BookOpen,
  Settings,
  Shield,
  FileText,
  Palette,
  Type,
} from 'lucide-react';

/**
 * FOUNDER WORKFLOW NAVIGATION
 * Prospect → Follow-up → Convert → Deal → Payment → Ledger
 */
export const menuItems = [
  // === PRIMARY ===
  {
    label: 'Dashboard',
    href: '/app/dashboard',
    icon: Home,
    category: 'primary',
  },

  // === SALES PIPELINE ===
  {
    label: 'Pipeline',
    icon: Target,
    category: 'sections',
    submenu: [
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
      { label: 'New Deal', href: '/app/deals/new', description: 'Create a deal' },
      { label: 'Payments', href: '/app/payments', description: 'Payment records' },
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

  // === CATALOG ===
  {
    label: 'Offerings',
    href: '/app/offerings',
    icon: Package,
    category: 'sections',
  },

  // === REPORTS ===
  {
    label: 'Reports',
    href: '/app/reports',
    icon: BarChart3,
    category: 'sections',
  },

  // === DOCUMENTATION ===
  {
    label: 'Documentation',
    icon: BookOpen,
    category: 'sections',
    submenu: [
      { label: 'Getting Started', href: '/app/docs/getting-started', description: 'Quick start guide' },
      { label: 'Founder Manual', href: '/app/docs/founder', description: 'Daily operating playbook' },
      { label: 'User Guides', href: '/app/docs/guides', description: 'Step-by-step instructions' },
      { label: 'Workflow', href: '/app/docs/workflow', description: 'Business process' },
      { label: 'Modules', href: '/app/docs/modules', description: 'Module reference' },
      { label: 'System Map', href: '/app/docs/system-map', description: 'Routes & endpoints' },
    ],
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
  { id: 'prospects', label: 'Prospects', icon: Target, href: '/app/prospects' },
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
