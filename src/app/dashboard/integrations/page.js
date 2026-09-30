/**
 * Compatibility redirect for /dashboard/integrations.
 * The page now lives inside the protected /app tree (session + permission
 * guarded) at /app/dashboard/integrations, which is where the sidebar links.
 */
import { redirect } from 'next/navigation';

export default function IntegrationsCompat() {
  redirect('/app/dashboard/integrations');
}
