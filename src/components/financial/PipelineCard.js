'use client';

/**
 * Pipeline Card Component
 * Individual deal card for kanban board
 */

import { motion } from 'framer-motion';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

export function PipelineCard({ deal, onDelete, isDragging }) {
  const expectedValue = Math.round(
    Number(deal.value_estimate) * (Number(deal.probability) / 100)
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? 'shadow-xl' : 'shadow'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-start gap-2 mb-3">
        <GripVertical size={16} className="text-slate-400 flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
            {deal.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {deal.client_name || 'No client'}
          </p>
        </div>
      </div>

      {/* Card Body */}
      <div className="space-y-3">
        {/* Values */}
        <div className="space-y-1">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Estimate: <span className="font-semibold text-slate-900 dark:text-white">
              <CurrencyDisplay amount={parseInt(deal.value_estimate)} />
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Expected: <span className="font-semibold text-blue-600 dark:text-blue-400">
              <CurrencyDisplay amount={expectedValue} />
            </span>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Probability</span>
            <span className="font-semibold text-slate-900 dark:text-white">{deal.probability}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-orange-500 to-green-500 h-1.5 rounded-full transition-all"
              style={{ width: `${deal.probability}%` }}
            />
          </div>
        </div>

        {/* Close Date */}
        {deal.expected_close_date && (
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Close: <span className="font-semibold">{deal.expected_close_date}</span>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
        <Link
          href={`/app/deals/edit/${deal.id}`}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
        >
          <Edit2 size={14} />
          Edit
        </Link>
        <button
          onClick={() => onDelete(deal.id)}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </motion.div>
  );
}
