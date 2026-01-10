'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, TrendingDown } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';
import LiabilitiesTable from '@/components/financial/LiabilitiesTable';
import LiabilityDialog from '@/components/financial/LiabilityDialog';

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState(null);

  useEffect(() => {
    fetchLiabilities();
  }, []);

  const fetchLiabilities = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/liabilities');
      const data = await response.json();
      
      if (response.ok) {
        setLiabilities(data.liabilities || []);
        const total = (data.liabilities || [])
          .filter(l => l.status !== 'CLEARED')
          .reduce(
            (sum, liability) => sum + parseFloat(liability.outstanding_amount || 0),
            0
          );
        setTotalOutstanding(total);
      }
    } catch (error) {
      console.error('Error fetching liabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLiability = () => {
    setSelectedLiability(null);
    setIsDialogOpen(true);
  };

  const handleEditLiability = (liability) => {
    setSelectedLiability(liability);
    setIsDialogOpen(true);
  };

  const handleDeleteLiability = async (liabilityId) => {
    if (!window.confirm('Are you sure you want to delete this liability?')) return;

    try {
      const response = await fetch(`/api/liabilities/${liabilityId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setLiabilities(liabilities.filter(l => l.id !== liabilityId));
        const filtered = liabilities.filter(l => l.id !== liabilityId);
        const total = filtered
          .filter(l => l.status !== 'CLEARED')
          .reduce((sum, l) => sum + parseFloat(l.outstanding_amount || 0), 0);
        setTotalOutstanding(total);
      }
    } catch (error) {
      console.error('Error deleting liability:', error);
    }
  };

  const handleSaveLiability = async (liabilityData) => {
    try {
      const url = selectedLiability
        ? `/api/liabilities/${selectedLiability.id}`
        : '/api/liabilities';
      const method = selectedLiability ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(liabilityData),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        fetchLiabilities();
      }
    } catch (error) {
      console.error('Error saving liability:', error);
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

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Liabilities
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track company debts and obligations
          </p>
        </div>
        <button
          onClick={handleAddLiability}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Liability
        </button>
      </motion.div>

      {/* Total Liabilities Card */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 rounded-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-600 dark:text-red-300 text-sm font-medium">
              Total Outstanding
            </p>
            <p className="text-3xl font-bold text-red-900 dark:text-white mt-2">
              <CurrencyDisplay amount={totalOutstanding} />
            </p>
          </div>
          <div className="bg-red-200 dark:bg-red-700 rounded-full p-3">
            <TrendingDown className="text-red-600 dark:text-red-300" size={24} />
          </div>
        </div>
      </motion.div>

      {/* Liabilities Table */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading liabilities...</p>
          </div>
        ) : liabilities.length > 0 ? (
          <LiabilitiesTable
            liabilities={liabilities}
            onEdit={handleEditLiability}
            onDelete={handleDeleteLiability}
          />
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              No liabilities recorded. Click "Add Liability" to get started.
            </p>
          </div>
        )}
      </motion.div>

      {/* Liability Dialog */}
      <LiabilityDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        liability={selectedLiability}
        onSave={handleSaveLiability}
      />
    </motion.div>
  );
}
