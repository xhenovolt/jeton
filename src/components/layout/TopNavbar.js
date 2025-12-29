'use client';

/**
 * Top Navigation Bar
 * Displays breadcrumbs and user info
 * Only visible on md screens and above
 */

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const pathLabels = {
  '/app/overview': 'Overview',
  '/app/assets': 'Assets',
  '/app/liabilities': 'Liabilities',
  '/app/deals': 'Deals',
  '/app/pipeline': 'Pipeline',
  '/app/valuation': 'Valuation',
  '/app/audit': 'Audit Logs',
  '/app/settings': 'Settings',
};

export function TopNavbar() {
  const pathname = usePathname();
  const pageName = pathLabels[pathname] || 'Dashboard';

  return (
    <motion.nav
      initial={{ y: -64 }}
      animate={{ y: 0 }}
      className="hidden md:flex items-center justify-between h-16 px-8 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 fixed top-0 left-0 right-0 z-30"
    >
      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-sm">Dashboard</span>
        <ChevronRight size={16} className="text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-white">
          {pageName}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-white font-semibold text-sm">X</span>
        </div>
      </div>
    </motion.nav>
  );
}
