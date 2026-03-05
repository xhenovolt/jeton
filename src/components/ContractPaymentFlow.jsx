/**
 * ContractPaymentFlow Component
 * Handles the core workflow:
 * 1. Create/Select Contract
 * 2. Record Payment
 * 3. Allocate Money
 */

'use client';

import { useState, useEffect } from 'react';

export function ContractPaymentFlow() {
  const [step, setStep] = useState(1); // 1: Contract, 2: Payment, 3: Allocate
  const [clients, setClients] = useState([]);
  const [systems, setSystems] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payment, setPayment] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [categories, setCategories] = useState([]);

  // Form states
  const [contractForm, setContractForm] = useState({
    client_id: '',
    system_id: '',
    installation_fee: 0,
    recurring_enabled: false,
    recurring_cycle: null,
    recurring_amount: null,
    status: 'active',
  });

  const [paymentForm, setPaymentForm] = useState({
    contract_id: '',
    amount_received: 0,
    date_received: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
  });

  const [allocationForm, setAllocationForm] = useState({
    allocation_type: 'operating',
    amount: 0,
    description: '',
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [clientsRes, systemsRes, categoriesRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/intellectual-property'),
        fetch('/api/expense-categories'),
      ]);

      const clientsData = await clientsRes.json();
      const systemsData = await systemsRes.json();
      const categoriesData = await categoriesRes.json();

      if (clientsData.success) setClients(clientsData.clients || []);
      if (systemsData.success) setSystems(systemsData.records || []);
      if (categoriesData.success) setCategories(categoriesData.categories || []);
    } catch (err) {
      setError('Failed to load initial data: ' + err.message);
    }
  }

  // Handle contract creation
  async function handleCreateContract(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (!contractForm.client_id || !contractForm.system_id) {
        throw new Error('Client and System are required');
      }

      if (contractForm.recurring_enabled) {
        if (!contractForm.recurring_cycle || !contractForm.recurring_amount) {
          throw new Error('Recurring cycle and amount required when recurring is enabled');
        }
      }

      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractForm),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      // Move to payment step
      setPaymentForm({ ...paymentForm, contract_id: data.contract.id });
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle payment creation
  async function handleCreatePayment(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!paymentForm.contract_id || paymentForm.amount_received <= 0) {
        throw new Error('Contract and amount required');
      }

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setPayment(data.payment);
      setAllocations([]);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle allocation creation
  async function handleAddAllocation(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!payment) throw new Error('Payment not found');
      if (allocationForm.amount <= 0) throw new Error('Amount must be > 0');

      const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
      const remaining = payment.amount_received - totalAllocated;

      if (allocationForm.amount > remaining) {
        throw new Error(`Amount exceeds remaining: ${remaining} UGX`);
      }

      const payload = {
        payment_id: payment.id,
        allocation_type: allocationForm.allocation_type,
        amount: allocationForm.amount,
        description: allocationForm.description,
      };

      // Add category if type is expense or has category
      if (allocationForm.category_id) {
        payload.category_id = allocationForm.category_id;
      }

      const response = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setAllocations([...allocations, data.allocation]);
      setAllocationForm({
        allocation_type: 'operating',
        amount: 0,
        description: '',
        category_id: '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Check if payment is fully allocated
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const isFullyAllocated = payment && Math.abs(totalAllocated - payment.amount_received) < 0.01;
  const remaining = payment ? payment.amount_received - totalAllocated : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-4xl font-bold">Record Contract & Payment</h1>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-900">
          {error}
        </div>
      )}

      {/* Step 1: Contract */}
      {step >= 1 && (
        <div className="border rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Step 1: Create Contract</h2>
          <form onSubmit={handleCreateContract} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Selection */}
              <div>
                <label className="block font-bold mb-2">Client (REQUIRED)</label>
                <select
                  value={contractForm.client_id}
                  onChange={(e) => setContractForm({ ...contractForm, client_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Select Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* System Selection */}
              <div>
                <label className="block font-bold mb-2">System to Sell (REQUIRED)</label>
                <select
                  value={contractForm.system_id}
                  onChange={(e) => setContractForm({ ...contractForm, system_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="">Select System</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Installation Fee */}
              <div>
                <label className="block font-bold mb-2">Installation Fee</label>
                <input
                  type="number"
                  step="0.01"
                  value={contractForm.installation_fee}
                  onChange={(e) =>
                    setContractForm({ ...contractForm, installation_fee: parseFloat(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={contractForm.recurring_enabled}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        recurring_enabled: e.target.checked,
                        recurring_cycle: e.target.checked ? 'monthly' : null,
                        recurring_amount: e.target.checked ? 0 : null,
                      })
                    }
                    className="mr-2"
                  />
                  <span className="font-bold">Enable Recurring Revenue?</span>
                </label>
              </div>

              {/* Conditional: Recurring Fields */}
              {contractForm.recurring_enabled && (
                <>
                  <div>
                    <label className="block font-bold mb-2">Recurring Cycle</label>
                    <select
                      value={contractForm.recurring_cycle || ''}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, recurring_cycle: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded"
                      required
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold mb-2">Recurring Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={contractForm.recurring_amount || 0}
                      onChange={(e) =>
                        setContractForm({ ...contractForm, recurring_amount: parseFloat(e.target.value) })
                      }
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded font-bold disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Contract & Continue'}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Payment */}
      {step >= 2 && (
        <div className="border rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Step 2: Record Payment</h2>
          {step === 2 && (
            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-2">Amount Received (UGX)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount_received}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount_received: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold mb-2">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, payment_method: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="check">Check</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-2">Date Received</label>
                  <input
                    type="date"
                    value={paymentForm.date_received}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, date_received: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded font-bold disabled:bg-gray-400"
              >
                {loading ? 'Recording...' : 'Record Payment & Allocate'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Step 3: Allocations */}
      {step >= 3 && payment && (
        <div className="border rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Step 3: Allocate Money</h2>

          {/* Allocation Status */}
          <div className="mb-6 p-4 bg-blue-50 rounded">
            <p className="font-bold">Total to Allocate: {payment.amount_received.toLocaleString()} UGX</p>
            <p className="font-bold">Already Allocated: {totalAllocated.toLocaleString()} UGX</p>
            <p className={`font-bold ${remaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
              Remaining: {remaining.toLocaleString()} UGX
            </p>
            {isFullyAllocated && (
              <p className="text-green-600 font-bold mt-2">✅ Payment fully allocated!</p>
            )}
          </div>

          {/* Allocations List */}
          {allocations.length > 0 && (
            <div className="mb-6 space-y-2">
              {allocations.map((alloc, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded flex justify-between">
                  <div>
                    <p className="font-bold capitalize">{alloc.allocation_type}</p>
                    <p className="text-gray-600 text-sm">{alloc.description || '(no description)'}</p>
                  </div>
                  <p className="font-bold">{alloc.amount.toLocaleString()} UGX</p>
                </div>
              ))}
            </div>
          )}

          {/* Add Allocation Form */}
          {remaining > 0 ? (
            <form onSubmit={handleAddAllocation} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-2">Allocation Type</label>
                  <select
                    value={allocationForm.allocation_type}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, allocation_type: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="operating">Operating</option>
                    <option value="vault">Vault (Savings)</option>
                    <option value="expense">Expense</option>
                    <option value="investment">Investment</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-2">Amount (max {remaining.toLocaleString()} UGX)</label>
                  <input
                    type="number"
                    step="0.01"
                    max={remaining}
                    value={allocationForm.amount}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, amount: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold mb-2">Description</label>
                  <input
                    type="text"
                    value={allocationForm.description}
                    onChange={(e) =>
                      setAllocationForm({ ...allocationForm, description: e.target.value })
                    }
                    placeholder="Why is this allocation being made?"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded font-bold disabled:bg-gray-400"
              >
                {loading ? 'Adding...' : 'Add Allocation'}
              </button>
            </form>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-900 font-bold">✅ Payment fully allocated! You can proceed with reconciliation.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContractPaymentFlow;
