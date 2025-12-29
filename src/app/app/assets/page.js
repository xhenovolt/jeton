'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit2, TrendingUp } from 'lucide-react';
import AssetsTable from '@/components/financial/AssetsTable';
import AssetDialog from '@/components/financial/AssetDialog';

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/assets');
      const data = await response.json();
      
      if (response.ok) {
        setAssets(data.assets || []);
        const total = (data.assets || []).reduce(
          (sum, asset) => sum + parseFloat(asset.current_value || 0),
          0
        );
        setTotalValue(total);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsDialogOpen(true);
  };

  const handleEditAsset = (asset) => {
    setSelectedAsset(asset);
    setIsDialogOpen(true);
  };

  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAssets(assets.filter(a => a.id !== assetId));
        setTotalValue(
          assets
            .filter(a => a.id !== assetId)
            .reduce((sum, a) => sum + parseFloat(a.current_value || 0), 0)
        );
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const handleSaveAsset = async (assetData) => {
    try {
      const url = selectedAsset
        ? `/api/assets/${selectedAsset.id}`
        : '/api/assets';
      const method = selectedAsset ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assetData),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        fetchAssets();
      }
    } catch (error) {
      console.error('Error saving asset:', error);
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
            Assets
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage and track company assets
          </p>
        </div>
        <button
          onClick={handleAddAsset}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Add Asset
        </button>
      </motion.div>

      {/* Total Assets Card */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-600 dark:text-blue-300 text-sm font-medium">
              Total Assets
            </p>
            <p className="text-3xl font-bold text-blue-900 dark:text-white mt-2">
              UGX {totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-blue-200 dark:bg-blue-700 rounded-full p-3">
            <TrendingUp className="text-blue-600 dark:text-blue-300" size={24} />
          </div>
        </div>
      </motion.div>

      {/* Assets Table */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading assets...</p>
          </div>
        ) : assets.length > 0 ? (
          <AssetsTable
            assets={assets}
            onEdit={handleEditAsset}
            onDelete={handleDeleteAsset}
          />
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              No assets yet. Click "Add Asset" to get started.
            </p>
          </div>
        )}
      </motion.div>

      {/* Asset Dialog */}
      <AssetDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        asset={selectedAsset}
        onSave={handleSaveAsset}
      />
    </motion.div>
  );
}
