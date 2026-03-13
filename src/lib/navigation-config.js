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
  FileText,
  Bug,
  Zap,
  Code2,
  BookMarked,
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
    // Dashboard visible to all authenticated users
  },
  {
    label: 'Command Center',
    href: '/app/command-center',
    icon: Zap,
    category: 'primary',
    minHierarchy: 3,
  },
  {
    label: 'Activity',
    href: '/app/activity',
    icon: Activity,
    category: 'primary',
    module: 'activity_logs',
  },

  // === SYSTEMS (core IP) ===
  {
    label: 'Systems',
    icon: Monitor,
    category: 'sections',
    module: 'systems',
    submenu: [
      { label: 'All Systems', href: '/app/systems', description: 'Software platforms built by Xhenvolt', permission: 'systems.view' },
      { label: 'Licenses', href: '/app/licenses', description: 'Active license registry', permission: 'licenses.view' },
      { label: 'Operations Log', href: '/app/operations', description: 'Daily founder workflow log', permission: 'operations.view' },
      { label: 'Dev Costs', href: '/app/system-costs', description: 'System development cost tracking', permission: 'systems.view' },
    ],
  },

  // === SERVICES ===
  {
    label: 'Services',
    href: '/app/services',
    icon: Layers,
    category: 'sections',
    module: 'services',
  },

  // === SALES PIPELINE ===
  {
    label: 'Pipeline',
    icon: Target,
    category: 'sections',
    module: 'pipeline',
    submenu: [
      { label: 'Pipeline Board', href: '/app/pipeline', description: 'Visual pipeline intelligence', permission: 'pipeline.view' },
      { label: 'Prospects', href: '/app/prospects', description: 'Track and qualify leads', permission: 'prospects.view' },
      { label: 'Follow-ups', href: '/app/followups', description: 'Scheduled touchpoints', permission: 'prospects.view' },
      { label: 'Clients', href: '/app/clients', description: 'Converted prospects', permission: 'clients.view' },
    ],
  },

  // === DEALS & PAYMENTS ===
  {
    label: 'Deals',
    icon: Briefcase,
    category: 'sections',
    module: 'deals',
    submenu: [
      { label: 'All Deals', href: '/app/deals', description: 'Active and completed deals', permission: 'deals.view' },
      { label: 'New Deal', href: '/app/deals/new', description: 'Record a licensing deal', permission: 'deals.create' },
      { label: 'Obligations', href: '/app/obligations', description: 'Client deliverable tracking', permission: 'obligations.view' },
      { label: 'Payments', href: '/app/payments', description: 'Payment records', permission: 'payments.view' },
      { label: 'Invoices', href: '/app/invoices', description: 'Generated invoices & PDFs', permission: 'invoices.view' },
      { label: 'Allocations', href: '/app/allocations', description: 'Money allocation tracking', permission: 'allocations.view' },
    ],
  },

  // === PRODUCTS ===
  {
    label: 'Products',
    href: '/app/products',
    icon: Package,
    category: 'sections',
    module: 'products',
  },

  // === COMPANY ===
  {
    label: 'Company',
    icon: Building2,
    category: 'sections',
    submenu: [
      { label: 'Staff', href: '/app/staff', description: 'Team members & hierarchy', permission: 'employees.view' },
      { label: 'Org Hierarchy', href: '/app/org-hierarchy', description: 'Department & role tree', permission: 'employees.view' },
      { label: 'Items', href: '/app/items', description: 'Unified assets, tools & infrastructure', permission: 'assets.view' },
      { label: 'Knowledge Base', href: '/app/knowledge', description: 'Company IP & documentation', permission: 'knowledge.view' },
      { label: 'Liabilities', href: '/app/liabilities', description: 'Obligations and debts', permission: 'finance.view' },
      { label: 'Offerings', href: '/app/offerings', description: 'Service catalog', permission: 'offerings.view' },
      { label: 'Media', href: '/app/media', description: 'Files, images & documents', permission: 'media.view' },
    ],
  },

  // === FINANCE ===
  {
    label: 'Finance',
    icon: DollarSign,
    category: 'sections',
    module: 'finance',
    submenu: [
      { label: 'Overview', href: '/app/finance', description: 'Financial dashboard', permission: 'finance.view' },
      { label: 'Accounts', href: '/app/finance/accounts', description: 'Bank and cash accounts', permission: 'accounts.view' },
      { label: 'Ledger', href: '/app/finance/ledger', description: 'Transaction history', permission: 'finance.view' },
      { label: 'Expenses', href: '/app/finance/expenses', description: 'Track spending', permission: 'expenses.view' },
      { label: 'Transfers', href: '/app/finance/transfers', description: 'Move between accounts', permission: 'finance.view' },
      { label: 'Budgets', href: '/app/finance/budgets', description: 'Spending limits', permission: 'budgets.view' },
    ],
  },

  // === DOCS ===
  {
    label: 'Docs',
    href: '/app/docs',
    icon: BookOpen,
    category: 'sections',
    module: 'knowledge',
  },

  // === INTELLIGENCE ===
  {
    label: 'Intelligence',
    icon: Brain,
    category: 'sections',
    module: 'intelligence',
    submenu: [
      { label: 'Dashboard', href: '/app/intelligence', description: 'Role-based intelligence overview', permission: 'intelligence.view' },
      { label: 'Engineering', href: '/app/tech-intelligence', description: 'Bugs, features & tech stack', permission: 'bug_tracking.view' },
      { label: 'Issue Intelligence', href: '/app/issue-intelligence', description: 'Root causes & resolutions', permission: 'issue_intelligence.view' },
      { label: 'Financial', href: '/app/financial-intelligence', description: 'Capital allocation & revenue', permission: 'finance.view' },
      { label: 'HRM', href: '/app/hrm', description: 'Employees & departments', permission: 'hrm.view' },
      { label: 'Documents', href: '/app/documents', description: 'Document center', permission: 'documents.view' },
      { label: 'Decision Log', href: '/app/decision-log', description: 'Key decisions & rationale', permission: 'decision_logs.view' },
    ],
  },

  // === REPORTS ===
  {
    label: 'Reports',
    href: '/app/reports',
    icon: BarChart3,
    category: 'sections',
    module: 'reports',
  },

  // === ADMIN ===
  {
    label: 'Admin',
    icon: Shield,
    category: 'sections',
    module: 'roles',
    minHierarchy: 3,
    submenu: [
      { label: 'Users', href: '/app/admin/users', description: 'User accounts & roles', permission: 'users.view' },
      { label: 'Roles', href: '/app/admin/roles', description: 'Manage roles & permissions', permission: 'roles.view' },
      { label: 'Departments', href: '/app/admin/departments', description: 'Department management', permission: 'departments.view' },
      { label: 'Approvals', href: '/app/admin/approvals', description: 'Pending approval requests', permission: 'roles.approve' },
      { label: 'Approval Pipeline', href: '/app/approval-pipeline', description: 'Visual approval workflow', permission: 'roles.approve' },
      { label: 'Backups', href: '/app/admin/backups', description: 'System backups & restore', permission: 'backups.view' },
      { label: 'Audit Logs', href: '/app/admin/audit-logs', description: 'System audit trail', permission: 'activity_logs.view' },
    ],
  },

  // === SETTINGS ===
  {
    label: 'Settings',
    icon: Settings,
    category: 'sections',
    // Settings visible to all authenticated users
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
