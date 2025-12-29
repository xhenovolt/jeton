'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Zap } from 'lucide-react';
import AssetsLiabilitiesTrendChart from '@/components/charts/AssetsLiabilitiesTrendChart';
import PipelineFunnelChart from '@/components/charts/PipelineFunnelChart';
import DealWinLossChart from '@/components/charts/DealWinLossChart';
import NetWorthTrendChart from '@/components/charts/NetWorthTrendChart';
import CountUpNumber from '@/components/financial/CountUpNumber';

export default function DashboardPage() {
  const [executiveData, setExecutiveData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');

        if (!token) {
          setError('Not authenticated');
          return;
        }

        const [execResponse, analyticsResponse] = await Promise.all([
          fetch('/api/reports/executive', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/reports/financial', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (!execResponse.ok || !analyticsResponse.ok) {
          throw new Error('Failed to fetch dashboard data');
        }

        const execData = await execResponse.json();
        const analyticsData = await analyticsResponse.json();

        setExecutiveData(execData);
        setAnalyticsData(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !executiveData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p>{error || 'Failed to load dashboard'}</p>
        </div>
      </div>
    );
  }

  const { summary, topAssets, topLiabilities } = executiveData;

  const metrics = [
    {
      label: 'Net Worth',
      value: summary.netWorth,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      trend: 'Primary indicator of wealth'
    },
    {
      label: 'Total Assets',
      value: summary.totalAssets,
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      trend: 'All asset holdings'
    },
    {
      label: 'Total Liabilities',
      value: summary.totalLiabilities,
      icon: Zap,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
      trend: 'Total debt exposure'
    },
    {
      label: 'Pipeline Value',
      value: summary.totalPipeline,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      trend: 'Total deal value'
    },
    {
      label: 'Expected Revenue',
      value: summary.weightedRevenue,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      trend: `Probability-weighted (${summary.conversionRate}% CR)`
    },
    {
      label: 'Won Deals',
      value: summary.wonDeals,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/20',
      trend: 'Closed successfully'
    }
  ];

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-foreground">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive financial intelligence and key performance indicators
        </p>
      </motion.div>

      {/* Key Metrics Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                  <p className={`text-3xl font-bold ${metric.color}`}>
                    <CountUpNumber value={metric.value} duration={1} />
                  </p>
                </div>
                <div className={`${metric.bgColor} rounded-lg p-3`}>
                  <Icon size={24} className={metric.color} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{metric.trend}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {analyticsData && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AssetsLiabilitiesTrendChart data={analyticsData.assetsLiabilitiesTrend} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <NetWorthTrendChart data={analyticsData.netWorthTrend} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PipelineFunnelChart data={analyticsData.pipelineFunnel} />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <DealWinLossChart data={analyticsData.dealWinLoss} />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Top Assets & Liabilities */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1, delayChildren: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Top Assets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-6">Top 5 Assets by Value</h3>
          <div className="space-y-4">
            {topAssets.map((asset, idx) => (
              <div key={asset.id} className="flex items-start justify-between pb-4 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.category}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{formatCurrency(asset.value)}</p>
                  {asset.depreciation > 0 && (
                    <p className="text-xs text-muted-foreground">-{asset.depreciation}% p.a.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Liabilities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-foreground mb-6">Top 5 Liabilities by Risk</h3>
          <div className="space-y-4">
            {topLiabilities.map((liability, idx) => (
              <div key={liability.id} className="flex items-start justify-between pb-4 border-b border-border last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                      liability.riskScore > 70 ? 'bg-red-100 text-red-700' :
                      liability.riskScore > 40 ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{liability.name}</p>
                      <p className="text-xs text-muted-foreground">{liability.category}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{formatCurrency(liability.outstanding)}</p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <p className="text-xs text-muted-foreground">Risk:</p>
                    <p className={`text-xs font-bold ${
                      liability.riskScore > 70 ? 'text-red-600' :
                      liability.riskScore > 40 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {liability.riskScore}/100
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
