'use client';

/**
 * Mobile Bottom Navigation Bar
 * Primary routes for mobile devices (< md screens)
 * Thumb-friendly spacing and sizing
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Handshake,
  Boxes,
  Menu,
} from 'lucide-react';

const primaryRoutes = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Deals', href: '/app/deals', icon: Handshake },
  { label: 'Assets', href: '/app/assets', icon: Boxes },
];

export function MobileBottomNav({ onMenuClick }) {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed md:hidden bottom-0 left-0 right-0 h-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 z-40"
    >
      <div className="flex items-center justify-around h-full px-2">
        {primaryRoutes.map((route) => {
          const isActive = pathname === route.href || pathname.startsWith(route.href);
          const Icon = route.icon;

          return (
            <Link
              key={route.href}
              href={route.href}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs font-medium">{route.label}</span>
            </Link>
          );
        })}

        {/* More Menu Button */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          aria-label="More options"
        >
          <Menu size={24} />
          <span className="text-xs font-medium">More</span>
        </button>
      </div>
    </motion.nav>
  );
}
