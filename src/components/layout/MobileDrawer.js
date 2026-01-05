'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Building2, Wallet, Handshake, Eye, Users, BookOpen, Settings, LogOut, ChevronDown, Zap, TrendingUp } from 'lucide-react';

/**
 * Mobile Drawer
 * Shows full navigation and user profile on mobile screens
 */
export function MobileDrawer({ isOpen, onClose, user }) {
  const [expandedSections, setExpandedSections] = useState({
    domains: true,
    admin: false,
  });

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const menuItems = {
    domains: [
      { label: 'Infrastructure', href: '/app/infrastructure', icon: Building2 },
      { label: 'Accounting Assets', href: '/app/assets-accounting', icon: Zap },
      { label: 'Intellectual Property', href: '/app/intellectual-property', icon: TrendingUp },
      { label: 'Liabilities', href: '/app/liabilities', icon: Wallet },
      { label: 'Deals', href: '/app/deals', icon: Handshake },
      { label: 'Pipeline', href: '/app/pipeline', icon: Eye },
    ],
    admin: [
      { label: 'Staff', href: '/app/staff', icon: Users },
      { label: 'Audit Logs', href: '/app/audit-logs', icon: BookOpen },
      { label: 'Settings', href: '/app/settings', icon: Settings },
    ],
  };

  const handleLogout = async () => {
    try {
      // Call logout endpoint to delete session from database
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (response.ok) {
        // Navigate to a protected route (/app/dashboard)
        // Middleware will validate session is gone and redirect to /login
        window.location.href = '/app/dashboard';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="md:hidden fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50 overflow-y-auto">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
            Jeton
          </h1>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <X size={24} className="text-foreground" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-2xl">
              {user.avatar}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-primary font-medium mt-1">{user.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-6">
          {/* Operational Domains */}
          <div>
            <button
              onClick={() => toggleSection('domains')}
              className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>OPERATIONAL DOMAINS</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedSections.domains ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedSections.domains && (
              <div className="mt-2 space-y-1">
                {menuItems.domains.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Administration */}
          <div>
            <button
              onClick={() => toggleSection('admin')}
              className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>ADMINISTRATION</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedSections.admin ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedSections.admin && (
              <div className="mt-2 space-y-1">
                {menuItems.admin.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
          <button
            onClick={async () => {
              await handleLogout();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
