'use client';
/**
 * useHeartbeat — Client-side presence heartbeat
 *
 * Pings POST /api/presence/ping every 30s while the tab is active.
 * Automatically pauses when the tab loses focus and resumes when it regains it.
 *
 * Usage:
 *   // In your root layout or a Provider component:
 *   import { useHeartbeat } from '@/lib/use-heartbeat';
 *   export function PresenceProvider() {
 *     useHeartbeat();
 *     return null;
 *   }
 */

import { useEffect, useRef } from 'react';

const PING_INTERVAL_MS = 30_000; // 30 seconds

export function useHeartbeat() {
  const intervalRef = useRef(null);

  const ping = async () => {
    try {
      await fetch('/api/presence/ping', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Network error — silently ignore, will retry on next tick
    }
  };

  const start = () => {
    if (intervalRef.current) return; // already running
    ping(); // immediate ping on start
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    // Start heartbeat immediately if tab is visible
    if (!document.hidden) start();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

/**
 * Utility: format last_seen timestamp into human-readable string
 * e.g. "2 minutes ago", "just now", "3 hours ago"
 */
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Never';
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (diff < 30)  return 'Just now';
  if (diff < 60)  return 'Less than a minute ago';
  if (diff < 120) return '1 minute ago';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200) return '1 hour ago';
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

/**
 * Presence indicator component (inline)
 * Usage: <PresenceDot status="online" />
 */
export function PresenceDot({ status, lastSeen, showLabel = false }) {
  const isOnline = status === 'online';
  return (
    <span className="inline-flex items-center gap-1.5" title={isOnline ? 'Online' : `Last seen ${formatLastSeen(lastSeen)}`}>
      <span
        className={`inline-block w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
      />
      {showLabel && (
        <span className="text-xs" style={{ color: isOnline ? '#22c55e' : 'var(--sidebar-muted)' }}>
          {isOnline ? 'Online' : `Last seen ${formatLastSeen(lastSeen)}`}
        </span>
      )}
    </span>
  );
}
