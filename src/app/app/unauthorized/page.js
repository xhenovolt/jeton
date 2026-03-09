import Link from 'next/link';
import { ShieldX, LayoutDashboard, Home } from 'lucide-react';

export const metadata = { title: 'Access Denied — Jeton' };

/**
 * Unauthorized access page.
 * Displayed when a user's role doesn't have permission to access a route.
 */
export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-6">
          <ShieldX className="w-8 h-8 text-amber-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-foreground mb-3">Access Denied</h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8 leading-relaxed">
          You don&#39;t have permission to access this page.
          If you believe this is an error, contact your account administrator.
        </p>

        {/* Role info callout */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-8 text-left">
          <p className="font-medium mb-1">Why am I seeing this?</p>
          <p>
            Jeton uses role-based access control (RBAC). Your current role does not
            include permission to view or modify this resource.
          </p>
        </div>

        {/* Navigation actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition"
          >
            <LayoutDashboard size={16} />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-lg font-medium text-sm hover:bg-muted/50 transition"
          >
            <Home size={16} />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
