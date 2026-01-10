'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, LogOut, Settings, HelpCircle, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

/**
 * Top Navigation Bar Component
 * Global search and quick navigation with user profile
 * Responsive to sidebar collapse state
 */
export function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const searchInputRef = useRef(null);
  const profileRef = useRef(null);

  // Fetch real user data from database
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

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
    if (!user) return '👤';
    return (user.full_name || user.username || user.email)
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Monitor sidebar collapsed state from localStorage
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved) setIsCollapsed(JSON.parse(saved));
    };

    // Initialize state from localStorage
    checkSidebarState();

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e) => {
      if (e.key === 'sidebar-collapsed') {
        checkSidebarState();
      }
    };

    // Listen for custom events from sidebar
    const handleSidebarToggle = () => {
      // Use setTimeout to defer state update and avoid render cycle conflicts
      setTimeout(() => {
        checkSidebarState();
      }, 0);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sidebar-toggled', handleSidebarToggle);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebar-toggled', handleSidebarToggle);
    };
  }, []);

  // Keyboard shortcut: press "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !searchOpen) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [profileOpen]);

  // Simulate search functionality
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 0) {
      // Mock search results
      const mockResults = [
        { id: 1, title: 'Dashboard', category: 'Pages', path: '/app/dashboard' },
        { id: 2, title: 'Accounting Assets', category: 'Pages', path: '/app/assets-accounting' },
        { id: 3, title: 'Intellectual Property', category: 'Pages', path: '/app/intellectual-property' },
        { id: 4, title: 'Infrastructure', category: 'Pages', path: '/app/infrastructure' },
        { id: 5, title: 'Liabilities', category: 'Pages', path: '/app/liabilities' },
        { id: 6, title: 'Deals', category: 'Pages', path: '/app/deals' },
        { id: 7, title: 'Pipeline', category: 'Pages', path: '/app/pipeline' },
        { id: 8, title: 'Staff', category: 'Admin', path: '/app/staff' },
        { id: 9, title: 'Settings', category: 'Admin', path: '/app/settings' },
        { id: 10, title: 'Audit Logs', category: 'Admin', path: '/app/audit-logs' },
      ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));

      setSearchResults(mockResults);
    } else {
      setSearchResults([]);
    }
  };

  const handleResultClick = (path) => {
    window.location.href = path;
    setSearchOpen(false);
    setSearchQuery('');
  };

  return (
    <motion.nav
      animate={{ left: isCollapsed ? '5rem' : '16rem' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden md:fixed md:top-0 md:right-0 md:h-16 md:bg-gradient-to-r md:from-gray-50 md:to-white dark:md:from-gray-900 dark:md:to-gray-950 md:border-b md:border-gray-200 dark:md:border-gray-800 md:z-30 md:px-6 md:flex md:items-center md:justify-between"
    >
      {/* Left side - empty for balance */}
      <div></div>

      {/* Center - Search Bar */}
      <div className="flex-1 max-w-md mx-auto">
        <div className="relative">
          <div
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-text hover:border-blue-600/50 transition-colors"
          >
            <Search size={18} className="text-gray-600 dark:text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search... (press / to focus)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
              <div className="max-h-96 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result.path)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{result.title}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{result.category}</p>
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {result.path.split('/').pop()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state message */}
          {searchOpen && searchQuery && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - User Profile Dropdown */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 text-lg overflow-hidden">
            {user?.profile_photo_url ? (
              <img
                src={user.profile_photo_url}
                alt={user.full_name || 'User'}
                className="w-full h-full object-cover"
              />
            ) : (
              getAvatarText()
            )}
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {loading ? 'Loading...' : user?.full_name || user?.username || 'User'}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {loading ? '...' : user?.is_superadmin ? 'Superadmin' : user?.roles?.[0] || 'User'}
            </p>
          </div>
          <ChevronDown size={16} className={`text-gray-600 dark:text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Profile Dropdown Menu */}
        {profileOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            {/* User Info Section */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20 text-2xl overflow-hidden">
                  {user?.profile_photo_url ? (
                    <img
                      src={user.profile_photo_url}
                      alt={user.full_name || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getAvatarText()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {user?.full_name || user?.username || 'User'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">
                    {user?.is_superadmin ? 'Superadmin' : user?.roles?.[0] || 'User'}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              <button
                onClick={() => {
                  window.location.href = '/app/settings';
                  setProfileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings size={16} />
                <span>Settings & Privacy</span>
              </button>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  // TODO: Implement help
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <HelpCircle size={16} />
                <span>Help & Support</span>
              </button>
            </div>

            {/* Logout Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/auth/logout', {
                      method: 'POST',
                      credentials: 'include',
                    });
                    if (response.ok) {
                      window.location.href = '/login';
                    }
                  } catch (error) {
                    console.error('Logout error:', error);
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search overlay backdrop */}
      {searchOpen && searchResults.length > 0 && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setSearchOpen(false);
            setSearchQuery('');
          }}
        />
      )}
    </motion.nav>
  );
}
