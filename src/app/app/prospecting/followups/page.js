'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, Phone, Mail, CheckCircle2, Clock } from 'lucide-react';

/**
 * Follow-ups Page
 * Daily sales agenda: Who needs follow-up today?
 * High-velocity view of prospects that need immediate action
 */
export default function FollowupsPage() {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('overdue'); // overdue | today | upcoming

  useEffect(() => {
    const fetchFollowups = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/prospects/followups?filter=${filter}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch follow-ups');
        }
        
        const data = await response.json();
        setFollowups(data.data || []);
      } catch (err) {
        console.error('Error fetching follow-ups:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowups();
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading follow-ups...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-gray-600 mt-2">Daily agenda: who needs your attention today?</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { label: 'Overdue', value: 'overdue', count: followups.filter(f => f.is_overdue).length },
            { label: 'Today', value: 'today', count: followups.filter(f => f.is_today).length },
            { label: 'Upcoming', value: 'upcoming', count: followups.filter(f => f.is_upcoming).length },
          ].map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === btn.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-gray-400'
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error loading follow-ups</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!error && followups.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No follow-ups needed!</p>
            <p className="text-gray-500 text-sm mt-1">You're all caught up on this filter.</p>
          </div>
        )}

        {/* Follow-ups List */}
        {!error && followups.length > 0 && (
          <div className="space-y-3">
            {followups.map((followup) => (
              <div
                key={followup.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex gap-4">
                  {/* Status Indicator */}
                  <div className="flex-shrink-0">
                    {followup.is_overdue ? (
                      <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5" />
                    ) : followup.is_today ? (
                      <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{followup.prospect_name}</h3>
                    <p className="text-sm text-gray-600">{followup.business_name}</p>
                    
                    {/* Last Activity */}
                    {followup.last_activity_at && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last contact: {new Date(followup.last_activity_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Contact Info & Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {followup.phone && (
                      <a
                        href={`tel:${followup.phone}`}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                        title="Call"
                      >
                        <Phone className="w-4 h-4 text-gray-600" />
                      </a>
                    )}
                    {followup.email && (
                      <a
                        href={`mailto:${followup.email}`}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                        title="Email"
                      >
                        <Mail className="w-4 h-4 text-gray-600" />
                      </a>
                    )}
                    <a
                      href={`/app/prospects/${followup.id}`}
                      className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                    >
                      View
                    </a>
                  </div>
                </div>

                {/* Stage & Date Info */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>{followup.sales_stage}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {followup.follow_up_date
                        ? new Date(followup.follow_up_date).toLocaleDateString()
                        : 'No date set'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { Zap } from 'lucide-react';
