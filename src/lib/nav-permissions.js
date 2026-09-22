/**
 * Permission-aware navigation filter — shared by Sidebar and MobileDrawer.
 *
 * Contract: a link the user cannot navigate to must NEVER appear in the
 * sidebar, mobile drawer, or bottom nav. This module is the one place that
 * decides "should this row be rendered?". Both the route guard
 * (PermissionGuard) and the API permission checks are independent layers
 * underneath — but the UX layer hides the link first so users don't see
 * "Access denied" pages for things they didn't even know existed.
 *
 * Edge cases handled:
 *   - While permissions are still loading, return an empty list so we
 *     never flash a link the user can't access.
 *   - Superadmins see everything.
 *   - Top-level items with `permission` (no `module`) ARE enforced
 *     (the previous filter only checked `module`).
 *   - When every child of a submenu is denied, the parent disappears
 *     too (the previous filter fell back to the original full submenu).
 *   - Sub-items without their own `permission`/`module` inherit the
 *     parent's `module` gate.
 *   - `minHierarchy` is enforced on both parent and sub-items.
 */

/**
 * Contract:
 *   - Returns null ONLY when we're actively loading AND have no user
 *     yet — the caller should render a skeleton, not iterate the value.
 *   - Returns [] when the user is authenticated but denied every item.
 *   - Returns the filtered array otherwise.
 *
 * Every consumer must handle the null case (coerce with `|| []` at
 * minimum, or branch on `=== null` for a skeleton). Iterating null
 * with for-of / spread will throw "Symbol.iterator, X is null" and
 * crash the layout tree — Sidebar, Navbar, and MobileDrawer all
 * import this and must stay in sync.
 */
export function filterMenuByPermissions(menuItems, ctx) {
  const { user, permLoading, hierarchyLevel, hasPermission, hasModuleAccess } = ctx;
  if (permLoading && !user) return null;
  if (!user) return [];
  if (user.is_superadmin) return menuItems;

  return menuItems.reduce((acc, item) => {
    if (item.minHierarchy && hierarchyLevel > item.minHierarchy) return acc;

    if (item.submenu && item.submenu.length > 0) {
      const filteredSubmenu = item.submenu.filter(sub => {
        if (sub.minHierarchy && hierarchyLevel > sub.minHierarchy) return false;
        if (sub.permission) return hasPermission(sub.permission);
        if (sub.module)     return hasModuleAccess(sub.module);
        return item.module ? hasModuleAccess(item.module) : true;
      });
      if (filteredSubmenu.length === 0) return acc;
      acc.push({ ...item, submenu: filteredSubmenu });
      return acc;
    }

    if (item.permission && !hasPermission(item.permission)) return acc;
    if (item.module     && !hasModuleAccess(item.module))   return acc;
    acc.push(item);
    return acc;
  }, []);
}
