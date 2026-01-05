import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { NavigationWrapper } from '@/components/layout/NavigationWrapper';
import LayoutClient from './layout-client';
import { CurrencyProvider } from '@/lib/currency-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  preload: false,
  fallback: ['system-ui', 'arial'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  preload: false,
  fallback: ['monospace'],
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
        <CurrencyProvider>
          {/* Navigation Wrapper - Only shows on /app routes */}
          <NavigationWrapper />

          {/* Layout wrapper with state management for mobile drawer */}
          <div className="flex min-h-screen flex-col">
            <LayoutClient>
              {children}
            </LayoutClient>
          </div>
        </CurrencyProvider>
      </body>
    </html>
  );
}
