'use client';

/**
 * Enhanced Sidebar Navigation - Futuristic Design
 * Collapsible, theme-aware sidebar with smooth animations
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
  Target,
  Shield,
} from 'lucide-react';
import { menuItems as configMenuItems } from '@/lib/navigation-config';

/**
 * Tooltip Component
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
        <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-lg whitespace-nowrap pointer-events-none z-50 font-medium shadow-xl">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-100" />
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    Growth: false,
    Investments: false,
    Finance: true,
    Systems: false,
    Operations: false,
    Admin: false,
  });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayMenuItems, setDisplayMenuItems] = useState(configMenuItems);

  useEffect(() => { fetchCurrentUser(); }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        if (!(data.user?.is_superadmin || data.user?.role === 'admin' || data.user?.role === 'superadmin')) {
          setDisplayMenuItems(configMenuItems.filter(item => item.label !== 'Admin'));
        }
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) setIsCollapsed(JSON.parse(saved));
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
      window.dispatchEvent(new CustomEvent('sidebar-toggled'));
      return newState;
    });
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (href) => pathname === href;
  const isParentActive = (submenu) => submenu?.some((item) => pathname === item.href);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) window.location.href = '/app/dashboard';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:flex fixed left-0 top-0 h-screen flex-col shadow-xl overflow-hidden z-40 border-r border-white/[0.06]"
      style={{ background: 'var(--theme-sidebar, #0f172a)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/[0.06]">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-sm font-bold text-white">J</span>
            </div>
            <span className="font-bold text-lg text-white">Jeton</span>
          </motion.div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors ml-auto"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }}>
            <ChevronLeft size={20} className="text-gray-400" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin">
        <AnimatePresence>
          {displayMenuItems.map((item) => {
            const Icon = item.icon;
            const hasSubmenu = item.submenu && item.submenu.length > 0;
            const isExpanded = expandedSections[item.label];
            const isItemActive = isActive(item.href);
            const isParentItemActive = isParentActive(item.submenu);

            if (!hasSubmenu) {
              return (
                <Tooltip key={item.href} label={item.label}>
                  <Link
                    href={item.href}
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isItemActive
                        ? 'bg-white/[0.1] text-white shadow-sm'
                        : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon size={20} className={isItemActive ? 'text-blue-400' : ''} />
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
                    {isItemActive && (
                      <motion.div
                        layoutId="activeSidebarDirect"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full"
                        style={{ background: 'var(--theme-primary, #3b82f6)' }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </Link>
                </Tooltip>
              );
            } else {
              return (
                <div key={item.label}>
                  <Tooltip label={item.label}>
                    <button
                      onClick={() => toggleSection(item.label)}
                      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                        isParentItemActive
                          ? 'bg-white/[0.06] text-white'
                          : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <Icon size={20} className={isParentItemActive ? 'text-purple-400' : ''} />
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
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown size={16} />
                          </motion.div>
                        </>
                      )}
                      {isParentItemActive && (
                        <motion.div
                          layoutId="activeSidebarParent"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-purple-500 rounded-r-full"
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </button>
                  </Tooltip>

                  <AnimatePresence>
                    {isExpanded && !isCollapsed && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 border-l border-white/[0.08] space-y-0.5 py-1">
                          {item.submenu.map((subitem) => (
                            <Link
                              key={subitem.href}
                              href={subitem.href}
                              className={`relative block px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                                isActive(subitem.href)
                                  ? 'text-blue-400 font-medium bg-white/[0.05]'
                                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                              }`}
                            >
                              {subitem.label}
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
      <div className="p-2 border-t border-white/[0.06]">
        <Tooltip label="Create new item">
          <button className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
          >
            <Plus size={18} />
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm">
                Add
              </motion.span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/[0.06] space-y-1">
        <Tooltip label="Settings">
          <Link
            href="/app/settings"
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              isActive('/app/settings')
                ? 'bg-white/[0.1] text-white'
                : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <Settings size={20} />
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium flex-1">
                Settings
              </motion.span>
            )}
          </Link>
        </Tooltip>

        <Tooltip label="Logout">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut size={20} />
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium flex-1 text-left">
                Logout
              </motion.span>
            )}
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
