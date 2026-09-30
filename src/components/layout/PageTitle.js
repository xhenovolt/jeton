'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getRouteTitle } from '@/lib/navigation-config';

/**
 * Page Title Component
 * Displays current page title and updates HTML title tag
 */
export function PageTitle() {
  const pathname = usePathname();

  // Titles come from the navigation config (single source of truth) —
  // nearest registered ancestor wins, so /app/deals/123 reads "All Deals".
  const pageTitle = getRouteTitle(pathname) || 'Jeton';
  const fullTitle = pageTitle === 'Jeton' ? 'Jeton - Executive Operating System' : `${pageTitle} | Jeton`;

  // Update HTML title
  useEffect(() => {
    document.title = fullTitle;
  }, [fullTitle]);

  if (pathname === '/' || pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <div className="px-6 py-3 border-b border-border bg-background">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{pageTitle}</p>
    </div>
  );
}
