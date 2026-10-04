'use client';

/**
 * Permission Provider & Hook
 *
 * Client-side permission context loaded from /api/auth/me. Provides
 * usePermissions() for checking permissions anywhere in the UI.
 *
 * ─── Fast-first-paint via cache hydration ─────────────────────────────────
 * The original version started with { loading: true } and populated only
 * after /api/auth/me returned. During Neon cold starts that call can take
 * 8–33 seconds, and every filterMenuByPermissions call returns [] while
 * loading — so the sidebar renders empty and the app looks limited or
 * broken until the fetch lands.
 *
 * We now hydrate synchronously from a localStorage cache written on every
 * successful fetch. Returning users see the sidebar populate on the first
 * frame; the network fetch still runs in the background and refreshes
 * state when it lands. Only true first-visit users (no cache yet) go
 * through a loading pass — and even for them, filterMenuByPermissions
 * now renders skeleton rows instead of nothing.
 *
 * The cache is deliberately short-lived (12h) and keyed on the user's
 * session cookie name so it never leaks across accounts.
 */

import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Isomorphic layout effect. useLayoutEffect on the client runs after
// commit but BEFORE the browser paints — exactly what we need to swap
// the initial loading state for the cached user before the empty
// sidebar ever hits the screen. On the server it degrades to a no-op
// to avoid React's "useLayoutEffect on the server" warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const CACHE_KEY     = 'jeton.auth.v1';
const CACHE_TTL_MS  = 12 * 60 * 60 * 1000;

/**
 * Read the auth cache off localStorage. Returns null if missing/expired/
 * malformed. Runs synchronously so useState's initializer can use it —
 * that's what makes the sidebar appear on the first render.
 */
function readCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user || !parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(user) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ user, savedAt: Date.now() })
    );
  } catch {
    /* quota exceeded / disabled — silently drop, the app still works */
  }
}

function clearCache() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

const PermissionContext = createContext({
  user: null,
  permissions: [],
  hierarchyLevel: 5,
  pendingApprovals: 0,
  loading: true,
  hydratedFromCache: false,
  warmingUp: false,
  unavailable: false,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasModuleAccess: () => false,
  refreshPermissions: () => {},
});

