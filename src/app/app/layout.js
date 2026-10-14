import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';
import { getCurrentUserFull } from '@/lib/current-user-full.js';
import { PermissionProvider } from '@/components/providers/PermissionProvider';
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

  // Resolve the user's permissions HERE, on the server, and seed the context
  // with them.
  //
  // lib/current-user-full.js was written for exactly this and was never
  // called, so the client provider started empty on every entry to the app and
  // had to fetch /api/auth/me after hydration. Until that landed, every
  // permission check answered "no": the sidebar had no items, the dashboard
  // announced "Limited Access", and the header called a superadmin "User".
  // Refreshing only helped because the second pass had a warm cache to hydrate
  // from. Meanwhile the Navbar looked fine because it fetched for itself —
  // which is the clue that the data was always available, just not shared.
  //
  // Seeding it server-side means the first render, including the HTML streamed
  // from the server, already knows the answer. No round trip, no empty state,
  // nothing to refresh.
  //
  // This provider nests inside the one in the root layout. The inner provider
  // wins for /app/* descendants, while the root one keeps serving /login and
  // the public pages, which have no user to resolve.
  //
  // getCurrentUserFull returns null if the RBAC lookup fails. The redirect
  // above is driven by getCurrentUser(), so a transient failure here degrades
  // to the previous client-fetch behaviour rather than bouncing an
  // authenticated user to /login.
  const fullUser = await getCurrentUserFull();

  return (
    <PermissionProvider initialUser={fullUser}>
      <RoutePermissionGuard>{children}</RoutePermissionGuard>
    </PermissionProvider>
  );
}
