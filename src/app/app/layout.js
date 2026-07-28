import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';
import { RoutePermissionGuard } from '@/components/layout/RoutePermissionGuard';

/**
 * Protected App Layout
 * Server-side auth check before rendering any /app/* routes.
 * Wraps children in RoutePermissionGuard for client-side permission enforcement.
 */

// Force dynamic rendering for every /app/* route. The layout reads the
// session cookie and redirects unauthenticated visitors — neither is
// possible during static prerender, and Next.js will error out on any
// child page that trips the render tree while the layout's redirect
// is in-flight. Declaring dynamic here cascades to every descendant
// route without having to mark each one individually.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  // Check authentication on server before rendering
  const user = await getCurrentUser();
  
  // If no valid session, redirect to login
  if (!user) {
    console.warn('[AppLayout] No valid session found — redirecting to /login');
    redirect('/login');
  }

  // User is authenticated — apply route-level permission guard
  return <RoutePermissionGuard>{children}</RoutePermissionGuard>;
}
