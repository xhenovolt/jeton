'use client';

/**
 * Deals Management Page
 * Display and manage all deals
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, DollarSign, TrendingUp } from 'lucide-react';
import { DealsTable } from '@/components/financial/DealsTable';
import { DealDialog } from '@/components/financial/DealDialog';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);

  // Fetch deals
  const fetchDeals = async () => {
    try {
      setPageLoading(true);
      const response = await fetch('/api/deals', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDeals(data.deals);
        const total = data.deals.reduce((sum, deal) => sum + Number(deal.value_estimate), 0);
        setTotalValue(total);
      } else {
        console.error('Failed to fetch deals');
      }
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleAddDeal = () => {
    setSelectedDeal(null);
    setIsDialogOpen(true);
  };

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
        const total = deals
          .filter(deal => deal.id !== id)
          .reduce((sum, deal) => sum + Number(deal.value_estimate), 0);
        setTotalValue(total);
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
        const saved = await response.json();
        if (selectedDeal) {
          setDeals(deals.map(d => d.id === saved.id ? saved : d));
        } else {
          setDeals([saved, ...deals]);
        }
        const total = deals
          .filter(d => d.id !== saved.id)
          .concat(saved)
          .reduce((sum, deal) => sum + Number(deal.value_estimate), 0);
        setTotalValue(total);
        setIsDialogOpen(false);
        setSelectedDeal(null);
      } else {
        const error = await response.json();
        console.error('Error saving deal:', error);
      }
    } catch (error) {
      console.error('Error saving deal:', error);
    } finally {
      setIsLoading(false);
    }
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Deals</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Manage your sales pipeline</p>
          </div>
          <button
            onClick={handleAddDeal}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <Plus size={20} />
            New Deal
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Total Deals */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Total Deals</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{deals.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <TrendingUp className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
          </div>
        </div>

        {/* Active Deals */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Active Deals</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                {deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <DollarSign className="text-orange-600 dark:text-orange-400" size={24} />
            </div>
          </div>
        </div>

        {/* Pipeline Value */}
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Pipeline Value</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                UGX {totalValue.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <DollarSign className="text-green-600 dark:text-green-400" size={24} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Deals Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">All Deals</h2>
        </div>
        <DealsTable
          deals={deals}
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
