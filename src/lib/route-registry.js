/**
 * Jeton Route Registry - FOUNDER OPERATING SYSTEM
 * 
 * SINGLE SOURCE OF TRUTH for all navigation routes.
 * ALL sidebar routes MUST originate from this configuration file.
 * 
 * NO DUPLICATES. NO PHANTOM ROUTES. NO EXPERIMENTAL ROUTES.
 * 
 * Workflow: Prospect → Client → Deal → Contract → Payment → Profit
 * 
 * @version 2.0.0
 * @date 2026-03-08
 */

import {
  Home,
  Users,
  TrendingUp,
  DollarSign,
  Settings,
  Target,
  FileText,
  Brain,
  Eye,
  BarChart3,
  Wallet,
  Receipt,
  Building2,
} from 'lucide-react';

// ============================================================================
// MASTER ROUTE REGISTRY
// All routes in the system must be defined here
// ============================================================================

export const ROUTES = {
  // Authentication
  LOGIN: '/login',
  REGISTER: '/register',
  LOGOUT: '/logout',
  
  // App Root
  APP_HOME: '/app',
  DASHBOARD: '/app/dashboard',
  OVERVIEW: '/app/overview',
  
  // Growth (Prospecting & Client Management)
  PROSPECTS: '/app/prospecting',
  PROSPECT_NEW: '/app/prospecting/new',
  PROSPECT_FOLLOWUPS: '/app/prospecting/followups',
  PROSPECT_DASHBOARD: '/app/prospecting/dashboard',
  PIPELINE: '/app/pipeline',
  CLIENTS: '/app/clients',
  
  // Revenue (Deals, Contracts, Payments)
  DEALS: '/app/deals',
  DEAL_CREATE: '/app/deals/create',
  CONTRACTS: '/app/contracts',
  PAYMENTS: '/app/payments',
  FINANCE: '/app/finance',
  INVOICES: '/app/invoices',
  
  // Systems (IP Portfolio)
  IP_PORTFOLIO: '/app/intellectual-property',
  
  // Operations
  STAFF: '/app/staff',
  INFRASTRUCTURE: '/app/infrastructure',
  ASSETS: '/app/assets-accounting',
  LIABILITIES: '/app/liabilities',
  
  // Equity
  EQUITY: '/app/equity',
  SHARES: '/app/shares',
  
  // Admin
  ADMIN_USERS: '/app/admin/users',
  ADMIN_ROLES: '/app/admin/roles',
  ADMIN_AUDIT: '/app/admin/audit-logs',
  
  // Reports
  REPORTS: '/app/reports',
  
  // Settings
  SETTINGS: '/app/settings',
};

// ============================================================================
// SIDEBAR NAVIGATION STRUCTURE
// This is the exact structure displayed in the sidebar
// Organized by founder workflow priorities
// ============================================================================

