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
      { source: '/app/assets',                     destination: '/app/items?view=assets',      permanent: true },
      { source: '/app/resources',                  destination: '/app/items',                  permanent: true },
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
