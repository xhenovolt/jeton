'use client';

/**
 * Valuation Page
 * Show deal valuation and revenue projections
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Target, Zap, CheckCircle, XCircle } from 'lucide-react';

export default function ValuationPage() {
  const [valuation, setValuation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchValuation = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/deals/valuation', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setValuation(data);
        }
      } catch (error) {
        console.error('Error fetching valuation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchValuation();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!valuation) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 dark:text-slate-400">Failed to load valuation data</p>
      </div>
    );
  }

  const conversionRate = valuation.weightedPipelineValue / (valuation.totalPipelineValue || 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Deal Valuation</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Pipeline value analysis and revenue projections</p>
        </div>
      </motion.div>

      {/* Main Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Total Pipeline Value */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-8 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-semibold">TOTAL PIPELINE VALUE</p>
              <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-3">
                UGX {valuation.totalPipelineValue.toLocaleString()}
              </h3>
            </div>
            <div className="w-16 h-16 rounded-lg bg-blue-200 dark:bg-blue-900 flex items-center justify-center">
              <TrendingUp className="text-blue-600 dark:text-blue-400" size={32} />
            </div>
          </div>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Sum of all deal estimates in active pipeline
          </p>
        </div>

        {/* Weighted Pipeline Value (Expected Revenue) */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-8 border border-purple-200 dark:border-purple-800">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-purple-600 dark:text-purple-400 text-sm font-semibold">EXPECTED REVENUE</p>
              <h3 className="text-4xl font-bold text-slate-900 dark:text-white mt-3">
                UGX {valuation.weightedPipelineValue.toLocaleString()}
              </h3>
            </div>
            <div className="w-16 h-16 rounded-lg bg-purple-200 dark:bg-purple-900 flex items-center justify-center">
              <Zap className="text-purple-600 dark:text-purple-400" size={32} />
            </div>
          </div>
          <p className="text-purple-700 dark:text-purple-300 text-sm">
            Weighted by probability of winning each deal
          </p>
        </div>
      </motion.div>

      {/* Secondary Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Conversion Rate */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold mb-2">CONVERSION RATE</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
              {(conversionRate * 100).toFixed(1)}%
            </h3>
          </div>
          <div className="mt-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-orange-500 to-green-500 h-2 rounded-full"
              style={{ width: `${conversionRate * 100}%` }}
            />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
            Expected vs Total Pipeline
          </p>
        </div>

        {/* Won Deals */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold mb-2">WON DEALS</p>
              <h3 className="text-3xl font-bold text-green-600 dark:text-green-400">
                UGX {valuation.wonDealsTotal.toLocaleString()}
              </h3>
            </div>
            <CheckCircle className="text-green-600 dark:text-green-400" size={28} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-4">
            Closed deals in "Won" stage
          </p>
        </div>

        {/* Lost Deals */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold mb-2">LOST DEALS</p>
              <h3 className="text-3xl font-bold text-red-600 dark:text-red-400">
                UGX {valuation.lostDealsTotal.toLocaleString()}
              </h3>
            </div>
            <XCircle className="text-red-600 dark:text-red-400" size={28} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-4">
            Closed deals in "Lost" stage
          </p>
        </div>
      </motion.div>

      {/* Formula Explanation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-50 dark:bg-slate-900 rounded-lg p-8 border border-slate-200 dark:border-slate-800"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Valuation Formulas</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded text-slate-900 dark:text-white">
              Total Pipeline = Σ(deal.value_estimate for all active deals)
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sum of all estimated deal values currently in the pipeline
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded text-slate-900 dark:text-white">
              Expected Revenue = Σ(deal.value_estimate × (deal.probability / 100))
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Weighted sum of all deals based on their probability of closing
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded text-slate-900 dark:text-white">
              Conversion Rate = Expected Revenue / Total Pipeline
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Percentage of total pipeline expected to close based on current probabilities
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