export const menuItems = [
  // =========================================================================
  // INTELLIGENCE - Quick Overview and Dashboard
  // =========================================================================
  {
    label: 'Intelligence',
    icon: Eye,
    category: 'sections',
    submenu: [
      {
        label: 'Dashboard',
        href: ROUTES.DASHBOARD,
        description: 'Business overview',
      },
      {
        label: 'Overview',
        href: ROUTES.OVERVIEW,
        description: 'Quick metrics',
      },
    ],
  },

  // =========================================================================
  // GROWTH - Sales Pipeline & Lead Management (Founder Priority #1)
  // =========================================================================
  {
    label: 'Growth',
    icon: Target,
    category: 'sections',
    submenu: [
      {
        label: 'Prospects',
        href: ROUTES.PROSPECTS,
        description: 'Track and convert leads',
      },
      {
        label: 'Pipeline',
        href: ROUTES.PIPELINE,
        description: 'Sales pipeline view',
      },
      {
        label: 'Clients',
        href: ROUTES.CLIENTS,
        description: 'Converted clients',
      },
    ],
  },

  // =========================================================================
  // REVENUE - Deals, Contracts, Payments, Finance
  // =========================================================================
  {
    label: 'Revenue',
    icon: DollarSign,
    category: 'sections',
    submenu: [
      {
        label: 'Deals',
        href: ROUTES.DEALS,
        description: 'Active deals',
      },
      {
        label: 'Contracts',
        href: ROUTES.CONTRACTS,
        description: 'Client contracts',
      },
      {
        label: 'Payments',
        href: ROUTES.PAYMENTS,
        description: 'Money received',
      },
      {
        label: 'Finance',
        href: ROUTES.FINANCE,
        description: 'Revenue, expenses, profit',
      },
    ],
  },

  // =========================================================================
  // SYSTEMS - IP Portfolio (What You Sell)
  // =========================================================================
  {
    label: 'Systems',
    icon: Brain,
    category: 'sections',
    submenu: [
      {
        label: 'IP Portfolio',
        href: ROUTES.IP_PORTFOLIO,
        description: 'Products and systems',
      },
    ],
  },

  // =========================================================================
  // OPERATIONS - Assets, Liabilities, Staff (Secondary)
  // =========================================================================
  {
    label: 'Operations',
    icon: Building2,
    category: 'sections',
    submenu: [
      {
        label: 'Assets',
        href: ROUTES.ASSETS,
        description: 'Physical assets',
      },
      {
        label: 'Liabilities',
        href: ROUTES.LIABILITIES,
        description: 'Debts and obligations',
      },
      {
        label: 'Staff',
        href: ROUTES.STAFF,
        description: 'Team management',
      },
      {
        label: 'Infrastructure',
        href: ROUTES.INFRASTRUCTURE,
        description: 'Hosting and tools',
      },
    ],
  },

  // =========================================================================
  // EQUITY - Share Management (For governance)
  // =========================================================================
  {
    label: 'Equity',
    icon: Receipt,
    category: 'sections',
    submenu: [
      {
        label: 'Corporate Equity',
        href: ROUTES.EQUITY,
        description: 'Share structure',
      },
      {
        label: 'Shares',
        href: ROUTES.SHARES,
        description: 'Share allocations',
      },
    ],
  },

  // =========================================================================
  // ADMIN - System Management (Admin only)
  // =========================================================================
  {
    label: 'Admin',
    icon: Settings,
    category: 'sections',
    adminOnly: true,
    submenu: [
      {
        label: 'Users',
        href: ROUTES.ADMIN_USERS,
        description: 'User accounts',
      },
      {
        label: 'Roles',
        href: ROUTES.ADMIN_ROLES,
        description: 'Permissions',
      },
      {
        label: 'Audit Logs',
        href: ROUTES.ADMIN_AUDIT,
        description: 'System activity',
      },
    ],
  },
];

// ============================================================================
// QUICK ACCESS LINKS (Mobile bottom navigation)
// ============================================================================

export const quickAccessLinks = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: ROUTES.DASHBOARD },
  { id: 'prospects', label: 'Prospects', icon: Target, href: ROUTES.PROSPECTS },
  { id: 'deals', label: 'Deals', icon: TrendingUp, href: ROUTES.DEALS },
  { id: 'finance', label: 'Finance', icon: BarChart3, href: ROUTES.FINANCE },
];

// ============================================================================
// PROTECTED & PUBLIC ROUTES
// ============================================================================

export const protectedRoutes = ['/app/*'];
export const publicRoutes = ['/login', '/register'];

// ============================================================================
// SETTINGS ROUTE (Footer)
// ============================================================================

export const settingsRoute = {
  href: ROUTES.SETTINGS,
  label: 'Settings',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
 * Find a menu item by href/path
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
  return currentPath === menuPath || currentPath.startsWith(menuPath + '/');
}

/**
 * Get all valid routes (flattened)
 */
export function getAllValidRoutes() {
  const routes = [];
  function traverse(items) {
    items.forEach((item) => {
      if (item.href) {
        routes.push({
          path: item.href,
          label: item.label,
          protected: item.href.startsWith('/app'),
        });
      }
      if (item.submenu) traverse(item.submenu);
    });
  }
  traverse(menuItems);
  return routes;
}

/**
 * Validate that a route exists in the registry
 */
export function isValidRoute(path) {
  const allRoutes = Object.values(ROUTES);
  return allRoutes.includes(path) || allRoutes.some(r => path.startsWith(r));
}

/**
 * Get parent section for a given route
 */
export function getParentSection(href) {
  for (const section of menuItems) {
    if (section.submenu) {
      const found = section.submenu.find(item => item.href === href);
      if (found) return section;
    }
  }
  return null;
}
