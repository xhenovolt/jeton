'use client';

/**
 * Intelligence hub layout.
 *
 * Every intelligence / analytics view lives under /app/intelligence/* and
 * shares this tab bar, instead of being scattered across top-level routes
 * (issue-intelligence, tech-intelligence, financial-intelligence,
 * prospects/intelligence). Tabs come from the sidebar config so the two
 * can't drift, and are filtered by the same permission rules.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { INTELLIGENCE_TABS } from '@/lib/navigation-config';
import { usePermissions } from '@/components/providers/PermissionProvider';

function isActive(pathname, href) {
  if (href === '/app/intelligence') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function IntelligenceLayout({ children }) {
  const pathname = usePathname();
  const { user, hasPermission, hasModuleAccess } = usePermissions();

  const tabs = INTELLIGENCE_TABS.filter(tab => {
    if (!user) return false;
    if (user.is_superadmin || !tab.permission) return true;
    return hasPermission(tab.permission) || hasModuleAccess(tab.permission.split('.')[0]);
  });

  return (
    <div>
      {tabs.length > 1 && (
        <nav className="px-6 pt-4 border-b border-border overflow-x-auto" aria-label="Intelligence sections">
          <div className="flex gap-1 max-w-7xl mx-auto">
            {tabs.map(tab => {
              const active = isActive(pathname, tab.href);
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
      )}
      {children}
    </div>
  );
}
