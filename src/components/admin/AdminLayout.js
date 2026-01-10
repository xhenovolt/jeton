'use client';

import React from 'react';

/**
 * Admin Layout
 * Deprecated - No longer needed
 * Navigation is handled by NavigationWrapper for all /app routes
 * Kept for backward compatibility, just renders children
 */
export function AdminLayout({ children }) {
  return <>{children}</>;
}
