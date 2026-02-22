'use client';

import React, { useState, useRef } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';

export default function QuickAddProspectModal({ isOpen, onClose, onProspectAdded }) {
  const [formData, setFormData] = useState({
    prospect_name: '',
    phone: '',
    business_name: '',
    email: '',
    product_discussed: '',
    conversation_notes: '',
    interest_level: 'New',
    source: 'walk-in',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandAdvanced, setExpandAdvanced] = useState(false);
  const [error, setError] = useState(null);
  const nameInputRef = useRef(null);

  const sources = [
    'walk-in',
    'referral',
    'cold call',
    'event',
    'online',
    'social media',
    'email',
    'other',
  ];

  const interestLevels = ['New', 'Low', 'Medium', 'High', 'Very High'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.prospect_name.trim()) {
      setError('Name is required');
      nameInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/prospects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || '',
        },
        body: JSON.stringify({
          ...formData,
          sales_stage: 'New',
          status: 'Active',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add prospect');
      }

      const data = await response.json();
      onProspectAdded?.(data.data);

      // Reset form
      setFormData({
        prospect_name: '',
        phone: '',
        business_name: '',
        email: '',
        product_discussed: '',
        conversation_notes: '',
        interest_level: 'New',
        source: 'walk-in',
      });
      setExpandAdvanced(false);

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Add Prospect</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Essential fields */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              name="prospect_name"
              value={formData.prospect_name}
              onChange={handleChange}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+250 7XX XXX XXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Institution
            </label>
            <input
              type="text"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              placeholder="Company / Organization"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Product Discussed
            </label>
            <input
              type="text"
              name="product_discussed"
              value={formData.product_discussed}
              onChange={handleChange}
              placeholder="What did you discuss?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Quick Note
            </label>
            <textarea
              name="conversation_notes"
              value={formData.conversation_notes}
              onChange={handleChange}
              placeholder="How did it go? What did they say?"
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Advanced fields */}
          <button
            type="button"
            onClick={() => setExpandAdvanced(!expandAdvanced)}
            className="w-full flex items-center justify-between text-sm font-semibold text-blue-600 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition-colors"
          >
            <span>Advanced Fields</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${expandAdvanced ? 'rotate-180' : ''}`}
            />
          </button>

          {expandAdvanced && (
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="prospect@company.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Interest Level
                </label>
                <select
                  name="interest_level"
                  value={formData.interest_level}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  {interestLevels.map(level => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Source
                </label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  {sources.map(src => (
                    <option key={src} value={src}>
                      {src.charAt(0).toUpperCase() + src.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isSubmitting ? 'Adding...' : 'Add Prospect'}
          </button>
        </form>

        {/* Speed tip */}
        <div className="bg-blue-50 border-t border-blue-100 p-3 text-center text-xs text-blue-700">
          💨 Fill just the essential fields to add a prospect in under 20 seconds
        </div>
      </div>
    </div>
  );
}
