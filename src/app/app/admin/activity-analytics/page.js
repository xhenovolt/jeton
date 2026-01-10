'use client';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { BarChart3, TrendingUp, Users, Activity } from 'lucide-react';

function ActivityAnalyticsContent() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/activity-analytics', {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      setAnalytics(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading analytics...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Activity Analytics</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Users</p>
              <p className="text-3xl font-bold">
                {analytics?.active_users || 0}
              </p>
            </div>
            <Users className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Online Now</p>
              <p className="text-3xl font-bold">
                {analytics?.online_users || 0}
              </p>
            </div>
            <Activity className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Sessions</p>
              <p className="text-3xl font-bold">
                {analytics?.total_sessions || 0}
              </p>
            </div>
            <TrendingUp className="text-purple-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Events Tracked</p>
              <p className="text-3xl font-bold">
                {analytics?.total_events || 0}
              </p>
            </div>
            <BarChart3 className="text-orange-500" size={32} />
          </div>
        </div>
      </div>

      {/* Module Usage */}
      {analytics?.module_usage && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Module Usage</h2>
          <div className="space-y-4">
            {Object.entries(analytics.module_usage).map(([module, count]) => (
              <div key={module}>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{module}</span>
                  <span className="text-gray-600">{count} events</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${
                        Math.min(
                          (count /
                            Math.max(
                              ...Object.values(analytics.module_usage)
                            )) *
                            100,
                          100
                        )
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Popularity */}
      {analytics?.feature_popularity && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Feature Popularity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(analytics.feature_popularity).map(([feature, count]) => (
              <div
                key={feature}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <p className="font-medium">{feature}</p>
                <p className="text-2xl font-bold text-blue-600">{count}</p>
                <p className="text-sm text-gray-600">uses</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Behavior */}
      {analytics?.user_behavior && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">User Behavior</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(analytics.user_behavior).map(([behavior, stats]) => (
              <div key={behavior} className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3 capitalize">
                  {behavior.replace(/_/g, ' ')}
                </h3>
                <div className="space-y-2">
                  {typeof stats === 'object' ? (
                    Object.entries(stats).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-2xl font-bold text-blue-600">
                      {stats}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchAnalytics}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Refresh Analytics
      </button>
    </div>
  );
}

export default function AdminActivityAnalyticsPage() {
  return (
    <AdminLayout>
      <ActivityAnalyticsContent />
    </AdminLayout>
  );
}
