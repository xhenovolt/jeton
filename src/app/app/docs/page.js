'use client';

import Link from 'next/link';
import { BookOpen, Users, Code, Target, Workflow, Map, FileText, Rocket } from 'lucide-react';

export default function DocsHomePage() {
  const docSections = [
    {
      title: 'Getting Started',
      href: '/app/docs/getting-started',
      icon: Rocket,
      description: 'New to Jeton? Start here to understand the basics.',
      color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Founder Workflow',
      href: '/app/docs/founder',
      icon: Target,
      description: 'Your daily playbook for running Jeton. Everything you need to know.',
      color: 'bg-green-50 border-green-200 hover:bg-green-100',
      iconColor: 'text-green-600',
      featured: true,
    },
    {
      title: 'User Guides',
      href: '/app/docs/guides',
      icon: Users,
      description: 'Step-by-step tutorials for common tasks.',
      color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Module Documentation',
      href: '/app/docs/modules',
      icon: BookOpen,
      description: 'Deep dive into each system module.',
      color: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Workflow & Architecture',
      href: '/app/docs/workflow',
      icon: Workflow,
      description: 'Understand how data flows through Jeton.',
      color: 'bg-pink-50 border-pink-200 hover:bg-pink-100',
      iconColor: 'text-pink-600',
    },
    {
      title: 'System Map',
      href: '/app/docs/system-map',
      icon: Map,
      description: 'Complete map of all routes, APIs, and database tables.',
      color: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100',
      iconColor: 'text-cyan-600',
    },
    {
      title: 'Developer Documentation',
      href: '/app/docs/developer',
      icon: Code,
      description: 'Technical documentation for extending Jeton.',
      color: 'bg-muted border-border hover:bg-muted',
      iconColor: 'text-muted-foreground',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Jeton Documentation
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Complete guide to understanding, using, and extending Jeton - your Founder-First Business Operating System
          </p>
        </div>

        {/* Quick Start Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-12 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Rocket className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">New to Jeton?</h2>
              <p className="text-blue-100 mb-4">
                Start with the Founder Workflow guide to learn the daily operations and key metrics.
              </p>
              <Link
                href="/app/docs/founder"
                className="inline-flex items-center px-6 py-3 bg-card text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
              >
                Read Founder Manual →
              </Link>
            </div>
          </div>
        </div>

        {/* Documentation Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {docSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className={`relative block p-6 rounded-xl border-2 transition-all ${section.color} ${
                  section.featured ? 'md:col-span-2 lg:col-span-1 lg:row-span-2' : ''
                }`}
              >
                {section.featured && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                    START HERE
                  </div>
                )}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${section.iconColor} bg-white/50`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {section.title}
                </h3>
                <p className="text-foreground">
                  {section.description}
                </p>
                {section.featured && (
                  <div className="mt-4 flex items-center text-sm font-semibold text-green-700">
                    Recommended for founders →
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Links */}
        <div className="bg-card rounded-xl p-8 border border-border shadow-sm mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Quick Links</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-foreground mb-3">Common Tasks</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/app/docs/guides#add-prospect" className="text-blue-600 hover:underline">
                    → How to add a prospect
                  </Link>
                </li>
                <li>
                  <Link href="/app/docs/guides#convert-client" className="text-blue-600 hover:underline">
                    → How to convert a prospect to client
                  </Link>
                </li>
                <li>
                  <Link href="/app/docs/guides#create-deal" className="text-blue-600 hover:underline">
                    → How to create a deal
                  </Link>
                </li>
                <li>
                  <Link href="/app/docs/guides#record-payment" className="text-blue-600 hover:underline">
                    → How to record a payment
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-3">System Reference</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/app/docs/system-map#routes" className="text-blue-600 hover:underline">
                    → Complete route map
                  </Link>
                </li>
                <li>
                  <Link href="/app/docs/system-map#api" className="text-blue-600 hover:underline">
                    → API endpoint reference
                  </Link>
                </li>
                <li>
                  <Link href="/app/docs/workflow#revenue-chain" className="text-blue-600 hover:underline">
                    → Revenue workflow chain
                  </Link>
                </li>
                <li>
                  <Link href="/app/docs/modules" className="text-blue-600 hover:underline">
                    → Module documentation
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-muted-foreground text-sm">
          <p>
            Documentation version 1.0 • Last updated March 8, 2026
          </p>
          <p className="mt-2">
            Need help?{' '}
            <Link href="/app/settings" className="text-blue-600 hover:underline">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
