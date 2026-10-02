/**
 * Compatibility redirect for /app/engineering.
 *
 * Navigation advertised /app/engineering for "Bugs, features & tech tracking",
 * but no such page ever existed — the link 404'd. The real engineering surface
 * is /app/issues (auto-logged errors + manual issue reports), which was itself
 * unreachable from navigation.
 *
 * Rather than duplicate that module, navigation now points at /app/issues and
 * this route forwards anything still referencing the old path.
 */
import { redirect } from 'next/navigation';

export default function EngineeringCompat() {
  redirect('/app/issues');
}
