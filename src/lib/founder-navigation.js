/**
 * Founder Operating System - Route Registry
 * SINGLE SOURCE OF TRUTH for all navigation
 * No duplicates. No phantom routes. Clear hierarchy.
 *
 * This file:
 * - Defines every valid route in the app
 * - Ensures no duplicate menu items
 * - Provides structured hierarchy by workflow
 * - Can be referenced for integration testing
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
 * FOUNDER OPERATING SYSTEM
 *
 * Workflow: Prospect → Follow-up → Convert → Contract → Collect → Profit
 *
 * Organized by founder need, not by data model
 */
export const founderRouteRegistry = {
  // ===========================================================================
  // GROWTH STAGE (Prospect → Convert workflow)
  // ===========================================================================
  growth: {
    group: 'Growth',
    description: 'Today\'s prospecting, follow-ups, conversions',
    routes: [
      {
        label: 'Prospects',
        path: '/app/prospects',
        icon: Target,
        description: 'Quick add, track, follow-up on cold/warm leads',
        actions: ['Quick Add', 'Activity Timeline', 'Stage Management'],
      },
      {
        label: 'Follow-ups',
        path: '/app/prospects/followups',
        icon: AlertCircle,
        description: 'Overdue and upcoming follow-up dates (high velocity)',
        actions: ['Mark Done', 'Log Outcome', 'Schedule Next'],
      },
      {
        label: 'Conversions',
        path: '/app/prospects/conversions',
        icon: CheckCircle,
        description: 'Recently converted leads → ready for contracts',
        actions: ['Convert to Client', 'Create Contract'],
      },
    ],
  },

  // ===========================================================================
  // REVENUE STAGE (Contract → Collect workflow)
  // ===========================================================================
  revenue: {
    group: 'Revenue',
    description: 'Contracts, payments, allocations',
    routes: [
      {
        label: 'Contracts',
        path: '/app/contracts',
        icon: FileText,
        description: 'Manage contracts (system sold, recurring config, pricing)',
        actions: ['Create', 'View', 'Status'],
      },
      {
        label: 'Collections',
        path: '/app/collections',
        icon: DollarSign,
        description: 'Money received, allocation tracking, allocation status',
        actions: ['Record Payment', 'Allocate', 'Match to Contract'],
      },
      {
        label: 'Allocations',
        path: '/app/allocations',
        icon: Percent,
        description: 'Where money goes (operating, vault, expenses, investment)',
        actions: ['Allocate to', 'View Breakdown', 'Reconcile'],
      },
    ],
  },

  // ===========================================================================
  // VISIBILITY STAGE (Real-time founder view)
  // ===========================================================================
  visibility: {
    group: 'Visibility',
    description: 'Financial clarity (real-time)',
    routes: [
      {
        label: 'Finance Dashboard',
        path: '/app/finance-dashboard',
        icon: BarChart3,
        description: 'Total revenue, expenses, profit, vault balance, projections',
        actions: ['View Metrics', 'Filter by Date', 'Export Report'],
      },
    ],
  },

  // ===========================================================================
  // SYSTEMS (IP Portfolio - what you sell)
  // ===========================================================================
  systems: {
    group: 'Systems',
    description: 'IP portfolio (what you sell)',
    routes: [
      {
        label: 'IP Portfolio',
        path: '/app/intellectual-property',
        icon: Brain,
        description: 'Systems, products, recurring revenue potential',
        actions: ['Create System', 'View Revenue', 'Manage Pricing'],
      },
    ],
  },

  // ===========================================================================
  // OPERATIONS (Staff, Infrastructure - overhead)
  // ===========================================================================
  operations: {
    group: 'Operations',
    description: 'Team and infrastructure',
    routes: [
      {
        label: 'Staff',
        path: '/app/staff',
        icon: Users,
        description: 'Team members, roles, permissions',
        actions: ['Add Staff', 'Manage Roles'],
      },
      {
        label: 'Infrastructure',
        path: '/app/infrastructure',
        icon: Building2,
        description: 'Hosting, tools, costs',
        actions: ['Add Infrastructure', 'Track Cost'],
      },
    ],
  },

  // ===========================================================================
  // ADMIN (System management)
  // ===========================================================================
  admin: {
    group: 'Admin',
    description: 'System configuration and audit',
    routes: [
      {
        label: 'Users',
        path: '/admin/users',
        icon: Users,
        description: 'User accounts and access',
      },
      {
        label: 'Activity Logs',
        path: '/admin/audit-logs',
        icon: BookOpen,
        description: 'Audit trail of all actions',
      },
    ],
  },
};

