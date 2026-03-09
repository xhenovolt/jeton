'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, LogOut, Settings, HelpCircle, ChevronDown, Bell, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

/**
 * Top Navigation Bar - Futuristic Design
 * Global search, notifications, theme toggle, and user profile
 */
export function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const searchInputRef = useRef(null);
  const profileRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchCurrentUser(); }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvatarText = () => {
    if (!user) return '?';
    return (user.name || user.full_name || user.email || '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Dark mode toggle
  useEffect(() => {
    const dm = localStorage.getItem('jeton-dark-mode');
    setIsDark(dm !== 'false');
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('jeton-dark-mode', String(next));
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    };
    checkSidebarState();
    const handleSidebarToggle = () => { setTimeout(checkSidebarState, 0); };
    window.addEventListener('storage', (e) => { if (e.key === 'sidebar-collapsed') checkSidebarState(); });
    window.addEventListener('sidebar-toggled', handleSidebarToggle);
    return () => { window.removeEventListener('sidebar-toggled', handleSidebarToggle); };
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !searchOpen) { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQuery(''); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Close profile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    if (profileOpen) { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }
  }, [profileOpen]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const mockResults = [
        { id: 1, title: 'Dashboard', category: 'Pages', path: '/app/dashboard' },
        { id: 2, title: 'Prospects', category: 'Pipeline', path: '/app/prospects' },
        { id: 3, title: 'Deals', category: 'Sales', path: '/app/deals' },
        { id: 4, title: 'Finance', category: 'Money', path: '/app/finance' },
        { id: 5, title: 'Settings', category: 'Admin', path: '/app/settings' },
        { id: 6, title: 'Users', category: 'Admin', path: '/app/admin/users' },
      ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(mockResults);
    } else {
      setSearchResults([]);
    }
  };

  return (
    <motion.nav
      animate={{ left: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:fixed md:top-0 md:right-0 md:h-16 md:z-30 md:px-6 md:flex md:items-center md:justify-between border-b border-white/[0.06]"
      style={{ background: 'var(--theme-navbar, #0f172a)' }}
    >
      {/* Left side */}
      <div />

      {/* Center - Search */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <div
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/[0.08] rounded-xl cursor-text hover:border-white/[0.15] transition-all"
          >
            <Search size={16} className="text-gray-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search... (press /)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => { window.location.href = result.path; setSearchOpen(false); setSearchQuery(''); }}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.06] border-b border-white/[0.05] last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-white text-sm">{result.title}</p>
                    <p className="text-xs text-gray-500">{result.category}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchOpen && searchQuery && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-white/[0.1] rounded-xl shadow-2xl z-50 p-4 text-center">
              <p className="text-sm text-gray-500">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl hover:bg-white/[0.08] transition-colors text-gray-400 hover:text-white"
          aria-label="Toggle dark mode"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-white/[0.08] transition-colors text-gray-400 hover:text-white">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full" />
        </button>

        {/* User Profile */}
        <div ref={profileRef} className="relative ml-2">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/[0.08] transition-colors"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white overflow-hidden"
              style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
            >
              {getAvatarText()}
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <p className="text-sm font-medium text-white leading-tight">
                {loading ? '...' : user?.name || user?.full_name || 'User'}
              </p>
              <p className="text-[10px] text-gray-500 leading-tight">
                {loading ? '' : user?.is_superadmin ? 'Superadmin' : user?.role || 'User'}
              </p>
            </div>
            <ChevronDown size={14} className={`text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg text-sm font-bold text-white flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))` }}
                  >
                    {getAvatarText()}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{user?.name || user?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--theme-primary, #3b82f6)' }}>
                      {user?.is_superadmin ? 'Superadmin' : user?.role || 'User'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { window.location.href = '/app/settings'; setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>
                <button
                  onClick={() => { window.location.href = '/app/settings/theme'; setProfileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Sun size={16} />
                  <span>Theme</span>
                </button>
              </div>

              <div className="border-t border-white/[0.06] p-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search backdrop */}
      {searchOpen && searchResults.length > 0 && (
        <div className="fixed inset-0 z-40" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} />
      )}
    </motion.nav>
  );
}
