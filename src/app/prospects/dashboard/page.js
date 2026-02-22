'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, Target, TrendingUp } from 'lucide-react';

/**
 * Prospect Dashboard
 * Executive-level view of prospect pipeline metrics
 */
export default function ProspectDashboard() {
  const [pipelineData, setpipelineData] = useState(null);
  const [agentData, setAgentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch pipeline summary
        const pipelineRes = await fetch('/api/prospects/dashboard');
        if (pipelineRes.ok) {
          const data = await pipelineRes.json();
          setpipelineData(data.data);
        } else {
          setError('Failed to fetch pipeline data');
        }

        // Fetch agent performance
        const agentsRes = await fetch('/api/prospects/dashboard?endpoint=agents');
        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgentData(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const MetricCard = ({ icon: Icon, label, value, subtext, color = 'blue' }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800 rounded-lg p-6`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-${color}-600 dark:text-${color}-400 text-sm font-medium`}>{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </p>
          {subtext && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{subtext}</p>}
        </div>
        <Icon className={`text-${color}-600 dark:text-${color}-400 opacity-20`} size={40} />
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300">Loading dashboard...</p>
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
        className="sticky top-16 md:top-0 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 z-20"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Prospect Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time pipeline metrics and performance</p>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 mb-6">
            {error}
          </div>
        )}

        {/* Key Metrics */}
        {pipelineData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            <MetricCard
              icon={Target}
              label="Total Prospects"
              value={pipelineData.total_prospects || 0}
              color="blue"
            />
            <MetricCard
              icon={TrendingUp}
              label="Conversion Rate"
              value={`${(pipelineData.conversion_rate || 0).toFixed(1)}%`}
              color="green"
            />
            <MetricCard
              icon={Users}
              label="Active Prospects"
              value={pipelineData.active_prospects || 0}
              color="purple"
            />
            <MetricCard
              icon={BarChart3}
              label="Upcoming Follow-ups"
              value={pipelineData.overdue_followups || 0}
              color="orange"
            />
          </motion.div>
        )}

        {/* Pipeline by Stage */}
        {pipelineData?.stages && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-8"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Pipeline by Stage
            </h2>
            <div className="space-y-4">
              {pipelineData.stages.map((stage, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {stage.stage_name}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {stage.prospect_count} ({stage.percentage || 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stage.percentage || 0}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="bg-blue-600 h-2 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Agent Performance */}
        {agentData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Agent Performance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Agent
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Prospects
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Converted
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agentData.map((agent, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{agent.agent_name}</td>
                      <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">
                        {agent.total_prospects}
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">
                        {agent.converted_count}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">
                        {(agent.conversion_rate || 0).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
