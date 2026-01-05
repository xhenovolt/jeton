'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CurrencyProvider } from '@/lib/currency-context';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { PageTitle } from '@/components/layout/PageTitle';

const mockUser = {
  name: 'Admin User',
  email: 'admin@jeton.ai',
  role: 'Administrator',
  avatar: '👤',
};

export default function LayoutClient({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  
  // Show navigation only on /app routes
  const showNavigation = pathname.startsWith('/app');
  
  // Monitor sidebar collapsed state
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    };

    checkSidebarState();

    // Listen for sidebar toggle events
    const handleSidebarToggle = () => {
      checkSidebarState();
    };

    window.addEventListener('sidebar-toggled', handleSidebarToggle);
    return () => window.removeEventListener('sidebar-toggled', handleSidebarToggle);
  }, []);
  
  // Adjust main padding based on navigation visibility and sidebar state
  // Mobile: No top padding (navigation is drawer), bottom padding for bottom nav
  // Desktop: Top padding for navbar, left padding for sidebar
  const sidebarWidth = isCollapsed ? '5rem' : '16rem';
  const mainClasses = showNavigation 
    ? `flex-1 md:pt-16 pb-16 md:pb-0 min-h-screen transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`
    : 'flex-1 min-h-screen';
  
  const footerClasses = showNavigation
    ? `border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-8 text-center text-sm text-gray-600 dark:text-gray-400 transition-all duration-300 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`
    : 'border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-8 text-center text-sm text-gray-600 dark:text-gray-400';

  return (
    <CurrencyProvider>
      {/* Page Title Bar - Only on /app routes */}
      {showNavigation && <PageTitle />}

      {/* Main Content Area */}
      <main className={mainClasses}>
        {children}
      </main>

      {/* Footer */}
      <footer className={footerClasses}>
        <p>
          © {new Date().getFullYear()} Jeton. Executive Operating System • v1.0
        </p>
      </footer>

      {/* Mobile Bottom Navigation - Only on /app routes */}
      {showNavigation && (
        <MobileBottomNav 
          onDrawerOpen={() => setDrawerOpen(true)} 
        />
      )}

      {/* Mobile Drawer - Only on /app routes */}
      {showNavigation && (
        <MobileDrawer 
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          user={mockUser}
        />
      )}
    </CurrencyProvider>
  );
}
