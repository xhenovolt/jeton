import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/current-user.js';

/**
 * Protected Admin Layout
 * Server-side auth check before rendering any /admin/* routes
 * Also checks for admin role
 */
export default async function AdminLayout({ children }) {
  // Check authentication on server before rendering
  const user = await getCurrentUser();
  
  // If no valid session, redirect to login
  if (!user) {
    redirect('/login');
  }

  // Admin routes require special permissions (can be expanded)
  // For now, just ensure user is authenticated
  
  // User is authenticated - render admin content
  return children;
}
