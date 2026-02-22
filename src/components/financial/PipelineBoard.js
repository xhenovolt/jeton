'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';
import { PipelineCard } from './PipelineCard';

const stages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

const stageConfig = {
  Lead: {
    label: 'Prospecting',
    gradient: 'from-sky-700 to-cyan-600',
    soft: 'from-sky-50/70 to-cyan-50/20 dark:from-sky-950/50 dark:to-cyan-950/30',
    border: 'border-sky-200/70 dark:border-sky-800/60',
    accent: 'text-sky-700 dark:text-sky-300',
  },
  Contacted: {
    label: 'Qualified',
    gradient: 'from-indigo-700 to-blue-700',
    soft: 'from-indigo-50/70 to-blue-50/20 dark:from-indigo-950/45 dark:to-blue-950/35',
    border: 'border-indigo-200/70 dark:border-indigo-800/60',
    accent: 'text-indigo-700 dark:text-indigo-300',
  },
  'Proposal Sent': {
    label: 'Proposal',
    gradient: 'from-violet-700 to-fuchsia-700',
    soft: 'from-violet-50/70 to-fuchsia-50/20 dark:from-violet-950/50 dark:to-fuchsia-950/30',
    border: 'border-violet-200/70 dark:border-violet-800/60',
    accent: 'text-violet-700 dark:text-violet-300',
  },
  Negotiation: {
    label: 'Negotiation',
    gradient: 'from-amber-700 to-orange-700',
    soft: 'from-amber-50/70 to-orange-50/20 dark:from-amber-950/50 dark:to-orange-950/30',
    border: 'border-amber-200/70 dark:border-amber-800/60',
    accent: 'text-amber-700 dark:text-amber-300',
  },
  Won: {
    label: 'Closed Won',
    gradient: 'from-emerald-700 to-teal-700',
    soft: 'from-emerald-50/70 to-teal-50/20 dark:from-emerald-950/50 dark:to-teal-950/30',
    border: 'border-emerald-200/70 dark:border-emerald-800/60',
    accent: 'text-emerald-700 dark:text-emerald-300',
  },
  Lost: {
    label: 'Closed Lost',
    gradient: 'from-rose-700 to-red-700',
    soft: 'from-rose-50/70 to-red-50/20 dark:from-rose-950/50 dark:to-red-950/30',
    border: 'border-rose-200/70 dark:border-rose-800/60',
    accent: 'text-rose-700 dark:text-rose-300',
  },
};

function probabilityRingStyle(value) {
  const normalized = Math.max(0, Math.min(100, Math.round(value || 0)));
  return {
    background: `conic-gradient(currentColor ${normalized * 3.6}deg, transparent 0deg)`,
  };
}

