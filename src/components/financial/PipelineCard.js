'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Edit2,
  GripVertical,
  MoreHorizontal,
  OctagonX,
  Trash2,
} from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';

const stageOrder = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

function getProbabilityBand(probability) {
  if (probability >= 75) return 'high';
  if (probability >= 50) return 'medium';
  if (probability >= 25) return 'low';
  return 'risk';
}

function getStatusPill(deal) {
  if (deal.stage === 'Won') {
    return {
      label: 'Won',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    };
  }

  if (deal.stage === 'Lost') {
    return {
      label: 'Lost',
      className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
    };
  }

  return {
    label: deal.status || 'Active',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  };
}

function getAgentLabel(deal) {
  const raw = deal.assigned_to_name || deal.assigned_to || 'Unassigned';
  if (raw.length <= 2) return raw.toUpperCase();
  if (raw.includes(' ')) {
    return raw
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((piece) => piece[0])
      .join('')
      .toUpperCase();
  }
  return raw.slice(0, 2).toUpperCase();
}

function formatCloseDate(date) {
  if (!date) return 'Date not set';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Date not set';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PipelineCard({
  deal,
  onDelete,
  onSetStage,
  onMore,
  isDragging,
  stageColor = 'text-slate-700',
  compact = false,
  featured = false,
}) {
  const probability = Number(deal.probability) || 0;
  const value = Number(deal.value_estimate) || 0;
  const expected = Math.round(value * (probability / 100));
  const probabilityBand = getProbabilityBand(probability);
  const status = getStatusPill(deal);

  const probabilityClasses = {
    high: 'from-emerald-500 to-teal-500',
    medium: 'from-sky-500 to-indigo-500',
    low: 'from-amber-500 to-orange-500',
    risk: 'from-rose-500 to-red-500',
  };

  const currentStageIndex = stageOrder.indexOf(deal.stage);
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < stageOrder.length - 2
      ? stageOrder[currentStageIndex + 1]
      : null;

  return (
    <motion.article
      layout
      whileHover={{ y: -2 }}
      className={`group rounded-xl border border-slate-200/75 bg-white/95 p-3 shadow-[0_8px_20px_-18px_rgba(15,23,42,.9)] transition-all duration-200 dark:border-slate-700/80 dark:bg-slate-900/90 ${
        isDragging ? 'scale-[1.02] shadow-xl ring-2 ring-slate-400/30' : ''
      } ${featured ? 'ring-1 ring-amber-400/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-1 text-slate-400" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{deal.title}</h4>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{deal.client_name || 'No company specified'}</p>
            </div>

            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${status.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Deal Value</p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                <CurrencyDisplay amount={value} variant="compact" />
              </p>
            </div>
            {!compact ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Expected</p>
                <p className={`mt-1 text-base font-bold ${stageColor}`}>
                  <CurrencyDisplay amount={expected} variant="compact" />
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span>Probability</span>
              <span>{probability}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${probability}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${probabilityClasses[probabilityBand]}`}
              />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
              <Calendar size={12} />
              <span>{formatCloseDate(deal.expected_close_date)}</span>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
                {getAgentLabel(deal)}
              </span>
              <span className="max-w-[80px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                {deal.assigned_to_name || 'Unassigned'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-200 pt-2.5 dark:border-slate-700">
            <Link
              href={`/app/deals/edit/${deal.id}`}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Edit2 size={12} />
              Edit
            </Link>

            {nextStage ? (
              <button
                onClick={() => onSetStage?.(deal, nextStage)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <ArrowRight size={12} />
                Move
              </button>
            ) : (
              <span className="inline-flex flex-1 items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-400">
                <MoreHorizontal size={12} />
              </span>
            )}

            <button
              onClick={() => onMore?.(deal)}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <MoreHorizontal size={12} />
              More
            </button>

            {deal.stage !== 'Won' ? (
              <button
                onClick={() => onSetStage?.(deal, 'Won')}
                className="inline-flex items-center justify-center rounded-md px-2 py-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-300"
                title="Mark won"
              >
                <CheckCircle2 size={13} />
              </button>
            ) : null}

            {deal.stage !== 'Lost' ? (
              <button
                onClick={() => onSetStage?.(deal, 'Lost')}
                className="inline-flex items-center justify-center rounded-md px-2 py-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
                title="Mark lost"
              >
                <OctagonX size={13} />
              </button>
            ) : null}

            <button
              onClick={() => onDelete?.(deal.id)}
              className="inline-flex items-center justify-center rounded-md px-2 py-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
