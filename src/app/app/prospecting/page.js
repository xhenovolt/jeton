'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, MoreVertical, Eye } from 'lucide-react';
import ProspectCard from '@/components/prospecting/ProspectCard';
import QuickAddProspectModal from '@/components/prospecting/QuickAddProspectModal';

const statusFilters = [
  'New',
  'Contacted',
  'Follow-Up Needed',
  'Interested',
  'Negotiating',
  'Converted',
  'Not Interested',
  'Lost',
];

const sortOptions = [
  { value: 'recent', label: 'Recently Created' },
  { value: 'overdue', label: 'Overdue Follow-ups' },
  { value: 'interest', label: 'Highest Interest' },
  { value: 'activities', label: 'Most Active' },
];

export default function ProspectListPage() {
  const [prospects, setProspects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  // Fetch prospects
  const fetchProspects = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.append('stage', selectedStatus);
      if (searchQuery) params.append('q', searchQuery);

      const response = await fetch(`/api/prospects?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch prospects');

      const data = await response.json();
      let prospectsList = data.data || [];

      // Sort
      switch (sortBy) {
        case 'overdue':
          prospectsList.sort((a, b) => {
            const aOverdue = a.next_follow_up_date && new Date(a.next_follow_up_date) < new Date();
            const bOverdue = b.next_follow_up_date && new Date(b.next_follow_up_date) < new Date();
            return bOverdue - aOverdue;
          });
          break;
        case 'interest':
          const interestOrder = { 'Very High': 4, 'High': 3, 'Medium': 2, 'Low': 1, 'New': 0 };
          prospectsList.sort((a, b) => 
            (interestOrder[b.interest_level] || 0) - (interestOrder[a.interest_level] || 0)
          );
          break;
        case 'activities':
          prospectsList.sort((a, b) => (b.total_activities_count || 0) - (a.total_activities_count || 0));
          break;
        case 'recent':
        default:
          prospectsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          break;
      }

      setProspects(prospectsList);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, searchQuery, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProspects();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [fetchProspects]);

  const handleProspectAdded = (newProspect) => {
    setProspects(prev => [newProspect, ...prev]);
  };

  const overduCount = prospects.filter(p => 
    p.next_follow_up_date && new Date(p.next_follow_up_date) < new Date()
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospecting Notebook</h1>
          <p className="text-gray-600 mt-1">Manage your sales pipeline with structured prospect tracking</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Add Prospect
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 font-medium">Total Prospects</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{prospects.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 font-medium">Active</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">
            {prospects.filter(p => !['Converted', 'Lost', 'Not Interested'].includes(p.sales_stage)).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 font-medium">Interested</div>
          <div className="text-3xl font-bold text-green-600 mt-1">
            {prospects.filter(p => p.interest_level === 'High' || p.interest_level === 'Very High').length}
          </div>
        </div>
        <div className={`border rounded-lg p-4 ${overduCount > 0 ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
          <div className={`text-sm font-medium ${overduCount > 0 ? 'text-red-700' : 'text-gray-600'}`}>
            Overdue Follow-ups
          </div>
          <div className={`text-3xl font-bold mt-1 ${overduCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overduCount}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 outline-none text-gray-700 placeholder-gray-400"
          />
        </div>

        <div className="grid grid-cols-6 gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
          >
            <option value="">All Statuses</option>
            {statusFilters.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <div className="col-span-3" />
        </div>
      </div>

      {/* Prospects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          Error: {error}
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Eye size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-semibold mb-2">No prospects found</p>
          <p className="text-gray-500 mb-6">Start by adding your first prospect</p>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add First Prospect
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prospects.map(prospect => (
            <ProspectCard
              key={prospect.id}
              prospect={prospect}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <QuickAddProspectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onProspectAdded={handleProspectAdded}
      />
    </div>
  );
}