export function PipelineBoard({ deals, onStageChange, onEdit, onDelete, onSetStage }) {
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);

  const grouped = useMemo(() => {
    return stages.reduce((acc, stage) => {
      const stageDeals = deals.filter((deal) => deal.stage === stage);
      const ranked = [...stageDeals].sort((a, b) => {
        const aScore = Number(a.value_estimate || 0) * (Number(a.probability || 0) / 100 + 0.5);
        const bScore = Number(b.value_estimate || 0) * (Number(b.probability || 0) / 100 + 0.5);
        return bScore - aScore;
      });

      const totalValue = stageDeals.reduce((sum, deal) => sum + Number(deal.value_estimate || 0), 0);
      const avgProbability = stageDeals.length
        ? stageDeals.reduce((sum, deal) => sum + Number(deal.probability || 0), 0) / stageDeals.length
        : 0;

      acc[stage] = {
        deals: ranked,
        primaryDeal: ranked[0] || null,
        totalValue,
        avgProbability,
      };

      return acc;
    }, {});
  }, [deals]);

  const handleDragStart = (event, deal) => {
    setDraggedCard(deal);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (event, newStage) => {
    event.preventDefault();
    setDragOverStage(null);

    if (!draggedCard || draggedCard.stage === newStage) {
      setDraggedCard(null);
      return;
    }

    try {
      const response = await fetch(`/api/deals/${draggedCard.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...draggedCard,
          stage: newStage,
        }),
      });

      if (response.ok) {
        onStageChange(draggedCard.id, newStage);
      }
    } catch (error) {
      console.error('Error updating deal stage:', error);
    }

    setDraggedCard(null);
  };

  return (
    <>
      <div className="pb-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
          {stages.map((stage, stageIndex) => {
            const config = stageConfig[stage];
            const data = grouped[stage] || { deals: [], primaryDeal: null, totalValue: 0, avgProbability: 0 };

            return (
              <motion.section
                key={stage}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: stageIndex * 0.04 }}
                onDragOver={handleDragOver}
                onDragEnter={() => setDragOverStage(stage)}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(event) => handleDrop(event, stage)}
                className={`flex min-h-[620px] flex-col overflow-hidden rounded-2xl border bg-gradient-to-b ${config.soft} ${config.border} ${
                  dragOverStage === stage ? 'ring-2 ring-slate-700/20 dark:ring-white/25' : ''
                }`}
              >
                <header className={`bg-gradient-to-r ${config.gradient} p-4 text-white`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">{stage}</p>
                      <h3 className="text-lg font-semibold">{config.label}</h3>
                    </div>
                    <div className="rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold backdrop-blur-sm">
                      {data.deals.length}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/65">Stage Value</p>
                      <p className="text-sm font-semibold">
                        <CurrencyDisplay amount={data.totalValue} variant="compact" />
                      </p>
                    </div>

                    <div className={`relative grid h-12 w-12 place-items-center rounded-full p-[2px] ${config.accent}`} style={probabilityRingStyle(data.avgProbability)}>
                      <div className="grid h-full w-full place-items-center rounded-full bg-black/35 text-[10px] font-bold backdrop-blur-sm">
                        {Math.round(data.avgProbability)}%
                      </div>
                    </div>
                  </div>
                </header>

                <div className="flex-1 space-y-3 p-3">
                  <div className="rounded-xl border border-white/30 bg-white/65 p-3 dark:border-slate-700/60 dark:bg-slate-900/45">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                        <Sparkles size={12} />
                        Featured Deal
                      </p>
                      <button
                        onClick={() => setSelectedStage(stage)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        More
                        <ArrowRight size={12} />
                      </button>
                    </div>

                    {data.primaryDeal ? (
                      <div className="space-y-2">
                        <div
                          key={`${data.primaryDeal.id}-primary`}
                          draggable
                          onDragStart={(event) => handleDragStart(event, data.primaryDeal)}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <PipelineCard
                            deal={data.primaryDeal}
                            featured
                            compact
                            isDragging={draggedCard?.id === data.primaryDeal.id}
                            stageColor={config.accent}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onSetStage={onSetStage}
                            onMore={setSelectedDeal}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300/70 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No featured deal yet
                      </div>
                    )}

                    <Link
                      href={`/app/deals?stage=${encodeURIComponent(stage)}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      Open detailed view
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedStage ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            onClick={() => setSelectedStage(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {selectedStage}
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {stageConfig[selectedStage]?.label} Deals
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedStage(null)}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {(grouped[selectedStage]?.deals || []).map((deal) => (
                  <div
                    key={`${selectedStage}-${deal.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{deal.title}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{deal.client_name || 'No company specified'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <CurrencyDisplay amount={Number(deal.value_estimate) || 0} variant="compact" />
                      </p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{Number(deal.probability) || 0}%</p>
                      <button
                        onClick={() => setSelectedDeal(deal)}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        More
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDeal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"
            onClick={() => setSelectedDeal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Deal Detail
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{selectedDeal.title}</h3>
                </div>
                <button
                  onClick={() => setSelectedDeal(null)}
                  className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-100/70 p-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Client</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{selectedDeal.client_name || 'No company specified'}</p>
                </div>
                <div className="rounded-lg bg-slate-100/70 p-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Stage</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{selectedDeal.stage}</p>
                </div>
                <div className="rounded-lg bg-slate-100/70 p-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Deal Value</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                    <CurrencyDisplay amount={Number(selectedDeal.value_estimate) || 0} variant="compact" />
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100/70 p-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Probability</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{Number(selectedDeal.probability) || 0}%</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/app/deals/edit/${selectedDeal.id}`}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  Open Deal
                  <ArrowRight size={12} />
                </Link>
                <button
                  onClick={() => setSelectedDeal(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
