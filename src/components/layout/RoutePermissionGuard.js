'use client';

/**
 * RoutePermissionGuard
 *
 * Global client-side route guard mounted in the /app layout.
 * After permissions load, checks whether the current path requires a specific
 * permission. If the user lacks it, they are redirected to /app/unauthorized.
 *
 * Superadmin bypasses all permission checks.
 * Open routes (OPEN_ROUTES in lib/navigation-config) are accessible to every
 * authenticated user; every other page resolves to a permission.
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePermissions } from '@/components/providers/PermissionProvider';
import { getRoutePermission, isOpenRoute } from '@/lib/navigation-config';

export function RoutePermissionGuard({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, user, hasPermission, hasModuleAccess } = usePermissions();
  const redirectedRef = useRef(false);

  useEffect(() => {
    // Wait until the permission context has resolved
    if (loading) return;
    // No user shouldn't reach here (layout server check handles it), but guard anyway
    if (!user) return;
    // Superadmin has unrestricted access
    if (user.is_superadmin) return;

    // Reset redirect flag when path changes
    redirectedRef.current = false;

    // Check open routes — no permission required
    // Open routes are exact matches (see OPEN_ROUTES). The old prefix list
    // opened every /app/settings/* and /app/dashboard/* page to all roles,
    // including company branding, invoice themes and DRAIS control.
    if (isOpenRoute(pathname)) return;

    // Get the required permission for this route
    const required = getRoutePermission(pathname);
    if (!required) return; // No specific permission mapped → accessible to all

    // Check exact permission OR module-level access
    const [module] = required.split('.');
    const allowed = hasPermission(required) || hasModuleAccess(module);

    if (!allowed && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace('/app/unauthorized');
    }
  }, [loading, user, pathname, hasPermission, hasModuleAccess, router]);

  // Render children while permissions load or when access is confirmed.
  // The redirect (if needed) fires asynchronously so there's no flash of
  // restricted content — the useEffect fires synchronously after paint but
  // before the user can interact.
  return children;
}
