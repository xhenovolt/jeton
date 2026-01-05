'use client';

/**
 * Pipeline Kanban Board Component
 * Drag-and-drop kanban board for deal stages
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CurrencyDisplay from '@/components/common/CurrencyDisplay';
import { PipelineCard } from './PipelineCard';

const stages = ['Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

const stageColors = {
  Lead: 'from-blue-500 to-blue-600',
  Contacted: 'from-indigo-500 to-indigo-600',
  'Proposal Sent': 'from-purple-500 to-purple-600',
  Negotiation: 'from-orange-500 to-orange-600',
  Won: 'from-green-500 to-green-600',
  Lost: 'from-red-500 to-red-600',
};

export function PipelineBoard({ deals, onStageChange, onEdit, onDelete }) {
  const [draggedCard, setDraggedCard] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const getDealsByStage = (stage) => {
    return deals.filter(deal => deal.stage === stage);
  };

  const getTotalForStage = (stage) => {
    return getDealsByStage(stage).reduce((sum, deal) => {
      const expected = Number(deal.value_estimate) * (Number(deal.probability) / 100);
      return sum + expected;
    }, 0);
  };

  const getCountForStage = (stage) => {
    return getDealsByStage(stage).length;
  };

  const handleDragStart = (e, deal) => {
    setDraggedCard(deal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (stage) => {
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e, newStage) => {
    e.preventDefault();
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
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
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
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {stages.map(stage => {
          const stageDeal = getDealsByStage(stage);
          const total = getTotalForStage(stage);
          const count = getCountForStage(stage);
          const gradientClass = stageColors[stage];

          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="w-80 flex-shrink-0"
            >
              {/* Column Header */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
                className={`bg-gradient-to-br ${gradientClass} rounded-t-lg p-4 text-white transition-all ${
                  dragOverStage === stage ? 'ring-2 ring-offset-2 ring-current' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{stage}</h3>
                  <span className="bg-white/30 px-2 py-1 rounded text-sm font-medium">
                    {count}
                  </span>
                </div>
                <p className="text-sm text-white/80">
                  <CurrencyDisplay amount={total} />
                </p>
              </div>

              {/* Column Body */}
              <div
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
                className={`bg-slate-50 dark:bg-slate-900/50 min-h-96 rounded-b-lg p-3 space-y-3 transition-colors ${
                  dragOverStage === stage ? 'ring-2 ring-current ring-offset-2' : ''
                }`}
              >
                <AnimatePresence mode="popLayout">
                  {stageDeal.length > 0 ? (
                    stageDeal.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal)}
                        className="cursor-move"
                      >
                        <PipelineCard
                          deal={deal}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          isDragging={draggedCard?.id === deal.id}
                        />
                      </div>
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500"
                    >
                      <div className="text-center">
                        <p className="text-sm">No deals</p>
                        <p className="text-xs mt-1">Drag deals here</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
