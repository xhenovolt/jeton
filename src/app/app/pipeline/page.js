'use client';

/**
 * Pipeline Page
 * Kanban-style deal pipeline view
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';
import { PipelineBoard } from '@/components/financial/PipelineBoard';
import { DealDialog } from '@/components/financial/DealDialog';
import { TrendingUp, Zap, Plus } from 'lucide-react';

export default function PipelinePage() {
  const [deals, setDeals] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [stats, setStats] = useState({
    totalValue: 0,
    weightedValue: 0,
    wonTotal: 0,
    lostTotal: 0,
  });

  // Fetch deals and valuation
  const fetchData = async () => {
    try {
      setPageLoading(true);
      const [dealsRes, valuationRes] = await Promise.all([
        fetch('/api/deals', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }),
        fetch('/api/deals/valuation', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }),
      ]);

      if (dealsRes.ok && valuationRes.ok) {
        const dealsData = await dealsRes.json();
        const valuationData = await valuationRes.json();

        setDeals(dealsData.deals);
        setStats({
          totalValue: valuationData.totalPipelineValue,
          weightedValue: valuationData.weightedPipelineValue,
          wonTotal: valuationData.wonDealsTotal,
          lostTotal: valuationData.lostDealsTotal,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditDeal = (deal) => {
    setSelectedDeal(deal);
    setIsDialogOpen(true);
  };

  const handleDeleteDeal = async (id) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;

    try {
      const response = await fetch(`/api/deals/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (response.ok) {
        setDeals(deals.filter(deal => deal.id !== id));
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting deal:', error);
    }
  };

  const handleSaveDeal = async (formData) => {
    setIsLoading(true);
    try {
      const url = selectedDeal ? `/api/deals/${selectedDeal.id}` : '/api/deals';
      const method = selectedDeal ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        fetchData();
        setIsDialogOpen(false);
        setSelectedDeal(null);
      }
    } catch (error) {
      console.error('Error saving deal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = (dealId, newStage) => {
    const updatedDeals = deals.map(deal =>
      deal.id === dealId ? { ...deal, stage: newStage } : deal
    );
    setDeals(updatedDeals);
    fetchData();
  };

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Sales Pipeline</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Drag deals between stages to manage your pipeline</p>
          </div>
          <Link
            href="/app/deals/create"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Plus size={20} />
            New Deal
          </Link>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Total Pipeline</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                <CurrencyDisplay amount={stats.totalValue} />
              </p>
            </div>
            <TrendingUp className="text-blue-600 dark:text-blue-400" size={28} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Weighted Value</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                <CurrencyDisplay amount={stats.weightedValue} />
              </p>
            </div>
            <Zap className="text-orange-600 dark:text-orange-400" size={28} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Won</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
              <CurrencyDisplay amount={stats.wonTotal} />
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Lost</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
              <CurrencyDisplay amount={stats.lostTotal} />
            </p>
          </div>
        </div>
      </motion.div>

      {/* Kanban Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-6"
      >
        <PipelineBoard
          deals={deals}
          onStageChange={handleStageChange}
          onEdit={handleEditDeal}
          onDelete={handleDeleteDeal}
        />
      </motion.div>

      {/* Deal Dialog */}
      <DealDialog
        isOpen={isDialogOpen}
        deal={selectedDeal}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedDeal(null);
        }}
        onSave={handleSaveDeal}
        isLoading={isLoading}
      />
    </div>
  );
}
