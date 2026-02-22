'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Phone, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import Link from 'next/link';

export default function DailyProspectingDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/prospects/dashboard/today?date=${selectedDate}`);
        if (!response.ok) throw new Error('Failed to fetch dashboard');

        const data = await response.json();
        setDashboardData(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [selectedDate]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        Error: {error}
      </div>
    );
  }

  if (!dashboardData) return null;

  const { summary, overdueFollowUps, todaysProspects, todaysFollowUps, todaysConversations } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Today's Prospecting</h1>
          <p className="text-gray-600 mt-1">Your daily command center for revenue hunting</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg outline-none"
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600 font-medium">New Prospects</div>
            <Zap size={18} className="text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.newProspectsToday}</div>
          <p className="text-xs text-gray-500 mt-1">Added today</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600 font-medium">Follow-ups Due</div>
            <Calendar size={18} className="text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.followUpsDueToday}</div>
          <p className="text-xs text-gray-500 mt-1">Today</p>
        </div>

        <div className={`border rounded-lg p-4 ${summary.overdueFollowUps > 0 ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-sm font-medium ${summary.overdueFollowUps > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              Overdue Follow-ups
            </div>
            <AlertCircle size={18} className={summary.overdueFollowUps > 0 ? 'text-red-500' : 'text-gray-500'} />
          </div>
          <div className={`text-3xl font-bold ${summary.overdueFollowUps > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {summary.overdueFollowUps}
          </div>
          <p className={`text-xs mt-1 ${summary.overdueFollowUps > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            🔴 Requires attention
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600 font-medium">Conversations</div>
            <Phone size={18} className="text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{summary.conversationsLoggedToday}</div>
          <p className="text-xs text-gray-500 mt-1">Logged today</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600 font-medium">Conversions</div>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {summary.conversionCountThisWeek}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {summary.conversionRateThisWeek}% rate (week)
          </p>
        </div>
      </div>

      {/* Overdue Follow-ups Alert */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
            <AlertCircle size={20} />
            🔴 {overdueFollowUps.length} Overdue Follow-ups
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {overdueFollowUps.map(fup => (
              <Link key={fup.prospect_id} href={`/app/prospecting/${fup.prospect_id}`}>
                <div className="bg-white border border-red-200 rounded p-3 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="font-semibold text-red-700">{fup.prospect_name}</div>
                  <div className="text-sm text-red-600">
                    {fup.days_overdue} days overdue
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Was due: {new Date(fup.next_follow_up_date).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today's Prospects */}
      {todaysProspects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Zap size={20} className="text-blue-500" />
            {todaysProspects.length} New Prospects Today
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {todaysProspects.map(prospect => (
              <Link key={prospect.id} href={`/app/prospecting/${prospect.id}`}>
                <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="font-semibold text-gray-900">{prospect.prospect_name}</div>
                  {prospect.business_name && (
                    <div className="text-sm text-gray-600 mt-1">{prospect.business_name}</div>
                  )}
                  {prospect.phone && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                      <Phone size={12} />
                      {prospect.phone}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-600 uppercase">
                      {prospect.sales_stage}
                    </span>
                    <span className="text-xs text-gray-500">
                      {prospect.total_activities_count || 0} activities
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today's Follow-ups */}
      {todaysFollowUps.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-green-500" />
            {todaysFollowUps.length} Follow-ups Due Today
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {todaysFollowUps.map(followUp => (
              <Link key={followUp.id} href={`/app/prospecting/${followUp.id}`}>
                <div className="border border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="font-semibold text-gray-900">{followUp.prospect_name}</div>
                  {followUp.last_activity_title && (
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      Last: {followUp.last_activity_title}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-green-200 flex justify-between items-center">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                      {followUp.sales_stage}
                    </span>
                    <span className="text-xs text-gray-600">
                      {followUp.activity_type && followUp.activity_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today's Conversations */}
      {todaysConversations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Phone size={20} className="text-indigo-500" />
            {todaysConversations.length} Conversations Logged
          </h2>
          <div className="space-y-3">
            {todaysConversations.map(conv => (
              <Link key={conv.activity_id} href={`/app/prospecting/${conv.prospect_id}`}>
                <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">{conv.prospect_name}</div>
                      <div className="text-sm text-gray-700 mt-1">{conv.title}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      conv.outcome === 'positive' ? 'bg-green-100 text-green-700' :
                      conv.outcome === 'negative' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {conv.outcome}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(conv.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!todaysProspects.length && !todaysFollowUps.length && !todaysConversations.length && (
        <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-semibold mb-2">Nothing scheduled for today</p>
          <p className="text-gray-500 mb-6">No new prospects, follow-ups, or conversations yet</p>
          <Link href="/app/prospecting">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg inline-flex items-center gap-2 transition-colors">
              → Go to Prospects
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
