'use client';

/**
 * Create Deal Page
 * Form to create a new deal
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Save, X } from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

const stages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

export default function CreateDealPage() {
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    value_estimate: '',
    probability: 50,
    stage: 'Lead',
    assigned_to: '',
    expected_close_date: '',
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStaff(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          ...formData,
          value_estimate: parseFloat(formData.value_estimate),
          probability: parseInt(formData.probability),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setError(error.message || 'Failed to create deal');
        return;
      }

      router.push('/app/pipeline');
    } catch (error) {
      console.error('Error creating deal:', error);
      setError('An error occurred while creating the deal');
    } finally {
      setSubmitting(false);
    }
  };

  const weightedValue = (parseFloat(formData.value_estimate) || 0) * (parseInt(formData.probability) / 100);

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/app/pipeline" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:opacity-80 mb-4">
          <ArrowLeft size={18} />
          Back to Pipeline
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Deal</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Add a new deal to your sales pipeline</p>
      </div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6"
      >
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg flex items-start gap-3"
          >
            <X size={18} className="flex-shrink-0 mt-0.5" />
            <div>{error}</div>
          </motion.div>
        )}

        {/* Deal Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Deal Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="e.g., Enterprise License Agreement"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Add details about this deal..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Value and Probability */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estimated Value (UGX) *
            </label>
            <input
              type="number"
              name="value_estimate"
              value={formData.value_estimate}
              onChange={handleInputChange}
              placeholder="0"
              min="0"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Probability ({formData.probability}%)
            </label>
            <input
              type="range"
              name="probability"
              value={formData.probability}
              onChange={handleInputChange}
              min="0"
              max="100"
              step="10"
              className="w-full"
            />
          </div>
        </div>

        {/* Weighted Value Display */}
        {formData.value_estimate && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              Weighted Value: <span className="font-bold">
                <CurrencyDisplay amount={weightedValue} variant="compact" />
              </span>
            </p>
          </div>
        )}

        {/* Stage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Pipeline Stage *
          </label>
          <select
            name="stage"
            value={formData.stage}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {stages.map(stage => (
              <option key={stage} value={stage}>{stage}</option>
            ))}
          </select>
        </div>

        {/* Assigned To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Assigned To
          </label>
          <select
            name="assigned_to"
            value={formData.assigned_to}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">Select a staff member...</option>
            {staff.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>

        {/* Expected Close Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Expected Close Date
          </label>
          <input
            type="date"
            name="expected_close_date"
            value={formData.expected_close_date}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            <Save size={18} />
            {submitting ? 'Creating...' : 'Create Deal'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => router.push('/app/pipeline')}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </motion.button>
        </div>
      </motion.form>
    </div>
  );
}
