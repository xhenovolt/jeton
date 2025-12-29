'use client';

/**
 * App Layout
 * Main layout for authenticated dashboard
 * Includes desktop navigation (sidebar + topbar) and mobile navigation
 */

import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { MobileDrawer } from '@/components/layout/MobileDrawer';

export default function AppLayout({ children }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 flex flex-col">
        {/* Desktop Top Navbar */}
        <TopNavbar />

        {/* Content */}
        <div className="flex-1 pt-0 md:pt-16 pb-20 md:pb-0">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileBottomNav onMenuClick={() => setIsDrawerOpen(true)} />
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
