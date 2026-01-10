'use client';

/**
 * Financial Overview Dashboard
 * 
 * Production-grade financial dashboard for SaaS platform.
 * 
 * Architecture:
 * - Prevents hydration mismatches with proper client-side initialization
 * - No conditional rendering of card structure (eliminates flicker)
 * - Skeletons render during loading, values update in-place
 * - Resilient to network delays and errors
 * - Accessibility-first design with WCAG compliance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  DollarSign,
  Wallet,
  Zap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import CountUpNumber from '@/components/financial/CountUpNumber';

// ============================================================================
// CONSTANTS
// ============================================================================

const REFRESH_INTERVAL = 60000; // 60 seconds - refresh data periodically
const API_TIMEOUT = 10000; // 10 seconds - timeout for API calls

// ============================================================================
// TYPES & DEFAULTS
// ============================================================================

const DEFAULT_FINANCIAL_DATA = {
  totalAssets: 0,
  totalLiabilities: 0,
  netWorth: 0,
  currency: 'UGX',
};

const DEFAULT_DEAL_DATA = {
  totalPipelineValue: 0,
  weightedPipelineValue: 0,
  wonDealsTotal: 0,
  lostDealsTotal: 0,
};

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Hook for fetching financial and deal data with proper error handling
 */
function useDashboardData() {
  const [financialData, setFinancialData] = useState(DEFAULT_FINANCIAL_DATA);
  const [dealData, setDealData] = useState(DEFAULT_DEAL_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const hasInitialized = useRef(false);
  const timeoutRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Create timeout controller for both requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      try {
        // Fetch both financial and deal data in parallel
        const [financialRes, dealRes] = await Promise.all([
          fetchWithAuth('/api/net-worth', { signal: controller.signal }),
          fetchWithAuth('/api/deals/valuation', { signal: controller.signal }),
        ]);

        clearTimeout(timeoutId);

        // Handle authentication errors
        if (
          (financialRes && !financialRes.ok && financialRes.status === 401) ||
          (dealRes && !dealRes.ok && dealRes.status === 401)
        ) {
          window.location.href = '/login';
          return;
        }

        // Process financial data
        if (financialRes?.ok) {
          const response = await financialRes.json();
          if (response.success && response.data) {
            setFinancialData(response.data);
          }
        }

        // Process deal data
        if (dealRes?.ok) {
          const response = await dealRes.json();
          if (response.success && response.data) {
            setDealData(response.data);
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Distinguish between timeout and other errors
        if (fetchError.name === 'AbortError') {
          setError('Request timed out. Please check your connection.');
        } else {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'Failed to load dashboard data'
          );
        }

        console.error('Dashboard fetch error:', fetchError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    // Prevent double-fetch in React strict mode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Set initial loading state
    setLoading(true);

    // Fetch data on mount
    fetchData();

    // Set up periodic refresh
    refreshIntervalRef.current = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return {
    financialData,
    dealData,
    loading,
    error,
    refetch,
  };
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Skeleton Loader Component
 * Displays animated placeholder while data loads
 */
function SkeletonLoader({ className = 'h-12 w-32' }) {
  return (
    <div
      className={`${className} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded animate-pulse`}
      aria-hidden="true"
    />
  );
}

/**
 * Metric Card Component
 * Displays a single metric with icon, label, and value
 * Handles loading state gracefully without structural changes
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  isLoading,
  color,
  subtext,
  className = '',
}) {
  return (
    <motion.div
      className={`${className} bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>

          {/* Value - Shows skeleton or animated number */}
          <div className="mt-3 h-10 flex items-center">
            {isLoading ? (
              <SkeletonLoader className="h-9 w-40" />
            ) : (
              <motion.p
                className={`text-3xl font-bold ${color}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <CountUpNumber value={value} />
              </motion.p>
            )}
          </div>

          {/* Subtext */}
          {subtext && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {subtext}
            </p>
          )}
        </div>

        {/* Icon */}
        <div className="ml-4 flex-shrink-0">
          <div className={`w-12 h-12 rounded-lg ${color} bg-opacity-10 flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Section Header Component
 * Provides visual hierarchy and clarity
 */
function SectionHeader({ title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

/**
 * Error State Component
 * Displays error message with retry option
 */
function ErrorState({ error, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3"
    >
      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="font-medium text-red-900 dark:text-red-100">
          Unable to Load Dashboard
        </h3>
        <p className="text-red-800 dark:text-red-200 text-sm mt-1">{error}</p>
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Quick Stats Grid Component
 * Shows deal pipeline breakdown at a glance
 */
function QuickStatsGrid({ dealData, isLoading }) {
  const stats = [
    {
      label: 'Won Deals',
      value: dealData.wonDealsTotal,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900 dark:bg-opacity-20',
    },
    {
      label: 'Lost Deals',
      value: dealData.lostDealsTotal,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900 dark:bg-opacity-20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          className={`${stat.bgColor} rounded-lg p-4 border border-gray-200 dark:border-gray-700`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            {stat.label}
          </p>
          <div className="h-8 flex items-center">
            {isLoading ? (
              <SkeletonLoader className="h-7 w-24" />
            ) : (
              <p className={`text-2xl font-bold ${stat.color}`}>
                <CountUpNumber value={stat.value} />
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Quick Actions Component
 * Navigation shortcuts to key sections
 */
function QuickActions() {
  const actions = [
    { href: '/app/assets', label: 'Assets', color: 'blue' },
    { href: '/app/liabilities', label: 'Liabilities', color: 'red' },
    { href: '/app/deals', label: 'Deals', color: 'purple' },
    { href: '/app/pipeline', label: 'Pipeline', color: 'indigo' },
    { href: '/app/valuation', label: 'Valuation', color: 'green' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 dark:hover:bg-opacity-40',
    red: 'bg-red-50 dark:bg-red-900 dark:bg-opacity-20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 dark:hover:bg-opacity-40',
    purple: 'bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900 dark:hover:bg-opacity-40',
    indigo: 'bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 dark:hover:bg-opacity-40',
    green: 'bg-green-50 dark:bg-green-900 dark:bg-opacity-20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 dark:hover:bg-opacity-40',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {actions.map((action) => (
          <a
            key={action.href}
            href={action.href}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors text-center border border-transparent hover:border-current ${
              colorMap[action.color]
            }`}
          >
            {action.label}
          </a>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Information Card Component
 * Static informational content
 */
function InfoCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="text-sm text-gray-600 dark:text-gray-400">{children}</div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OverviewPage() {
  const { financialData, dealData, loading, error, refetch } =
    useDashboardData();

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Financial Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Real-time snapshot of Xhenvolt's financial position and sales pipeline
        </p>
      </motion.div>

      {/* Error State */}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {/* Primary Financial Metrics - KPIs First */}
      <div>
        <SectionHeader
          title="Financial Position"
          subtitle="Core business metrics updated every minute"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={DollarSign}
            label="Total Assets"
            value={financialData.totalAssets}
            isLoading={loading}
            color="text-blue-600 dark:text-blue-400"
            subtext={`${financialData.currency} in company assets`}
          />
          <MetricCard
            icon={Wallet}
            label="Total Liabilities"
            value={financialData.totalLiabilities}
            isLoading={loading}
            color="text-red-600 dark:text-red-400"
            subtext={`${financialData.currency} owed`}
          />
          <MetricCard
            icon={TrendingUp}
            label="Net Worth"
            value={financialData.netWorth}
            isLoading={loading}
            color={
              financialData.netWorth >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-orange-600 dark:text-orange-400'
            }
            subtext="Net financial position"
          />
        </div>
      </div>

      {/* Sales Pipeline Metrics */}
      <div>
        <SectionHeader
          title="Sales Pipeline"
          subtitle="Deal valuations and conversion metrics"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MetricCard
            icon={TrendingUp}
            label="Pipeline Value"
            value={dealData.totalPipelineValue}
            isLoading={loading}
            color="text-purple-600 dark:text-purple-400"
            subtext="Total estimated deal value in pipeline"
          />
          <MetricCard
            icon={Zap}
            label="Expected Revenue"
            value={dealData.weightedPipelineValue}
            isLoading={loading}
            color="text-indigo-600 dark:text-indigo-400"
            subtext="Probability-weighted pipeline value"
          />
        </div>
      </div>

      {/* Deal Outcome Breakdown */}
      <div>
        <SectionHeader
          title="Deal Outcomes"
          subtitle="Historical deal completion results"
        />
        <QuickStatsGrid dealData={dealData} isLoading={loading} />
      </div>

      {/* Reference Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard title="Net Worth Calculation">
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded">
                Total Assets
              </span>
              <span className="text-gray-500">-</span>
              <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 rounded">
                Total Liabilities
              </span>
            </div>
            <div className="text-center">↓</div>
            <div className="text-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 rounded">
              = Net Worth
            </div>
          </div>
        </InfoCard>

        <InfoCard title="Pipeline Metrics">
          <div className="space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Pipeline Value
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {dealData.totalPipelineValue.toLocaleString()} UGX
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">
                Expected Revenue
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {dealData.weightedPipelineValue.toLocaleString()} UGX
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-gray-600 dark:text-gray-400">
                Win Rate Impact
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {dealData.totalPipelineValue > 0
                  ? Math.round(
                      (dealData.weightedPipelineValue /
                        dealData.totalPipelineValue) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
          </div>
        </InfoCard>
      </div>

      {/* Quick Actions Footer */}
      <QuickActions />
    </div>
  );
}
