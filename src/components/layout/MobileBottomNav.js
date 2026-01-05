'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Zap, TrendingUp, Menu } from 'lucide-react';
import { quickAccessLinks } from '@/lib/navigation-config';

/**
 * Mobile Bottom Navigation Bar
 * 
 * Features:
 * - Visible only on mobile (< md breakpoint)
 * - Quick access to frequently used routes
 * - Menu button to trigger drawer
 * - Active route highlighting
 * - App-like feel
 */
export function MobileBottomNav({ onDrawerOpen }) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Update active tab based on current route
  useEffect(() => {
    quickAccessLinks.forEach((link) => {
      if (pathname === link.href) {
        setActiveTab(link.id);
      }
    });
  }, [pathname]);

  const isActive = (href) => pathname === href;

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 border-t border-gray-200 dark:border-gray-800 z-30 flex items-center"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center w-full h-full">
        {/* Quick Links */}
        <div className="flex items-center flex-1 h-full">
          {quickAccessLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);

            return (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => setActiveTab(link.id)}
                className={`flex-1 flex flex-col items-center justify-center h-full py-2 px-1 transition-colors relative group ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                title={link.label}
                aria-current={active ? 'page' : undefined}
              >
                <motion.div
                  animate={{ scale: active ? 1.1 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon size={24} />
                </motion.div>
                <span className="text-xs mt-1 font-medium text-center leading-none">
                  {link.label}
                </span>

                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="navActiveIndicator"
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600"
                    transition={{ duration: 0.2 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Drawer Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDrawerOpen}
          className="flex flex-col items-center justify-center flex-1 h-full py-2 px-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors border-l border-gray-200 dark:border-gray-800"
          title="More options"
          aria-label="Open navigation menu"
          data-drawer-trigger
        >
          <Menu size={24} />
          <span className="text-xs mt-1 font-medium text-center leading-none">Menu</span>
        </motion.button>
      </div>
    </motion.nav>
  );
}
