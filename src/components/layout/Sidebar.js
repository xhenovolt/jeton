'use client';

/**
 * Enhanced Sidebar Navigation
 * Modern, collapsible sidebar with full responsiveness
 * Features: collapse/expand, tooltips, active states, dark mode, keyboard nav
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronDown,
  ChevronLeft,
  LogOut,
  Plus,
  Percent,
} from 'lucide-react';
import { menuItems as navMenuItems } from '@/lib/navigation-config';

/**
 * Tooltip Component
 * Shows label text when sidebar is collapsed
 */
function Tooltip({ children, label }) {
  const [show, setShow] = useState(false);

  return (
    <div 
      className="relative group w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute left-full ml-3 px-3 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded whitespace-nowrap pointer-events-none z-50 font-medium">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-100" />
        </div>
      )}
    </div>
  );
}

/**
 * Navigation menu structure - organized by domain
 */
const menuItems = [
  { label: 'Dashboard', href: '/app/dashboard', icon: Home },
  { label: 'Overview', href: '/app/overview', icon: Eye },
  {
    label: 'Operations',
    icon: Zap,
    submenu: [
      { label: 'Staff', href: '/app/staff' },
      { label: 'Infrastructure', href: '/app/infrastructure' },
    ],
  },
  {
    label: 'Investments',
    icon: TrendingUp,
    submenu: [
      { label: 'Deals', href: '/app/deals' },
      { label: 'Pipeline', href: '/app/pipeline' },
      { label: 'Valuation', href: '/app/valuation' },
    ],
  },
  {
    label: 'Finance',
    icon: Wallet,
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
    submenu: [
      { label: 'IP Portfolio', href: '/app/intellectual-property' },
    ],
  },
  {
    label: 'Admin',
    icon: Users,
    submenu: [
      { label: 'Audit Logs', href: '/app/audit-logs' },
      { label: 'Reports', href: '/app/reports' },
    ],
  },
}

/**
 * Sidebar Component - Enhanced
 * Collapsible navigation with smooth animations, tooltips, and dark mode
 * DESKTOP ONLY - Hidden on mobile (md: breakpoint)
 */
export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    Operations: false,
    Investments: false,
    Finance: true,
    'Intellectual Property': false,
    Admin: false,
  });

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('sidebar-toggled'));
      return newState;
    });
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (href) => pathname === href;

  const isParentActive = (submenu) => {
    return submenu?.some((item) => pathname === item.href);
  };

  const handleLogout = async () => {
    try {
      // Call logout endpoint to delete session from database
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        // Navigate to a protected route (/app/dashboard)
        // Middleware will validate session is gone and redirect to /login
        window.location.href = '/app/dashboard';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:flex fixed left-0 top-0 h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-r border-gray-200 dark:border-gray-800 flex-col shadow-sm overflow-hidden z-40"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
          >
            Jeton
          </motion.div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-auto"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <AnimatePresence mode="wait">
          {navMenuItems.map((item) => {
            const Icon = item.icon;
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isExpanded = expandedSections[item.label];
            const isItemActive = isActive(item.href);
            const isParentItemActive = isParentActive(item.submenu);

            if (!hasSubmenu) {
              // Direct link item
              return (
                <Tooltip key={item.href} label={item.label}>
                  <Link
                    href={item.href}
                    className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <Icon size={20} />
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium flex-1"
                      >
                        {item.label}
                      </motion.span>
                    )}
                    
                    {/* Active indicator */}
                    {isItemActive && (
                      <motion.div
                        layoutId={`activeDirectIndicator-${item.href}`}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-lg"
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </Link>
                </Tooltip>
              );
            } else {
              // Parent with submenu
              return (
                <div key={item.label}>
                  <Tooltip label={item.label}>
                    <button
                      onClick={() => toggleSection(item.label)}
                      className="relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                    >
                      <Icon size={20} />
                      {!isCollapsed && (
                        <>
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-sm font-medium flex-1 text-left"
                          >
                            {item.label}
                          </motion.span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={16} />
                          </motion.div>
                        </>
                      )}

                      {/* Active indicator for parent */}
                      {isParentItemActive && (
                        <motion.div
                          layoutId={`activeParentIndicator-${item.label}`}
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-600 rounded-r-lg"
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </button>
                  </Tooltip>

                  {/* Submenu */}
                  <AnimatePresence>
                    {isExpanded && !isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 border-l border-gray-200 dark:border-gray-700 space-y-1 py-1">
                          {item.submenu.map((subitem) => (
                            <Link
                              key={subitem.href}
                              href={subitem.href}
                              className={`relative block px-3 py-1.5 text-sm rounded transition-colors ${
                                isActive(subitem.href)
                                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                              {subitem.label}
                              {isActive(subitem.href) && (
                                <motion.div
                                  layoutId={`activeSubmenuIndicator-${subitem.href}`}
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-600 rounded-r-lg"
                                  transition={{ duration: 0.2 }}
                                />
                              )}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }
          })}
        </AnimatePresence>
      </nav>

      {/* Quick Add Button */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <Tooltip label="Create new item">
          <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-3 rounded-lg transition-all transform hover:scale-105 active:scale-95">
            <Plus size={18} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium"
              >
                Add
              </motion.span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
        <Tooltip label="Settings">
          <Link
            href="/app/settings"
            className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings size={20} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium flex-1"
              >
                Settings
              </motion.span>
            )}
            {isActive('/app/settings') && (
              <motion.div
                layoutId="activeSettingsIndicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-lg"
                transition={{ duration: 0.2 }}
              />
            )}
          </Link>
        </Tooltip>

        <Tooltip label="Logout">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors hover:text-red-600 dark:hover:text-red-400"
          >
            <LogOut size={20} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm font-medium flex-1 text-left"
              >
                Logout
              </motion.span>
            )}
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
