/**
 * Navigation Configuration - FOUNDER OPERATING SYSTEM
 * 
 * Single Source of Truth for all navigation
 * Organized by founder workflow: Prospect→Convert→Contract→Collect→Profit
 * 
 * NO DUPLICATES. NO PHANTOM ROUTES.
 * Every route here must exist in /src/app/
 */

import {
  Home,
  Users,
  Zap,
  TrendingUp,
  DollarSign,
  BookOpen,
  Settings,
  LogOut,
  Target,
  CheckCircle,
  FileText,
  Building2,
  Brain,
  Percent,
  Eye,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

/**
 * FOUNDER OPERATING SYSTEM NAVIGATION
 * Direct mapping to user workflow, not data models
 * ALL ROUTES CONSOLIDATED IN /app/app/
 * 
 * Workflow: Prospect → Follow-up → Convert → Collect → Allocate → Profit
 */
export const menuItems = [
  // =========================================================================
  // PRIMARY - Quick Access
  // =========================================================================
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

  // =========================================================================
  // GROWTH - Sales Pipeline & Lead Management
  // =========================================================================
  {
    label: 'Growth',
    icon: Target,
    category: 'sections',
    submenu: [
      {
        label: 'Prospects',
        href: '/app/prospecting',
        description: 'Track and convert leads',
      },
      {
        label: 'Follow-ups',
        href: '/app/prospecting/followups',
        description: 'Today\'s follow-ups',
      },
      {
        label: 'Conversions',
        href: '/app/prospecting/conversions',
        description: 'Ready to convert',
      },
      {
        label: 'Prospect Dashboard',
        href: '/app/prospecting/dashboard',
        description: 'Pipeline overview',
      },
      {
        label: 'Sales',
        href: '/app/sales',
        description: 'Sales management',
      },
    ],
  },

  // =========================================================================
  // INVESTMENTS - Deals & Valuation
  // =========================================================================
  {
    label: 'Investments',
    icon: TrendingUp,
    category: 'sections',
    submenu: [
      {
        label: 'Deals',
        href: '/app/deals',
        description: 'Manage investment deals',
      },
      {
        label: 'Pipeline',
        href: '/app/pipeline',
        description: 'Deal pipeline',
      },
      {
        label: 'Valuation',
        href: '/app/valuation',
        description: 'Company valuation',
      },
    ],
  },

  // =========================================================================
  // FINANCE - Assets, Liabilities & Equity
  // =========================================================================
  {
    label: 'Finance',
    icon: DollarSign,
    category: 'sections',
    submenu: [
      {
        label: 'Finance Dashboard',
        href: '/app/finance',
        description: 'Revenue, expenses, profit',
      },
      {
        label: 'Assets',
        href: '/app/assets-accounting',
        description: 'Asset management',
      },
      {
        label: 'Liabilities',
        href: '/app/liabilities',
        description: 'Liability tracking',
      },
      {
        label: 'Corporate Equity',
        href: '/app/equity',
        description: 'Share distributions',
      },
      {
        label: 'Share Allocations',
        href: '/app/shares',
        description: 'Equity allocations',
      },
      {
        label: 'Invoices',
        href: '/app/invoices',
        description: 'Invoice management',
      },
      {
        label: 'Reports',
        href: '/app/reports',
        description: 'Financial reports',
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
        href: '/app/intellectual-property',
        description: 'Patents, technology & assets',
      },
    ],
  },

  // =========================================================================
  // OPERATIONS - Team & Infrastructure
  // =========================================================================
  {
    label: 'Operations',
    icon: Building2,
    category: 'sections',
    submenu: [
      {
        label: 'Staff',
        href: '/app/staff',
        description: 'Team management',
      },
      {
        label: 'Infrastructure',
        href: '/app/infrastructure',
        description: 'Tools and hosting',
      },
    ],
  },

  // =========================================================================
  // ADMIN - System Management (Admin/Superadmin only)
  // =========================================================================
  {
    label: 'Admin',
    icon: Settings,
    category: 'sections',
    submenu: [
      {
        label: 'Users',
        href: '/app/admin/users',
        description: 'User accounts & roles',
      },
      {
        label: 'Activity Logs',
        href: '/app/admin/audit-logs',
        description: 'System audit trail',
      },
      {
        label: 'Roles & Permissions',
        href: '/app/admin/roles',
        description: 'Role management',
      },
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
    id: 'prospecting',
    label: 'Prospects',
    icon: Target,
    href: '/app/prospecting',
  },
  {
    id: 'deals',
    label: 'Deals',
    icon: TrendingUp,
    href: '/app/deals',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: BarChart3,
    href: '/app/finance',
  },
];

/**
 * Protected routes that require authentication
 * These routes must not be accessible without a valid session
 */
export const protectedRoutes = [
  '/app/*',
];

/**
 * Settings route - always available at footer
 */
export const settingsRoute = {
  href: '/app/settings',
  label: 'Settings',
};

/**
 * Public routes that don't require authentication
 */
export const publicRoutes = [
  '/login',
  '/register',
];

/**
 * Get all hrefs from menu items recursively
 * Useful for active state detection and route validation
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
 * Find a menu item by href/path
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
          protected: item.href.startsWith('/app') || item.href.startsWith('/admin'),
        });
      }
      if (item.submenu) {
        traverse(item.submenu);
      }
    });
  }

  traverse(menuItems);
  return routes;
}
