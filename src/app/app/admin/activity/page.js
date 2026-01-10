'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, Calendar } from 'lucide-react';

function ActivityAnalyticsContent() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('7');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [period, userId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ period });
      if (userId) params.append('user_id', userId);

      const response = await fetch(`/api/admin/activity-analytics?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch activity analytics');
      const data = await response.json();
      setAnalytics(data.data || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics();
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading activity analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Activity Analytics</h1>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw size={20} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} />
          <span className="font-semibold">Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="1">Last 1 Day</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">User ID (Optional)</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Filter by user ID"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Users */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-medium">Active Users (24h)</div>
          <div className="text-4xl font-bold text-blue-600 mt-2">
            {analytics?.summary?.active_users || 0}
          </div>
          <p className="text-sm text-gray-600 mt-2">Users active in the last 24 hours</p>
        </div>

        {/* Online Users */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 font-medium">Currently Online</div>
          <div className="text-4xl font-bold text-green-600 mt-2">
            {analytics?.summary?.online_users || 0}
          </div>
          <p className="text-sm text-gray-600 mt-2">Users with active sessions</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Modules by Usage */}
        {analytics?.topModules && analytics.topModules.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Top Modules by Usage</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topModules}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="module" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="usage_count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Features/Actions */}
        {analytics?.features && analytics.features.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Top Features/Actions</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.features}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="action_type" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Activity by Module */}
      {analytics?.modules && analytics.modules.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Activity by Module</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.modules}
                dataKey="count"
                nameKey="module"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {analytics.modules.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* User Activity Timeline (if user selected) */}
      {userId && analytics?.userActivity && analytics.userActivity.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">User Activity Timeline</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.userActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="activity_count"
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Details Tables */}
      {analytics?.modules && analytics.modules.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Activity Details by Module</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Module</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Count</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {analytics.modules.map((module, index) => {
                  const total = analytics.modules.reduce((sum, m) => sum + m.count, 0);
                  const percentage = ((module.count / total) * 100).toFixed(2);
                  return (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-3">{module.module}</td>
                      <td className="px-6 py-3 font-medium">{module.count}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <AdminLayout>
      <ActivityAnalyticsContent />
    </AdminLayout>
  );
}
