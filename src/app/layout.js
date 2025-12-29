import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Jeton - Production-Grade Next.js App',
  description: 'A full-stack Next.js application with PostgreSQL integration',
  keywords: ['next.js', 'react', 'tailwindcss', 'postgresql'],
  authors: [{ name: 'Development Team' }],
  creator: 'Jeton Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'http://localhost:3000',
    title: 'Jeton',
    description: 'A full-stack Next.js application',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
};

/**
 * Root Layout Component
 * Provides global styling, fonts, and structure for the application
 * Prepares for dark/light mode switching
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground transition-colors duration-300`}
      >
        {/* Main content area with smooth transitions */}
        <div className="relative flex min-h-screen flex-col">
          {/* Page content */}
          <main className="flex-1">{children}</main>

          {/* Footer placeholder for future use */}
          <footer className="border-t border-border bg-surface-50 py-8 text-center text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Jeton. Built with &hearts; by Xhenvolt
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
