'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, ChevronDown } from 'lucide-react';
import Link from 'next/link';

/**
 * Prospects List Page
 * Main view for managing all prospects with filtering and search
 */
export default function ProspectsPage() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [stages, setStages] = useState([]);

  // Fetch prospects and reference data
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

        // Fetch prospects
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

  // Filter prospects
  const filteredProspects = prospects.filter((prospect) => {
    const matchSearch =
      prospect.prospect_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prospect.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStage = !filterStage || prospect.current_stage_id === parseInt(filterStage);

    return matchSearch && matchStage;
  });

  const getStageLabel = (stageId) => {
    const stage = stages.find((s) => s.id === stageId);
    return stage?.stage_name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300">Loading prospects...</p>
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Prospects
            </h1>
            <Link
              href="/app/prospects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Prospect</span>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, company, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Stage Filter */}
            <div className="relative">
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-10"
              >
                <option value="">All Stages</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.stage_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-3 pointer-events-none text-gray-400"
                size={18}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {filteredProspects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery || filterStage ? 'No prospects found matching your filters.' : 'No prospects yet.'}
            </p>
            <Link
              href="/app/prospects/new"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create First Prospect
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredProspects.map((prospect) => (
              <motion.div
                key={prospect.id}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => (window.location.href = `/app/prospects/${prospect.id}`)}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {prospect.prospect_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {prospect.company_name || 'No company'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 truncate mt-1">
                  {prospect.email}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
                    {getStageLabel(prospect.current_stage_id)}
                  </span>
                  {prospect.status && (
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        prospect.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {prospect.status}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Count */}
        {filteredProspects.length > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-6">
            Showing {filteredProspects.length} of {prospects.length} prospects
          </p>
        )}
      </div>
    </div>
  );
}
