'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X, LogOut, Settings, Users, Activity, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * Enhanced Navbar with Real User Identity
 * Shows logged-in user info, roles, avatar, and active session count
 */
export function EnhancedNavbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef(null);
  const profileRef = useRef(null);
  const router = useRouter();

  // Fetch real user data on mount
  useEffect(() => {
    fetchUserProfile();
    const interval = setInterval(fetchUserProfile, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Not authenticated');

      const data = await response.json();
      setUser(data.user);

      // Fetch user's sessions
      if (data.user?.id) {
        const sessionsResponse = await fetch(`/api/admin/users/${data.user.id}/sessions`, {
          credentials: 'include',
        });

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          setSessions(sessionsData.data || []);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setLoading(false);
    }
  };

  // Monitor sidebar state
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      setIsCollapsed(saved ? JSON.parse(saved) : false);
    };

    checkSidebarState();

    const handleStorageChange = (e) => {
      if (e.key === 'sidebar-collapsed') {
        checkSidebarState();
      }
    };

    const handleSidebarToggle = () => {
      setTimeout(checkSidebarState, 0);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sidebar-toggled', handleSidebarToggle);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebar-toggled', handleSidebarToggle);
    };
  }, []);

  // Keyboard shortcuts
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSessionKill = async (sessionId) => {
    try {
      await fetch(`/api/admin/users/${user.id}/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchUserProfile();
    } catch (error) {
      console.error('Error killing session:', error);
    }
  };

  const getAvatarText = () => {
    if (!user) return '?';
    return (user.full_name || user.username || user.email)
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      superadmin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      staff: 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return colors[role?.toLowerCase()] || colors.viewer;
  };

  const activeSessions = sessions.filter((s) => s.is_active);

  return (
    <nav
      className={`fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-40 transition-all duration-300 ${
        isCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Search */}
        <div className="flex-1 max-w-md">
          {searchOpen ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setSearchOpen(false);
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full text-left px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Search...</span>
              <span className="ml-auto text-xs text-gray-400">/</span>
            </button>
          )}
        </div>

        {/* Right: User Profile */}
        <div className="flex items-center gap-6 ml-6">
          {/* Quick Icons */}
          {user?.is_superadmin && (
            <Link
              href="/app/admin/users"
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900"
              title="User Management"
            >
              <Users className="w-5 h-5" />
            </Link>
          )}

          {/* Profile Menu */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
            >
              {/* Avatar */}
              {user?.profile_photo_url ? (
                <img
                  src={user.profile_photo_url}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                  {getAvatarText()}
                </div>
              )}

              {/* User Info */}
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-gray-900">
                  {user?.full_name || user?.username || 'User'}
                </div>
                <div className="text-xs text-gray-500">
                  {user?.roles?.[0] || 'User'}
                </div>
              </div>

              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4 space-y-3">
                {/* User Info */}
                <div className="pb-3 border-b">
                  <div className="font-semibold text-gray-900">
                    {user?.full_name || user?.username}
                  </div>
                  <div className="text-sm text-gray-600">{user?.email}</div>
                  <div className="mt-2 flex gap-1">
                    {user?.is_superadmin ? (
                      <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                        Superadmin
                      </span>
                    ) : (
                      user?.roles?.map((role) => (
                        <span
                          key={role}
                          className={`inline-block text-xs px-2 py-1 rounded ${getRoleBadgeColor(
                            role
                          )}`}
                        >
                          {role}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <Link
                  href={`/app/admin/users/${user?.id}`}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-gray-700 hover:text-gray-900"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-sm">Account Settings</span>
                </Link>

                <Link
                  href={`/app/admin/users/${user?.id}?tab=sessions`}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-gray-700 hover:text-gray-900"
                  onClick={() => setProfileOpen(false)}
                >
                  <Activity className="w-4 h-4" />
                  <div className="text-sm flex-1">Sessions</div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {activeSessions.length}
                  </span>
                </Link>

                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="text-xs font-semibold text-gray-600 mb-2">
                      Active Sessions
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {activeSessions.slice(0, 3).map((session) => (
                        <div
                          key={session.id}
                          className="text-xs bg-gray-50 p-2 rounded flex justify-between items-start gap-2"
                        >
                          <div>
                            <div className="font-medium">{session.device_name}</div>
                            <div className="text-gray-600">
                              {session.browser}
                            </div>
                            <div className="text-gray-500">
                              {session.country} • {session.city}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSessionKill(session.id)}
                            className="text-red-600 hover:text-red-800 whitespace-nowrap"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logout */}
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-50 rounded text-red-600 hover:text-red-700 border-t"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
