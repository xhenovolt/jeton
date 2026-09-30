/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: '.',
  },
  // Ensure simplewebauthn server package is treated as external (Node-only)
  serverExternalPackages: ['@simplewebauthn/server'],
  // Consolidated routes: old URLs keep working (bookmarks, notifications,
  // links stored in the DB) via permanent server-side redirects.
  async redirects() {
    return [
      { source: '/app/issue-intelligence',         destination: '/app/intelligence/issues',    permanent: true },
      { source: '/app/tech-intelligence',          destination: '/app/intelligence/tech',      permanent: true },
      { source: '/app/tech-intelligence/:id',      destination: '/app/intelligence/tech/:id',  permanent: true },
      { source: '/app/financial-intelligence',     destination: '/app/intelligence/financial', permanent: true },
      { source: '/app/prospects/intelligence',     destination: '/app/intelligence/pipeline',  permanent: true },
      { source: '/dashboard',                      destination: '/app/dashboard',              permanent: true },
      { source: '/dashboard/integrations',         destination: '/app/dashboard/integrations', permanent: true },
      { source: '/designs',                        destination: '/app/designs',                permanent: true },
      { source: '/app/assets',                     destination: '/app/items?view=assets',      permanent: true },
      { source: '/app/resources',                  destination: '/app/items',                  permanent: true },
      { source: '/app/hr',                         destination: '/app/staff/payroll',          permanent: true },
      { source: '/app/hrm',                        destination: '/app/staff/hrm',              permanent: true },
      { source: '/app/org-hierarchy',              destination: '/app/staff/hierarchy',        permanent: true },
      { source: '/app/documents/templates',        destination: '/app/admin/documents/templates', permanent: true },
      { source: '/app/documents/generated',        destination: '/app/admin/documents/generated', permanent: true },
      { source: '/app/documents/settings',         destination: '/app/admin/documents/settings',  permanent: true },
      { source: '/app/documents/verify',           destination: '/app/admin/documents/verify',    permanent: true },
      { source: '/app/sales',                      destination: '/app/deals',                  permanent: true },
      { source: '/app/engineering',                destination: '/app/issues',                 permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
};

export default nextConfig;