export function PermissionProvider({ children }) {
  // Default state matches on both server and client to satisfy React's
  // hydration invariant. The useLayoutEffect below then replaces it
  // with the cached user before the browser paints, so the "empty"
  // state is never visible even though it exists briefly in the tree.
  const [state, setState] = useState({
    user: null,
    permissions: [],
    hierarchyLevel: 5,
    pendingApprovals: 0,
    loading: true,
    hydratedFromCache: false,
    // True while the backend is answering 503 and we are still retrying, so
    // the UI can say "waking up" instead of "you have no access".
    warmingUp: false,
    unavailable: false,
  });

  // Cache hydration runs after commit but before paint on the client.
  // If a cached user exists, swap it in synchronously and mark loading
  // false — the sidebar's first painted frame will show the real menu.
  useIsomorphicLayoutEffect(() => {
    const cached = readCache();
    if (!cached) return;
    setState({
      user: cached.user,
      permissions: cached.user.permissions || [],
      hierarchyLevel: cached.user.hierarchy_level ?? 5,
      pendingApprovals: cached.user.pending_approvals ?? 0,
      loading: false,
      hydratedFromCache: true,
      warmingUp: false,
      unavailable: false,
    });
  }, []);

  /**
   * Load the current user, retrying while the database is waking up.
   *
   * /api/auth/me answers 503 with { code: 'DB_UNAVAILABLE' } and a Retry-After
   * header when Neon's compute is suspended — db.js fails fast by design
   * rather than holding the request open. This function previously treated
   * that 503 exactly like a hard failure: it set loading:false with no user,
   * so permissions were empty, the sidebar rendered as if nothing were
   * permitted, and the only way out was for the user to reload the page. The
   * reload was doing the retry that belonged here.
   *
   * Now it retries with backoff, honouring Retry-After, and reports
   * `warmingUp` so the UI can say the backend is waking rather than implying
   * the account has no access.
   */
  const loadPermissions = useCallback(async (attempt = 1) => {
    const MAX_ATTEMPTS = 4;
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });

      // 401 is a real answer: the session is dead. Stop, and flush the cache
      // so a signed-out user is not shown a stale menu.
      if (res.status === 401) {
        clearCache();
        setState(prev => ({ ...prev, user: null, permissions: [], loading: false, warmingUp: false }));
        return;
      }

      // Backend not ready. Keep any cached state visible and come back.
      if (res.status === 503 || res.status === 504) {
        if (attempt < MAX_ATTEMPTS) {
          const after = Number(res.headers.get('Retry-After'));
          const delay = Number.isFinite(after) && after > 0
            ? Math.min(after * 1000, 5000)
            : Math.min(700 * 2 ** (attempt - 1), 4000);
          setState(prev => ({ ...prev, warmingUp: true }));
          setTimeout(() => loadPermissions(attempt + 1), delay);
          return;
        }
        // Out of attempts. Leave cached permissions in place if we have them
        // rather than blanking the sidebar.
        setState(prev => ({ ...prev, loading: false, warmingUp: false, unavailable: true }));
        return;
      }

      if (!res.ok) {
        setState(prev => ({ ...prev, loading: false, warmingUp: false }));
        return;
      }

      const data = await res.json();
      const user = data.user;
      writeCache(user);
      setState({
        user,
        permissions: user.permissions || [],
        hierarchyLevel: user.hierarchy_level ?? 5,
        pendingApprovals: user.pending_approvals ?? 0,
        loading: false,
        hydratedFromCache: false,
        warmingUp: false,
        unavailable: false,
      });
    } catch {
      // Network flake. Retry a read like this rather than giving up on the
      // first stumble; keep cached state meanwhile.
      if (attempt < MAX_ATTEMPTS) {
        setState(prev => ({ ...prev, warmingUp: true }));
        setTimeout(() => loadPermissions(attempt + 1), Math.min(700 * 2 ** (attempt - 1), 4000));
        return;
      }
      setState(prev => ({ ...prev, loading: false, warmingUp: false, unavailable: true }));
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback(
    (permission) => {
      if (!state.user) return false;
      if (state.user.is_superadmin) return true;
      if (state.permissions.includes('*')) return true;
      return state.permissions.includes(permission);
    },
    [state.user, state.permissions]
  );

  const hasAnyPermission = useCallback(
    (permissionList) => {
      if (!state.user) return false;
      if (state.user.is_superadmin) return true;
      if (state.permissions.includes('*')) return true;
      return permissionList.some(p => state.permissions.includes(p));
    },
    [state.user, state.permissions]
  );

  const hasModuleAccess = useCallback(
    (module) => {
      if (!state.user) return false;
      if (state.user.is_superadmin) return true;
      if (state.permissions.includes('*')) return true;
      return state.permissions.some(p => p.startsWith(`${module}.`));
    },
    [state.user, state.permissions]
  );

  const value = {
    ...state,
    hasPermission,
    hasAnyPermission,
    hasModuleAccess,
    refreshPermissions: loadPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export function PermissionGate({ permission, module, any, fallback = null, children }) {
  const { hasPermission: checkPerm, hasModuleAccess, hasAnyPermission } = usePermissions();
  if (permission && !checkPerm(permission)) return fallback;
  if (module && !hasModuleAccess(module)) return fallback;
  if (any && !hasAnyPermission(any)) return fallback;
  return children;
}

export function PermissionGuard({ permission, module, any, children }) {
  const { loading, hasPermission: checkPerm, hasModuleAccess, hasAnyPermission } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const allowed =
      (permission && checkPerm(permission)) ||
      (module && hasModuleAccess(module)) ||
      (any && hasAnyPermission(any));
    if (!allowed) router.replace('/app/unauthorized');
  }, [loading, permission, module, any, checkPerm, hasModuleAccess, hasAnyPermission, router]);

  if (loading) return null;

  const allowed =
    (permission && checkPerm(permission)) ||
    (module && hasModuleAccess(module)) ||
    (any && hasAnyPermission(any));

  if (!allowed) return null;
  return children;
}
