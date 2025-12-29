'use client';

/**
 * Desktop Sidebar Navigation
 * Fixed left sidebar with main navigation routes
 * Only visible on md screens and above
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Boxes,
  CreditCard,
  Handshake,
  TrendingUp,
  LineChart,
  BookOpen,
  Settings,
  LogOut,
} from 'lucide-react';

const menuItems = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Overview', href: '/app/overview', icon: TrendingUp },
  { label: 'Assets', href: '/app/assets', icon: Boxes },
  { label: 'Liabilities', href: '/app/liabilities', icon: CreditCard },
  { label: 'Deals', href: '/app/deals', icon: Handshake },
  { label: 'Pipeline', href: '/app/pipeline', icon: LineChart },
  { label: 'Reports', href: '/app/reports', icon: BookOpen },
  { label: 'Audit Logs', href: '/app/audit', icon: BookOpen },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className={`hidden md:fixed md:flex md:flex-col md:left-0 md:top-0 md:h-screen md:bg-slate-900 md:border-r md:border-slate-800 md:z-40 md:transition-all md:duration-300 ${
        isCollapsed ? 'md:w-20' : 'md:w-64'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-800">
        {!isCollapsed && (
          <h1 className="text-lg font-bold text-white tracking-tight">Jeton</h1>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          aria-label="Toggle sidebar"
        >
          {isCollapsed ? (
            <ChevronRight size={20} />
          ) : (
            <ChevronLeft size={20} />
          )}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative group ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                  {isCollapsed && (
                    <div className="absolute left-20 bg-slate-800 text-white px-3 py-2 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {item.label}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer with Settings & Logout */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        <Link
          href="/app/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <Settings size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-900/20 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </motion.aside>
  );
}
