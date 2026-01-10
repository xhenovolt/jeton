'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Wallet, Zap, CheckCircle, XCircle } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import CountUpNumber from '@/components/financial/CountUpNumber';

export default function OverviewPage() {
  const [financialData, setFinancialData] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    currency: 'UGX',
  });
  const [dealData, setDealData] = useState({
    totalPipelineValue: 0,
    weightedPipelineValue: 0,
    wonDealsTotal: 0,
    lostDealsTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      // Remove Authorization header - using session cookies instead
      const [financialRes, dealRes] = await Promise.all([
        fetchWithAuth('/api/net-worth'),
        fetchWithAuth('/api/deals/valuation'),
      ]);

      if (!financialRes.ok && financialRes.status === 401) {
        // Session expired - redirect to login
        window.location.href = '/login';
        return;
      }

      if (financialRes.ok) {
        const response = await financialRes.json();
        setFinancialData(response.data);
      }

      if (!dealRes.ok && dealRes.status === 401) {
        // Session expired - redirect to login
        window.location.href = '/login';
        return;
      }

      if (dealRes.ok) {
        const response = await dealRes.json();
        setDealData(response.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  const CardContent = ({ icon: Icon, label, value, color, subtext }) => (
    <motion.div
      variants={itemVariants}
      className={`bg-gradient-to-br ${color} rounded-lg p-6 text-white`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="opacity-90 text-sm font-medium">{label}</p>
          <motion.p
            className="text-4xl font-bold mt-3"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {loading ? '...' : <CountUpNumber value={value} />}
          </motion.p>
          {subtext && (
            <p className="text-xs opacity-75 mt-2">{subtext}</p>
          )}
        </div>
        <div className="bg-white bg-opacity-20 rounded-full p-3">
          <Icon size={24} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Financial Overview
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Real-time snapshot of Xhenvolt's financial position
        </p>
      </motion.div>

      {loading ? (
        // Loading state - show cards with 0 values and loading indicators
        <>
          {/* Main Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardContent
              icon={DollarSign}
              label="Total Assets"
              value={0}
              color="from-blue-500 to-blue-600"
              subtext={`${financialData.currency} in company assets`}
            />
            <CardContent
              icon={Wallet}
              label="Total Liabilities"
              value={0}
              color="from-red-500 to-red-600"
              subtext={`${financialData.currency} owed`}
            />
            <CardContent
              icon={TrendingUp}
              label="Net Worth"
              value={0}
              color="from-green-500 to-green-600"
              subtext={`Net financial position`}
            />
          </div>

          {/* Pipeline/Deal Section */}
          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sales Pipeline</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardContent
              icon={TrendingUp}
              label="Pipeline Value"
              value={0}
              color="from-purple-500 to-purple-600"
              subtext="Total deal estimates in pipeline"
            />
            <CardContent
              icon={Zap}
              label="Expected Revenue"
              value={0}
              color="from-indigo-500 to-indigo-600"
              subtext="Weighted by probability"
            />
          </div>
        </>
      ) : (
        // Loaded content
        <>
          {/* Main Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardContent
              icon={DollarSign}
              label="Total Assets"
              value={financialData.totalAssets}
              color="from-blue-500 to-blue-600"
              subtext={`${financialData.currency} in company assets`}
            />
            <CardContent
              icon={Wallet}
              label="Total Liabilities"
              value={financialData.totalLiabilities}
              color="from-red-500 to-red-600"
              subtext={`${financialData.currency} owed`}
            />
            <CardContent
              icon={TrendingUp}
              label="Net Worth"
              value={financialData.netWorth}
              color={
                financialData.netWorth >= 0
                  ? 'from-green-500 to-green-600'
                  : 'from-orange-500 to-orange-600'
              }
              subtext={`Net financial position`}
            />
          </div>

          {/* Pipeline/Deal Section */}
          <motion.div variants={itemVariants}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sales Pipeline</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CardContent
              icon={TrendingUp}
              label="Pipeline Value"
              value={dealData.totalPipelineValue}
              color="from-purple-500 to-purple-600"
              subtext="Total deal estimates in pipeline"
            />
            <CardContent
              icon={Zap}
              label="Expected Revenue"
              value={dealData.weightedPipelineValue}
              color="from-indigo-500 to-indigo-600"
              subtext="Weighted by probability"
            />
          </div>

          {/* Breakdown */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Net Worth Formula
              </h3>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  <span className="font-mono bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                    Total Assets
                  </span>
                  <span className="mx-2">-</span>
                  <span className="font-mono bg-red-100 dark:bg-red-900 px-2 py-1 rounded">
                    Total Liabilities
                  </span>
                </p>
                <p className="mt-4">
                  <span className="font-mono bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                    = Net Worth
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Pipeline Deals
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Won</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    UGX {dealData.wonDealsTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Lost</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    UGX {dealData.lostDealsTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <a
                href="/app/assets"
                className="px-4 py-2 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-sm font-medium text-center"
              >
                Assets
              </a>
              <a
                href="/app/liabilities"
                className="px-4 py-2 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-800 transition-colors text-sm font-medium text-center"
              >
                Liabilities
              </a>
              <a
                href="/app/deals"
                className="px-4 py-2 bg-purple-50 dark:bg-purple-900 text-purple-600 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors text-sm font-medium text-center"
              >
                Deals
              </a>
              <a
                href="/app/pipeline"
                className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors text-sm font-medium text-center"
              >
                Pipeline
              </a>
              <a
                href="/app/valuation"
                className="px-4 py-2 bg-green-50 dark:bg-green-900 text-green-600 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-800 transition-colors text-sm font-medium text-center"
              >
                Valuation
              </a>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
