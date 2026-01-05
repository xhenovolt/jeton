'use client';

import { useState } from 'react';
import { Menu, Home, Zap, TrendingUp, MoreHorizontal } from 'lucide-react';

/**
 * Mobile Bottom Navigation Bar
 * Only visible on small screens - shows crucial links and drawer toggle
 */
export function MobileBottomNav({ onDrawerOpen }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const quickLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/app/dashboard' },
    { id: 'assets', label: 'Assets', icon: Zap, href: '/app/assets-accounting' },
    { id: 'ip', label: 'IP', icon: TrendingUp, href: '/app/intellectual-property' },
  ];

  const handleNavClick = (href) => {
    window.location.href = href;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border z-30 flex items-center justify-between px-4">
      <div className="flex items-center justify-between w-full">
        {/* Quick Links */}
        <div className="flex items-center gap-0 flex-1">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                onClick={() => {
                  setActiveTab(link.id);
                  handleNavClick(link.href);
                }}
                className={`flex flex-col items-center justify-center flex-1 py-3 px-2 transition-colors ${
                  activeTab === link.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={link.label}
              >
                <Icon size={24} />
                <span className="text-xs mt-1 font-medium">{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* Drawer Toggle */}
        <button
          onClick={onDrawerOpen}
          className="flex flex-col items-center justify-center py-3 px-4 text-muted-foreground hover:text-foreground transition-colors"
          title="More options"
        >
          <MoreHorizontal size={24} />
          <span className="text-xs mt-1 font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