/**
 * Generate sidebar menu from route registry
 * Each group becomes a collapsible menu section
 */
export const generateSidebarMenu = () => {
  return Object.entries(founderRouteRegistry).map(([key, section]) => ({
    label: section.group,
    description: section.description,
    icon: section.routes[0]?.icon,
    submenu: section.routes.map((route) => ({
      label: route.label,
      href: route.path,
      icon: route.icon,
      description: route.description,
    })),
  }));
};

/**
 * Get all valid routes for auth/integration testing
 */
export const getAllValidRoutes = () => {
  const routes = [];
  Object.values(founderRouteRegistry).forEach((section) => {
    section.routes.forEach((route) => {
      routes.push({
        path: route.path,
        label: route.label,
        group: section.group,
      });
    });
  });
  return routes;
};

/**
 * Navigation menu for sidebar (pre-built)
 * Generated from route registry
 */
export const menuItems = [
  // Primary Quick Access
  {
    label: 'Dashboard',
    href: '/app/dashboard',
    icon: Home,
    category: 'primary',
  },

  // GROWTH SECTION
  {
    label: 'Growth',
    icon: Target,
    category: 'sections',
    submenu: [
      {
        label: 'Prospects',
        href: '/app/prospects',
        description: 'Track and convert leads',
      },
      {
        label: 'Follow-ups',
        href: '/app/prospects/followups',
        description: 'Today\'s follow-up list',
      },
      {
        label: 'Conversions',
        href: '/app/prospects/conversions',
        description: 'Convert to clients',
      },
    ],
  },

  // REVENUE SECTION
  {
    label: 'Revenue',
    icon: DollarSign,
    category: 'sections',
    submenu: [
      {
        label: 'Contracts',
        href: '/app/contracts',
        description: 'Manage contracts',
      },
      {
        label: 'Collections',
        href: '/app/collections',
        description: 'Track payments',
      },
      {
        label: 'Allocations',
        href: '/app/allocations',
        description: 'Money routing',
      },
    ],
  },

  // VISIBILITY SECTION
  {
    label: 'Visibility',
    icon: BarChart3,
    category: 'sections',
    submenu: [
      {
        label: 'Finance Dashboard',
        href: '/app/finance-dashboard',
        description: 'Real-time metrics',
      },
    ],
  },

  // SYSTEMS SECTION
  {
    label: 'Systems',
    icon: Brain,
    category: 'sections',
    submenu: [
      {
        label: 'IP Portfolio',
        href: '/app/intellectual-property',
        description: 'What you sell',
      },
    ],
  },

  // OPERATIONS SECTION
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

  // ADMIN SECTION
  {
    label: 'Admin',
    icon: Settings,
    category: 'sections',
    submenu: [
      {
        label: 'Users',
        href: '/admin/users',
        description: 'User accounts',
      },
      {
        label: 'Activity Logs',
        href: '/admin/audit-logs',
        description: 'Audit trail',
      },
    ],
  },
];

/**
 * Protected routes - require authentication
 */
export const protectedRoutes = [
  '/app/*',
  '/admin/*',
  '/app/dashboard',
  '/app/overview',
  '/app/prospects',
  '/app/prospects/followups',
  '/app/prospects/conversions',
  '/app/contracts',
  '/app/collections',
  '/app/allocations',
  '/app/finance-dashboard',
  '/app/intellectual-property',
  '/app/staff',
  '/app/infrastructure',
  '/admin/users',
  '/admin/audit-logs',
];

/**
 * Get all hrefs from menu items recursively
 */
export function getAllHrefs(items = menuItems) {
  const hrefs = [];
  items.forEach((item) => {
    if (item.href) hrefs.push(item.href);
    if (item.submenu) {
      hrefs.push(...getAllHrefs(item.submenu));
    }
  });
  return hrefs;
}

/**
 * Find menu item by path
 */
export function findMenuItemByPath(path, items = menuItems) {
  for (const item of items) {
    if (item.href === path) return item;
    if (item.submenu) {
      const found = findMenuItemByPath(path, item.submenu);
      if (found) return found;
    }
  }
  return null;
}
