'use client';

import { useEffect, useState } from 'react';

/**
 * Home Page
 * Displays environment setup status and health check information
 */
export default function Home() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check API health on component mount
    const checkHealth = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/health');
        const data = await response.json();
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check health');
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-background pt-20 px-4">
      {/* Header */}
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Jeton Production Environment
        </h1>
        <p className="text-lg text-muted-foreground mb-12">
          Full-stack Next.js + PostgreSQL application ready for development
        </p>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Environment Setup */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              ✅ Environment Setup
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Next.js 16 with App Router
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Tailwind CSS v4
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                shadcn/ui components
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Framer Motion animations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                PostgreSQL integration
              </li>
            </ul>
          </div>

          {/* Database Health */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              🗄️ Database Status
            </h2>
            {loading && (
              <p className="text-sm text-muted-foreground">
                Checking database connection...
              </p>
            )}
            {error && (
              <div className="text-sm">
                <p className="text-accent-600 font-medium">Error:</p>
                <p className="text-muted-foreground">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure DATABASE_URL in .env.local
                </p>
              </div>
            )}
            {health && !loading && (
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={`font-semibold ${
                      health.status === 'ok'
                        ? 'text-primary'
                        : 'text-accent-600'
                    }`}
                  >
                    {health.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Database:</span>
                  <span
                    className={
                      health.database === 'connected'
                        ? 'text-primary'
                        : 'text-accent-600'
                    }
                  >
                    {health.database}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  <p>Timestamp: {new Date(health.timestamp).toLocaleString()}</p>
                  <p>Uptime: {Math.round(health.uptime)}s</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Color Palettes Section */}
        <div className="border border-border rounded-lg p-6 bg-card mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            🎨 Color Palettes Integrated
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ocean Palette */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Ocean / Trust
              </h3>
              <div className="space-y-2">
                <div className="h-8 rounded bg-[#03045e]"></div>
                <div className="h-8 rounded bg-[#0077b6]"></div>
                <div className="h-8 rounded bg-[#00b4d8]"></div>
                <div className="h-8 rounded bg-[#90e0ef]"></div>
                <div className="h-8 rounded bg-[#caf0f8]"></div>
              </div>
            </div>

            {/* Royal Purple Palette */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Royal Purple
              </h3>
              <div className="space-y-2">
                <div className="h-8 rounded bg-[#10002b]"></div>
                <div className="h-8 rounded bg-[#240046]"></div>
                <div className="h-8 rounded bg-[#3c096c]"></div>
                <div className="h-8 rounded bg-[#9d4edd]"></div>
                <div className="h-8 rounded bg-[#e0aaff]"></div>
              </div>
            </div>

            {/* Power / Authority Palette */}
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                Power / Authority
              </h3>
              <div className="space-y-2">
                <div className="h-8 rounded bg-[#03071e]"></div>
                <div className="h-8 rounded bg-[#6a040f]"></div>
                <div className="h-8 rounded bg-[#d00000]"></div>
                <div className="h-8 rounded bg-[#f48c06]"></div>
                <div className="h-8 rounded bg-[#ffba08]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            📋 Next Steps
          </h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="font-semibold text-foreground min-w-6">1.</span>
              <span>
                Configure <code className="bg-surface-100 px-2 py-1 rounded text-xs">DATABASE_URL</code> in{' '}
                <code className="bg-surface-100 px-2 py-1 rounded text-xs">.env.local</code>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-foreground min-w-6">2.</span>
              <span>
                Set <code className="bg-surface-100 px-2 py-1 rounded text-xs">JWT_SECRET</code> for authentication
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-foreground min-w-6">3.</span>
              <span>
                Build components in <code className="bg-surface-100 px-2 py-1 rounded text-xs">src/components</code>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-foreground min-w-6">4.</span>
              <span>
                Create API routes in <code className="bg-surface-100 px-2 py-1 rounded text-xs">src/app/api</code>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-foreground min-w-6">5.</span>
              <span>
                Deploy to Vercel or your preferred platform
              </span>
            </li>
          </ol>
        </div>

        {/* Documentation Links */}
        <div className="mt-12 text-center text-sm">
          <p className="text-muted-foreground mb-4">
            Documentation & Resources
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Next.js Docs
            </a>
            <a
              href="https://tailwindcss.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Tailwind CSS
            </a>
            <a
              href="https://ui.shadcn.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              shadcn/ui
            </a>
            <a
              href="https://neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Neon PostgreSQL
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
