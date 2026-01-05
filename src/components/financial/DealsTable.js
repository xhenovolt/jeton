'use client';

/**
 * Deals Table Component
 * Displays deals in a responsive table with edit/delete actions
 * Includes sale linkage indicators for won deals
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, TrendingUp, Check, ArrowRight, AlertCircle } from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

const stageColors = {
  Lead: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  Contacted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  'Proposal Sent': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  Negotiation: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  Won: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  Lost: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function DealsTable({ deals, onEdit, onDelete }) {
  const [saleLinks, setSaleLinks] = useState({});
  const [loading, setLoading] = useState({});

  // Fetch sale linkage for won deals
  useEffect(() => {
    const fetchSaleLinks = async () => {
      const wonDeals = deals.filter(d => d.stage === 'Won');
      
      for (const deal of wonDeals) {
        if (!saleLinks[deal.id]) {
          try {
            setLoading(prev => ({ ...prev, [deal.id]: true }));
            const response = await fetch(`/api/deals/${deal.id}/convert-to-sale`);
            const result = await response.json();
            
            if (result.success) {
              setSaleLinks(prev => ({ ...prev, [deal.id]: result.data }));
            }
          } catch (error) {
            console.error(`Failed to fetch sale link for deal ${deal.id}:`, error);
          } finally {
            setLoading(prev => ({ ...prev, [deal.id]: false }));
          }
        }
      }
    };

    if (deals.length > 0) {
      fetchSaleLinks();
    }
  }, [deals, saleLinks]);

  const handleViewSale = (saleId) => {
    if (saleId) {
      window.location.href = `/app/sales#sale-${saleId}`;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Deal Title
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Client
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Value
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Stage
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Probability
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Expected Close
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
              Sales Status
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {deals.map((deal, index) => (
            <motion.tr
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
            >
              <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                {deal.title}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                {deal.client_name || '-'}
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                <CurrencyDisplay amount={parseInt(deal.value_estimate)} />
              </td>
              <td className="px-6 py-4 text-sm">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stageColors[deal.stage]}`}>
                  {deal.stage}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${deal.probability}%` }}
                    />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">{deal.probability}%</span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                {deal.expected_close_date || '-'}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(deal)}
                    className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                    aria-label="Edit deal"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(deal.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors text-red-600 dark:text-red-400"
                    aria-label="Delete deal"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
