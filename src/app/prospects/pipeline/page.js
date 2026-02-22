'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Plus } from 'lucide-react';

/**
 * Prospect Pipeline Board
 * Kanban-style pipeline view with drag-and-drop support
 */
export default function PipelineBoard() {
  const [prospects, setProspects] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch stages
        const stagesRes = await fetch('/api/prospects?data=stages');
        if (stagesRes.ok) {
          const stagesData = await stagesRes.json();
          setStages(stagesData.data || []);
        }

        // Fetch all prospects
        const prospectsRes = await fetch('/api/prospects');
        if (prospectsRes.ok) {
          const prospectsData = await prospectsRes.json();
          setProspects(prospectsData.data || []);
        } else {
          setError('Failed to fetch prospects');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const groupByStage = () => {
    const grouped = {};
    stages.forEach((stage) => {
      grouped[stage.id] = [];
    });

    prospects.forEach((prospect) => {
      if (grouped[prospect.current_stage_id]) {
        grouped[prospect.current_stage_id].push(prospect);
      }
    });

    return grouped;
  };

  const groupedProspects = groupByStage();

  const stageColors = {
    1: 'blue',
    2: 'purple',
    3: 'orange',
    4: 'yellow',
    5: 'green',
    6: 'red',
  };

  const getColor = (stageId) => stageColors[stageId] || 'gray';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-20 md:pb-0">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-16 md:top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 z-20"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Prospect Pipeline
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Drag prospects between stages to update their progress
          </p>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
            {error}
          </div>
        </div>
      )}

      {/* Pipeline Board */}
      <div className="p-4 md:p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-full">
          {stages.map((stage) => {
            const color = getColor(stage.id);
            const stageProspects = groupedProspects[stage.id] || [];

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-shrink-0 w-96"
              >
                {/* Stage Header */}
                <div
                  className={`bg-${color}-50 dark:bg-${color}-900/20 border-b-2 border-${color}-300 dark:border-${color}-700 p-4 rounded-t-lg`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className={`font-semibold text-${color}-900 dark:text-${color}-100`}>
                      {stage.stage_name}
                    </h3>
                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-full bg-${color}-100 dark:bg-${color}-800 text-${color}-700 dark:text-${color}-200`}
                    >
                      {stageProspects.length}
                    </span>
                  </div>
                </div>

                {/* Stage Cards */}
                <div
                  className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 border-t-0 rounded-b-lg p-4 min-h-96 space-y-3"
                  data-stage-id={stage.id}
                >
                  {stageProspects.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                      <p>No prospects</p>
                      <button className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        <Plus size={14} />
                        Add prospect
                      </button>
                    </div>
                  ) : (
                    stageProspects.map((prospect) => (
                      <motion.div
                        key={prospect.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                        onClick={() => (window.location.href = `/app/prospects/${prospect.id}`)}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical
                            size={16}
                            className="text-gray-400 flex-shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                              {prospect.prospect_name}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {prospect.company_name || 'No company'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 truncate mt-1">
                              {prospect.email}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Note */}
      {prospects.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No prospects yet. Create your first prospect to start managing your pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
