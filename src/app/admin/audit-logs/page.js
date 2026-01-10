'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { fetchWithAuth } from '@/lib/fetch-client';
import { Filter, Download } from 'lucide-react';

function AuditLogsContent() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    action: '',
    entity: '',
    user_id: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetchWithAuth(`/api/admin/audit-logs?${params}`);

      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      setLogs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      action: '',
      entity: '',
      user_id: '',
      startDate: '',
      endDate: '',
    });
  };

  if (loading) {
    return <div className="p-6">Loading audit logs...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
          <Download size={20} />
          Export
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} />
          <span className="font-semibold">Filters</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <input
              type="text"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
              placeholder="e.g., USER_CREATED"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Entity</label>
            <input
              type="text"
              name="entity"
              value={filters.entity}
              onChange={handleFilterChange}
              placeholder="e.g., users"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">User ID</label>
            <input
              type="text"
              name="user_id"
              value={filters.user_id}
              onChange={handleFilterChange}
              placeholder="Filter by user"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <button
          onClick={handleClearFilters}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Clear Filters
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-semibold">Action</th>
              <th className="text-left px-6 py-3 text-sm font-semibold">Entity</th>
              <th className="text-left px-6 py-3 text-sm font-semibold">User</th>
              <th className="text-left px-6 py-3 text-sm font-semibold">Timestamp</th>
              <th className="text-left px-6 py-3 text-sm font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium">{log.action}</td>
                <td className="px-6 py-3 text-sm">{log.entity_type}</td>
                <td className="px-6 py-3 text-sm">{log.user_id || 'System'}</td>
                <td className="px-6 py-3 text-sm">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {log.description || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No audit logs found matching your filters
        </div>
      )}
    </div>
  );
}

export default function AdminAuditLogsPage() {
  return (
    <AdminLayout>
      <AuditLogsContent />
    </AdminLayout>
  );
}
