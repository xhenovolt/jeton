'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Send,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Users,
  Percent,
  DollarSign,
  Settings,
  ArrowRight,
  Lock,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';
import { useCurrency } from '@/lib/currency-context';

/**
 * CORPORATE EQUITY MANAGEMENT PAGE
 * 
 * Implements URSB-compliant share structure:
 * - Authorized Shares (maximum allowable)
 * - Issued Shares (officially created)
 * - Allocated Shares (owned by shareholders)
 * - Share Transfers (ownership changes without dilution)
 * - Share Issuance (new shares with dilution)
 */
export default function EquityPage() {
  const { selectedCurrency } = useCurrency();
  const [config, setConfig] = useState(null);
  const [capTable, setCapTable] = useState([]);
  const [pendingIssuances, setPendingIssuances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddShareholder, setShowAddShareholder] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showIssuanceModal, setShowIssuanceModal] = useState(false);

  // Form states
  const [configForm, setConfigForm] = useState({
    authorized_shares: '',
    issued_shares: '',
    par_value: '',
  });

  const [shareholderForm, setShareholderForm] = useState({
    shareholder_name: '',
    shareholder_email: '',
    shares_owned: '',
    holder_type: 'investor',
    acquisition_price: '',
  });

  const [transferForm, setTransferForm] = useState({
    from_shareholder_id: '',
    to_shareholder_id: '',
    shares_transferred: '',
    transfer_price_per_share: '',
    transfer_type: 'secondary-sale',
    reason: '',
  });

  const [issuanceForm, setIssuanceForm] = useState({
    shares_issued: '',
    issued_at_price: '',
    recipient_type: 'investor',
    issuance_reason: '',
    issuance_type: 'equity',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch config, cap table, and pending issuances
      const [configRes, capTableRes, issuancesRes] = await Promise.all([
        fetch('/api/equity/config'),
        fetch('/api/equity/cap-table'),
        fetch('/api/equity/issuance?status=pending'),
      ]);

      const configData = await configRes.json();
      const capTableData = await capTableRes.json();
      const issuancesData = await issuancesRes.json();

      if (configData.success) {
        setConfig(configData.data);
      }

      if (capTableData.success) {
        setCapTable(capTableData.data || []);
      }

      if (issuancesData.success) {
        setPendingIssuances(issuancesData.data || []);
      }
    } catch (err) {
      setError('Failed to load equity data');
      console.error('Equity data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      const res = await fetch('/api/equity/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm),
      });

      const data = await res.json();

      if (data.success) {
        setConfig(data.data);
        setShowConfigModal(false);
        setConfigForm({ authorized_shares: '', issued_shares: '', par_value: '' });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update configuration');
      console.error('Config update error:', err);
    }
  };

  const handleAddShareholder = async () => {
    try {
      // First get user ID (would come from auth context in real app)
      const res = await fetch('/api/equity/shareholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...shareholderForm,
          shareholder_id: crypto.randomUUID(), // Placeholder
          shares_owned: parseInt(shareholderForm.shares_owned),
          acquisition_price: shareholderForm.acquisition_price
            ? parseFloat(shareholderForm.acquisition_price)
            : null,
          equity_type: shareholderForm.equity_type || 'PURCHASED',
        }),
      });

      const data = await res.json();

      if (data.success) {
        fetchData();
        setShowAddShareholder(false);
        setShareholderForm({
          shareholder_name: '',
          shareholder_email: '',
          shares_owned: '',
          holder_type: 'investor',
          acquisition_price: '',
          equity_type: 'PURCHASED',
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add shareholder');
      console.error('Add shareholder error:', err);
    }
  };

  const handleTransferShares = async () => {
    try {
      const res = await fetch('/api/equity/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...transferForm,
          shares_transferred: parseInt(transferForm.shares_transferred),
          transfer_price_per_share: transferForm.transfer_price_per_share
            ? parseFloat(transferForm.transfer_price_per_share)
            : null,
          equity_type: transferForm.equity_type || 'PURCHASED',
        }),
      });

      const data = await res.json();

      if (data.success) {
        fetchData();
        setShowTransferModal(false);
        setTransferForm({
          from_shareholder_id: '',
          to_shareholder_id: '',
          shares_transferred: '',
          transfer_price_per_share: '',
          transfer_type: 'secondary-sale',
          equity_type: 'PURCHASED',
          reason: '',
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to transfer shares');
      console.error('Transfer shares error:', err);
    }
  };

  const handleProposeIssuance = async () => {
    try {
      const res = await fetch('/api/equity/issuance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...issuanceForm,
          shares_issued: parseInt(issuanceForm.shares_issued),
          issued_at_price: issuanceForm.issued_at_price
            ? parseFloat(issuanceForm.issued_at_price)
            : null,
          equity_type: issuanceForm.equity_type || 'GRANTED',
          created_by_id: crypto.randomUUID(), // Placeholder
          action: 'propose',
        }),
      });

      const data = await res.json();

      if (data.success) {
        fetchData();
        setShowIssuanceModal(false);
        setIssuanceForm({
          shares_issued: '',
          issued_at_price: '',
          recipient_type: 'investor',
          issuance_reason: '',
          issuance_type: 'equity',
          equity_type: 'GRANTED',
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to propose issuance');
      console.error('Issuance error:', err);
    }
  };

  const handleApproveIssuance = async (issuanceId) => {
    try {
      const res = await fetch('/api/equity/issuance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          issuance_id: issuanceId,
          approved_by_id: crypto.randomUUID(), // Placeholder
        }),
      });

      const data = await res.json();

      if (data.success) {
        fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to approve issuance');
      console.error('Approval error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Zap className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading equity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Corporate Equity</h1>
              <p className="text-muted-foreground mt-2">
                URSB-compliant share structure, cap table, and transfer management
              </p>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition"
            >
              <Settings className="w-4 h-4" />
              Configure Shares
            </button>
          </div>
        </motion.div>
      </div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm text-muted-foreground hover:text-foreground mt-1"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Authorization Status */}
        {config && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            {/* Authorized Shares */}
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Authorized Shares</p>
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{(config.authorized_shares || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-2">Maximum allowable shares</p>
            </div>

            {/* Issued Shares */}
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Issued Shares</p>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-3xl font-bold">{(config.issued_shares || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {(
                  ((config.issued_shares || 0) / (config.authorized_shares || 1)) *
                  100
                ).toFixed(1)}
                % of authorized
              </p>
            </div>

            {/* Unissued Shares */}
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Unissued Shares</p>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-bold">{(config.unissued_shares || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-2">Available for issuance</p>
            </div>

            {/* Allocated Shares */}
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Allocated Shares</p>
                <Users className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold">{(config.allocated_shares || 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {config.allocation_percentage}% of issued
              </p>
            </div>
          </motion.div>
        )}

        {/* Pending Issuances Warning */}
        {pendingIssuances.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6"
          >
            <div className="flex items-center gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  Pending Share Issuances
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                  {pendingIssuances.length} dilution event{pendingIssuances.length !== 1 ? 's' : ''} awaiting approval
                </p>
              </div>
              <button
                onClick={() => setShowIssuanceModal(true)}
                className="px-4 py-2 bg-amber-600 text-amber-50 rounded hover:bg-amber-700 transition text-sm font-medium"
              >
                Review
              </button>
            </div>
          </motion.div>
        )}

        {/* Cap Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg overflow-hidden"
        >
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Cap Table</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Current ownership structure and shareholder information
                </p>
              </div>
              <button
                onClick={() => setShowAddShareholder(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition"
              >
                <Plus className="w-4 h-4" />
                Add Shareholder
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-3 text-left font-semibold">Shareholder</th>
                  <th className="px-6 py-3 text-right font-semibold">Shares Owned</th>
                  <th className="px-6 py-3 text-right font-semibold">Ownership %</th>
                  <th className="px-6 py-3 text-right font-semibold">Vested</th>
                  <th className="px-6 py-3 text-left font-semibold">Type</th>
                  <th className="px-6 py-3 text-left font-semibold">Equity Type</th>
                  <th className="px-6 py-3 text-right font-semibold">Investment</th>
                  <th className="px-6 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {capTable.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-muted-foreground">
                      No shareholders yet
                    </td>
                  </tr>
                ) : (
                  capTable.map((shareholder) => (
                    <tr key={shareholder.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{shareholder.shareholder_name}</p>
                          <p className="text-xs text-muted-foreground">{shareholder.shareholder_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {shareholder.shares_owned.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-semibold">
                          {shareholder.current_ownership_percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div>
                          <p className="font-mono text-sm">{(shareholder.vested_shares || 0).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            of {shareholder.shares_owned.toLocaleString()}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-muted text-foreground rounded text-xs font-medium">
                          {shareholder.holder_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          shareholder.equity_type === 'GRANTED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {shareholder.equity_type === 'GRANTED' ? '🎁 Granted' : '💳 Purchased'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <CurrencyDisplay
                          amount={shareholder.investment_total || 0}
                          className="font-mono text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setTransferForm({
                              ...transferForm,
                              from_shareholder_id: shareholder.shareholder_id,
                            });
                            setShowTransferModal(true);
                          }}
                          className="text-primary hover:text-primary/80 transition text-sm"
                          title="Transfer shares from this shareholder"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setShowTransferModal(true)}
            className="p-6 bg-card border border-border rounded-lg hover:shadow-lg transition hover:bg-muted/50"
          >
            <Send className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Transfer Shares</h3>
            <p className="text-sm text-muted-foreground">
              Move shares between shareholders (no dilution)
            </p>
          </button>

          <button
            onClick={() => setShowIssuanceModal(true)}
            className="p-6 bg-card border border-border rounded-lg hover:shadow-lg transition hover:bg-muted/50"
          >
            <Zap className="w-8 h-8 text-amber-600 mb-3" />
            <h3 className="font-semibold mb-1">Issue New Shares</h3>
            <p className="text-sm text-muted-foreground">
              Create new shares (causes dilution)
            </p>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="p-6 bg-card border border-border rounded-lg hover:shadow-lg transition hover:bg-muted/50"
          >
            <Settings className="w-8 h-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Update authorized/issued shares
            </p>
          </button>
        </div>
      </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-lg max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold mb-4">Configure Shares</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Authorized Shares</label>
                  <input
                    type="number"
                    placeholder={`${config?.authorized_shares || 10000000}`}
                    value={configForm.authorized_shares}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        authorized_shares: e.target.value ? parseInt(e.target.value) : '',
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum shares the company can ever issue
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Issued Shares</label>
                  <input
                    type="number"
                    placeholder={`${config?.issued_shares || 1000000}`}
                    value={configForm.issued_shares}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        issued_shares: e.target.value ? parseInt(e.target.value) : '',
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Shares officially created (cannot exceed authorized)
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Par Value ({selectedCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`${config?.par_value || 1.0}`}
                    value={configForm.par_value}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        par_value: e.target.value ? parseFloat(e.target.value) : '',
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Stated value per share</p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateConfig}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                >
                  Update Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Shareholder Modal */}
      <AnimatePresence>
        {showAddShareholder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-lg max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold mb-4">Add Shareholder</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <input
                    type="text"
                    value={shareholderForm.shareholder_name}
                    onChange={(e) =>
                      setShareholderForm({
                        ...shareholderForm,
                        shareholder_name: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={shareholderForm.shareholder_email}
                    onChange={(e) =>
                      setShareholderForm({
                        ...shareholderForm,
                        shareholder_email: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Shares to Allocate</label>
                  <input
                    type="number"
                    value={shareholderForm.shares_owned}
                    onChange={(e) =>
                      setShareholderForm({
                        ...shareholderForm,
                        shares_owned: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Holder Type</label>
                  <select
                    value={shareholderForm.holder_type}
                    onChange={(e) =>
                      setShareholderForm({
                        ...shareholderForm,
                        holder_type: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="founder">Founder</option>
                    <option value="investor">Investor</option>
                    <option value="employee">Employee</option>
                    <option value="advisor">Advisor</option>
                    <option value="advisor">Advisor</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Equity Type</label>
                  <select
                    value={shareholderForm.equity_type || 'PURCHASED'}
                    onChange={(e) =>
                      setShareholderForm({
                        ...shareholderForm,
                        equity_type: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="PURCHASED">💳 Purchased</option>
                    <option value="GRANTED">🎁 Granted</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Purchased: Cash investment • Granted: Option grant or incentive
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Acquisition Price ({selectedCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={shareholderForm.acquisition_price}
                    onChange={(e) =>
                      setShareholderForm({
                        ...shareholderForm,
                        acquisition_price: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowAddShareholder(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddShareholder}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                >
                  Add Shareholder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold mb-2">Transfer Shares</h2>
              <p className="text-sm text-muted-foreground mb-4">
                No dilution • Ownership changes only
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">From Shareholder</label>
                  <select
                    value={transferForm.from_shareholder_id}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        from_shareholder_id: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="">Select shareholder...</option>
                    {capTable.map((s) => (
                      <option key={s.id} value={s.shareholder_id}>
                        {s.shareholder_name} ({s.shares_owned.toLocaleString()} shares)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">To Shareholder</label>
                  <select
                    value={transferForm.to_shareholder_id}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        to_shareholder_id: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="">Select shareholder...</option>
                    {capTable.map((s) => (
                      <option key={s.id} value={s.shareholder_id}>
                        {s.shareholder_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Shares to Transfer</label>
                  <input
                    type="number"
                    value={transferForm.shares_transferred}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        shares_transferred: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Price Per Share ({selectedCurrency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferForm.transfer_price_per_share}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        transfer_price_per_share: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    placeholder="Leave empty for gift"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Transfer Type</label>
                  <select
                    value={transferForm.transfer_type}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        transfer_type: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="secondary-sale">Secondary Sale</option>
                    <option value="founder-to-investor">Founder to Investor</option>
                    <option value="gift">Gift</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Equity Type</label>
                  <select
                    value={transferForm.equity_type || 'PURCHASED'}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        equity_type: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="PURCHASED">💳 Purchased</option>
                    <option value="GRANTED">🎁 Granted</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Type of equity being transferred
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <input
                    type="text"
                    value={transferForm.reason}
                    onChange={(e) =>
                      setTransferForm({
                        ...transferForm,
                        reason: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                    placeholder="e.g., Secondary funding round"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferShares}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                >
                  Execute Transfer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Issuance Modal */}
      <AnimatePresence>
        {showIssuanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold mb-2">Issue New Shares</h2>
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
                <p className="text-xs text-amber-800 dark:text-amber-200 font-semibold">
                  ⚠️ WARNING: This will dilute all existing shareholders!
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Shares to Issue</label>
                  <input
                    type="number"
                    value={issuanceForm.shares_issued}
                    onChange={(e) =>
                      setIssuanceForm({
                        ...issuanceForm,
                        shares_issued: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: {(config?.unissued_shares || 0).toLocaleString()} shares
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Issuance Price ({selectedCurrency} per share)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={issuanceForm.issued_at_price}
                    onChange={(e) =>
                      setIssuanceForm({
                        ...issuanceForm,
                        issued_at_price: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Recipient Type</label>
                  <select
                    value={issuanceForm.recipient_type}
                    onChange={(e) =>
                      setIssuanceForm({
                        ...issuanceForm,
                        recipient_type: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="investor">Investor</option>
                    <option value="employee-option-pool">Employee Option Pool</option>
                    <option value="advisor">Advisor</option>
                    <option value="convertible-note">Convertible Note</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Equity Type</label>
                  <select
                    value={issuanceForm.equity_type || 'GRANTED'}
                    onChange={(e) =>
                      setIssuanceForm({
                        ...issuanceForm,
                        equity_type: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="PURCHASED">💳 Purchased</option>
                    <option value="GRANTED">🎁 Granted</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Purchased: Cash for shares • Granted: Option or incentive
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Issuance Reason</label>
                  <select
                    value={issuanceForm.issuance_reason}
                    onChange={(e) =>
                      setIssuanceForm({
                        ...issuanceForm,
                        issuance_reason: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="">Select reason...</option>
                    <option value="seed-round">Seed Round</option>
                    <option value="series-a">Series A</option>
                    <option value="series-b">Series B</option>
                    <option value="employee-pool">Employee Pool</option>
                    <option value="advisor">Advisor Grant</option>
                    <option value="strategic-investment">Strategic Investment</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted rounded">
                <p className="text-xs text-muted-foreground">
                  ✓ Requires founder approval before execution
                </p>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowIssuanceModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProposeIssuance}
                  className="flex-1 px-4 py-2 bg-amber-600 text-amber-50 rounded-lg hover:bg-amber-700 transition"
                >
                  Propose Issuance
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Issuances Modal */}
      <AnimatePresence>
        {pendingIssuances.length > 0 && showIssuanceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
