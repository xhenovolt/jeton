'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Trash2, Info } from 'lucide-react';

export default function ReportsPage() {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSnapshot, setCompareSnapshot] = useState(null);
  const [snapshotType, setSnapshotType] = useState('MANUAL');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const fetchSnapshots = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/snapshots', {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch snapshots');

      const data = await response.json();
      setSnapshots(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      setCreating(true);
      const token = localStorage.getItem('auth_token');

      const response = await fetch('/api/snapshots/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: snapshotType })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create snapshot');
      }

      await fetchSnapshots();
      setSnapshotType('MANUAL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDifference = (current, previous) => {
    if (!previous) return null;
    const diff = current - previous;
    const percent = ((diff / Math.abs(previous)) * 100).toFixed(1);
    return { diff, percent };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading snapshots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-foreground">Financial Reports & Snapshots</h1>
        <p className="text-muted-foreground mt-2">
          Capture and compare financial states over time
        </p>
      </motion.div>

      {/* Create Snapshot Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6"
      >
        <div className="flex items-center gap-4 mb-4">
          <Camera className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Create Financial Snapshot</h2>
            <p className="text-sm text-muted-foreground">Capture your current financial state for historical comparison</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={snapshotType}
            onChange={(e) => setSnapshotType(e.target.value)}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary"
          >
            <option value="MANUAL">Manual Snapshot</option>
            <option value="NET_WORTH">Net Worth Snapshot</option>
            <option value="PIPELINE_VALUE">Pipeline Value Snapshot</option>
            <option value="FINANCIAL_SUMMARY">Financial Summary</option>
          </select>
          <button
            onClick={handleCreateSnapshot}
            disabled={creating}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Snapshot'}
          </button>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-100 border border-red-300 rounded-lg p-4 text-red-800"
        >
          {error}
        </motion.div>
      )}

      {/* Snapshots List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.05 }}
        className="space-y-4"
      >
        {snapshots.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No snapshots yet. Create one to get started.</p>
          </div>
        ) : (
          snapshots.map((snapshot, idx) => {
            const diff = compareSnapshot ? calculateDifference(snapshot.data.netWorth, compareSnapshot.data.netWorth) : null;

            return (
              <motion.div
                key={snapshot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedSnapshot(snapshot)}
                className="bg-card border border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{snapshot.name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                        {snapshot.type}
                      </span>
                      <p className="text-sm text-muted-foreground">{formatDate(snapshot.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Delete functionality would go here
                    }}
                    className="p-2 hover:bg-red-100 rounded-lg transition text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Net Worth</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(snapshot.data.netWorth)}
                    </p>
                    {diff && (
                      <p className={`text-xs mt-1 ${diff.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {diff.diff >= 0 ? '+' : ''}{formatCurrency(diff.diff)} ({diff.percent}%)
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Assets</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(snapshot.data.totalAssets)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Liabilities</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(snapshot.data.totalLiabilities)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pipeline Value</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatCurrency(snapshot.data.totalPipeline)}
                    </p>
                  </div>
                </div>

                {compareMode && compareSnapshot && compareSnapshot.id !== snapshot.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompareSnapshot(snapshot);
                    }}
                    className="mt-4 w-full py-2 bg-primary/10 text-primary rounded-lg font-semibold hover:bg-primary/20 transition"
                  >
                    Compare with {snapshot.name}
                  </button>
                )}
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Selected Snapshot Modal */}
      <AnimatePresence>
        {selectedSnapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSnapshot(null)}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-border sticky top-0 bg-background">
                <h2 className="text-2xl font-bold text-foreground">{selectedSnapshot.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{formatDate(selectedSnapshot.createdAt)}</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Net Worth', value: selectedSnapshot.data.netWorth, color: 'text-green-600' },
                    { label: 'Total Assets', value: selectedSnapshot.data.totalAssets, color: 'text-blue-600' },
                    { label: 'Total Liabilities', value: selectedSnapshot.data.totalLiabilities, color: 'text-red-600' },
                    { label: 'Pipeline Value', value: selectedSnapshot.data.totalPipeline, color: 'text-purple-600' },
                    { label: 'Expected Revenue', value: selectedSnapshot.data.weightedRevenue, color: 'text-orange-600' },
                    { label: 'Won Deals', value: selectedSnapshot.data.wonDeals, color: 'text-emerald-600' }
                  ].map((metric) => (
                    <div key={metric.label} className="bg-surface-50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className={`text-2xl font-bold ${metric.color} mt-2`}>
                        {formatCurrency(metric.value)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
