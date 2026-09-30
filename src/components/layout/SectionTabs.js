'use client';

/**
 * SectionTabs — the in-page tab bar shared by every consolidated section
 * (Intelligence, Staff, …). Tabs are the section's submenu entries from
 * lib/navigation-config.js, so the sidebar and the tabs can never drift,
 * and they are filtered with the same permission rules as the sidebar.
 *
 * Usage (in a section's layout.js):
 *   <SectionTabs tabs={getSectionTabs('staff')} rootHref="/app/staff" label="Staff sections" />
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/components/providers/PermissionProvider';

function isActive(pathname, href, rootHref) {
  if (href === rootHref) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function SectionTabs({ tabs, rootHref, label }) {
  const pathname = usePathname();
  const { user, hasPermission, hasModuleAccess } = usePermissions();

  const visible = tabs.filter(tab => {
    if (!user) return false;
    if (user.is_superadmin || !tab.permission) return true;
    return hasPermission(tab.permission) || hasModuleAccess(tab.permission.split('.')[0]);
  });

  if (visible.length < 2) return null;

  return (
    <nav className="px-6 pt-4 border-b border-border overflow-x-auto" aria-label={label}>
      <div className="flex gap-1 max-w-7xl mx-auto">
        {visible.map(tab => {
          const active = isActive(pathname, tab.href, rootHref);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default SectionTabs;
