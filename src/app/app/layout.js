import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';

/**
 * Protected App Layout
 * Server-side auth check before rendering any /app/* routes
 * If user is not authenticated, redirects to login
 */
export default async function AppLayout({ children }) {
  // Check authentication on server before rendering
  const user = await getCurrentUser();
  
  // If no valid session, redirect to login
  if (!user) {
    redirect('/login');
  }

  // User is authenticated - render protected content
  return children;
}
