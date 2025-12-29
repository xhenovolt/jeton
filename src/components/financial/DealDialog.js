'use client';

/**
 * Deal Dialog Component
 * Modal for creating and editing deals
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const stages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

export function DealDialog({ isOpen, deal, onClose, onSave, isLoading = false }) {
  const [formData, setFormData] = useState({
    title: '',
    client_name: '',
    value_estimate: '',
    stage: 'Lead',
    probability: 50,
    expected_close_date: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        client_name: deal.client_name || '',
        value_estimate: deal.value_estimate || '',
        stage: deal.stage || 'Lead',
        probability: deal.probability || 50,
        expected_close_date: deal.expected_close_date || '',
        notes: deal.notes || '',
      });
    } else {
      setFormData({
        title: '',
        client_name: '',
        value_estimate: '',
        stage: 'Lead',
        probability: 50,
        expected_close_date: '',
        notes: '',
      });
    }
    setErrors({});
  }, [isOpen, deal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'probability' || name === 'value_estimate' 
        ? value === '' ? '' : Number(value)
        : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (formData.value_estimate && isNaN(formData.value_estimate)) newErrors.value_estimate = 'Must be a number';
    if (formData.probability < 0 || formData.probability > 100) newErrors.probability = 'Must be 0-100';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 rounded-lg shadow-xl z-50 w-full max-w-md mx-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {deal ? 'Edit Deal' : 'New Deal'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Deal Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., XYZ Corporation Contract"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Client company name"
                />
              </div>

              {/* Value Estimate */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Value Estimate (UGX)
                </label>
                <input
                  type="number"
                  name="value_estimate"
                  value={formData.value_estimate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                />
                {errors.value_estimate && <p className="text-red-500 text-sm mt-1">{errors.value_estimate}</p>}
              </div>

              {/* Stage */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Stage
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {stages.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>

              {/* Probability */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Probability of Win: {formData.probability}%
                </label>
                <input
                  type="range"
                  name="probability"
                  value={formData.probability}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  step="5"
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                {errors.probability && <p className="text-red-500 text-sm mt-1">{errors.probability}</p>}
              </div>

              {/* Expected Close Date */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Expected Close Date
                </label>
                <input
                  type="date"
                  name="expected_close_date"
                  value={formData.expected_close_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {isLoading ? 'Saving...' : 'Save Deal'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
