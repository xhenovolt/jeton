'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Send, Phone, Mail, Building2, Calendar, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';
import ActivityTimeline from '@/components/prospecting/ActivityTimeline';

export default function ProspectDetailPage({ params }) {
  const { id } = params;

  const [prospect, setProspect] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [error, setError] = useState(null);

  const [activityForm, setActivityForm] = useState({
    activity_type: 'CONVERSATION',
    title: '',
    description: '',
    outcome: 'neutral',
    product_discussed: '',
    objections_raised: '',
    objections_handled: false,
    resolution: '',
    prospect_mood: '',
    confidence_level: '',
    next_action: '',
    follow_up_date: '',
    follow_up_type: 'call',
    communication_method: 'phone',
    duration_minutes: '',
  });

  const [isConvertingToDeal, setIsConvertingToDeal] = useState(false);
  const [conversionForm, setConversionForm] = useState({
    product_service: '',
    deal_title: '',
    value_estimate: '',
  });

  // Fetch prospect and activities
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [prospectRes, activitiesRes] = await Promise.all([
          fetch(`/api/prospects/${id}`),
          fetch(`/api/prospects/${id}/activities`),
        ]);

        if (!prospectRes.ok) throw new Error('Failed to fetch prospect');
        if (!activitiesRes.ok) throw new Error('Failed to fetch activities');

        const prospectData = await prospectRes.json();
        const activitiesData = await activitiesRes.json();

        setProspect(prospectData.data);
        setActivities(activitiesData.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleAddActivity = async (e) => {
    e.preventDefault();

    if (!activityForm.title.trim()) {
      alert('Activity title is required');
      return;
    }

    setIsAddingActivity(true);

    try {
      const payload = {
        ...activityForm,
        confidence_level: activityForm.confidence_level ? parseInt(activityForm.confidence_level) : null,
        duration_minutes: activityForm.duration_minutes ? parseInt(activityForm.duration_minutes) : null,
      };

      const response = await fetch(`/api/prospects/${id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to add activity');

      const data = await response.json();
      setActivities(prev => [data.data, ...prev]);

      // Reset form
      setActivityForm({
        activity_type: 'CONVERSATION',
        title: '',
        description: '',
        outcome: 'neutral',
        product_discussed: '',
        objections_raised: '',
        objections_handled: false,
        resolution: '',
        prospect_mood: '',
        confidence_level: '',
        next_action: '',
        follow_up_date: '',
        follow_up_type: 'call',
        communication_method: 'phone',
        duration_minutes: '',
      });

      // Refresh prospect data
      const prospectRes = await fetch(`/api/prospects/${id}`);
      if (prospectRes.ok) {
        const prospectData = await prospectRes.json();
        setProspect(prospectData.data);
      }
    } catch (err) {
      alert('Error adding activity: ' + err.message);
    } finally {
      setIsAddingActivity(false);
    }
  };

  const handleConvertToDeal = async (e) => {
    e.preventDefault();

    if (!conversionForm.product_service.trim()) {
      alert('Product/service is required');
      return;
    }

    setIsConvertingToDeal(true);

    try {
      const response = await fetch(`/api/prospects/${id}/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': localStorage.getItem('userId') || '',
        },
        body: JSON.stringify(conversionForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to convert prospect');
      }

      const data = await response.json();

      // Refresh prospect
      const prospectRes = await fetch(`/api/prospects/${id}`);
      if (prospectRes.ok) {
        const prospectData = await prospectRes.json();
        setProspect(prospectData.data);
      }

      alert(`✓ Prospect converted to Deal #${data.dealId}`);
      setConversionForm({ product_service: '', deal_title: '', value_estimate: '' });
      setIsConvertingToDeal(false);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsConvertingToDeal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !prospect) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error || 'Prospect not found'}
      </div>
    );
  }

  const daysOverdue = prospect.next_follow_up_date
    ? Math.max(0, Math.floor((new Date() - new Date(prospect.next_follow_up_date)) / (1000 * 60 * 60 * 24)))
    : null;

  const isOverdue = daysOverdue > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/prospecting">
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{prospect.prospect_name}</h1>
          {prospect.business_name && (
            <p className="text-gray-600 flex items-center gap-2 mt-1">
              <Building2 size={16} />
              {prospect.business_name}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Contact Info Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-6">
              {prospect.phone && (
                <div>
                  <div className="text-sm text-gray-600 font-medium flex items-center gap-2 mb-1">
                    <Phone size={14} />
                    Phone
                  </div>
                  <a href={`tel:${prospect.phone}`} className="text-blue-600 hover:underline">
                    {prospect.phone}
                  </a>
                </div>
              )}
              {prospect.email && (
                <div>
                  <div className="text-sm text-gray-600 font-medium flex items-center gap-2 mb-1">
                    <Mail size={14} />
                    Email
                  </div>
                  <a href={`mailto:${prospect.email}`} className="text-blue-600 hover:underline">
                    {prospect.email}
                  </a>
                </div>
              )}
              {prospect.address && (
                <div className="col-span-2">
                  <div className="text-sm text-gray-600 font-medium mb-1">Address</div>
                  <p className="text-gray-900">{prospect.address}</p>
                </div>
              )}
              {prospect.industry && (
                <div>
                  <div className="text-sm text-gray-600 font-medium mb-1">Industry</div>
                  <p className="text-gray-900">{prospect.industry}</p>
                </div>
              )}
              {prospect.source && (
                <div>
                  <div className="text-sm text-gray-600 font-medium mb-1">Source</div>
                  <p className="text-gray-900 capitalize">{prospect.source}</p>
                </div>
              )}
            </div>
          </div>

          {/* Add Activity Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="font-semibold text-lg text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Log Interaction
            </h2>

            <form onSubmit={handleAddActivity} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Activity Type
                  </label>
                  <select
                    value={activityForm.activity_type}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, activity_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    <option value="CONVERSATION">Conversation</option>
                    <option value="MEETING">Meeting</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="EMAIL">Email</option>
                    <option value="DEMO">Demo</option>
                    <option value="PROPOSAL">Proposal</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="OBJECTION_HANDLED">Objection Handled</option>
                    <option value="NOTE">Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Communication
                  </label>
                  <select
                    value={activityForm.communication_method}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, communication_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="video">Video Call</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="What happened?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Details
                </label>
                <textarea
                  value={activityForm.description}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What was discussed? How did it go?"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Outcome
                  </label>
                  <select
                    value={activityForm.outcome}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, outcome: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                    <option value="pending">Pending</option>
                    <option value="action_required">Action Required</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Mood
                  </label>
                  <select
                    value={activityForm.prospect_mood}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, prospect_mood: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="very_interested">Very Interested 🤩</option>
                    <option value="interested">Interested 😊</option>
                    <option value="neutral">Neutral 😐</option>
                    <option value="lukewarm">Lukewarm 🫤</option>
                    <option value="cold">Cold ❄️</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Confidence (1-10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={activityForm.confidence_level}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, confidence_level: e.target.value }))}
                    placeholder="8"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Product/Service Discussed
                </label>
                <input
                  type="text"
                  value={activityForm.product_discussed}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, product_discussed: e.target.value }))}
                  placeholder="Which product or service?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              {activityForm.activity_type === 'OBJECTION_HANDLED' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Objections Raised
                    </label>
                    <input
                      type="text"
                      value={activityForm.objections_raised}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, objections_raised: e.target.value }))}
                      placeholder="What were the objections?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      How Were They Resolved?
                    </label>
                    <textarea
                      value={activityForm.resolution}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, resolution: e.target.value }))}
                      placeholder="How did you address these objections?"
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none resize-none"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={activityForm.objections_handled}
                      onChange={(e) => setActivityForm(prev => ({ ...prev, objections_handled: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm font-semibold text-gray-700">Objections fully addressed</span>
                  </label>
                </>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={activityForm.duration_minutes}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, duration_minutes: e.target.value }))}
                    placeholder="30"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Next Follow-up
                  </label>
                  <input
                    type="date"
                    value={activityForm.follow_up_date}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, follow_up_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Follow-up Type
                  </label>
                  <select
                    value={activityForm.follow_up_type}
                    onChange={(e) => setActivityForm(prev => ({ ...prev, follow_up_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none bg-white"
                  >
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="demo">Demo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Next Action
                </label>
                <input
                  type="text"
                  value={activityForm.next_action}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, next_action: e.target.value }))}
                  placeholder="What happens next?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingActivity}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400"
              >
                <Send size={18} />
                {isAddingActivity ? 'Logging...' : 'Log Activity'}
              </button>
            </form>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Interaction Timeline</h2>
            <ActivityTimeline activities={activities} prospectName={prospect.prospect_name} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-4">
          {/* Status Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Status</h3>
            <div className="space-y-2">
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Sales Stage</div>
                <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {prospect.sales_stage}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Interest Level</div>
                <div className="text-lg font-bold text-gray-900">{prospect.interest_level}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-600 mb-1">Days in Pipeline</div>
                <div className="text-lg font-bold text-gray-900">{prospect.days_in_pipeline}</div>
              </div>
            </div>
          </div>

          {/* Follow-up Card */}
          {prospect.next_follow_up_date && (
            <div className={`rounded-lg p-4 border ${isOverdue ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
              <h3 className={`font-semibold mb-2 flex items-center gap-2 ${isOverdue ? 'text-red-900' : 'text-gray-900'}`}>
                <Calendar size={18} />
                {isOverdue ? '🔴 OVERDUE' : 'Next Follow-up'}
              </h3>
              <div className={`text-lg font-bold ${isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                {new Date(prospect.next_follow_up_date).toLocaleDateString()}
              </div>
              {isOverdue && (
                <div className="text-sm text-red-600 mt-1 font-semibold">
                  {daysOverdue} days overdue
                </div>
              )}
            </div>
          )}

          {/* Activities Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Activity Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Activities</span>
                <span className="font-bold text-gray-900">{prospect.total_activities_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Contact</span>
                <span className="font-bold text-gray-900">
                  {prospect.last_contact_date 
                    ? new Date(prospect.last_contact_date).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Convert to Deal */}
          {!prospect.converted_deal_id && prospect.sales_stage !== 'Lost' && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                <Zap size={18} />
                Convert to Deal
              </h3>
              <form onSubmit={handleConvertToDeal} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-green-700 mb-1">
                    Product/Service <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={conversionForm.product_service}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, product_service: e.target.value }))}
                    placeholder="Product to sell"
                    className="w-full px-3 py-2 border border-green-300 rounded-lg outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-green-700 mb-1">
                    Deal Title (optional)
                  </label>
                  <input
                    type="text"
                    value={conversionForm.deal_title}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, deal_title: e.target.value }))}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 border border-green-300 rounded-lg outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-green-700 mb-1">
                    Estimated Value (optional)
                  </label>
                  <input
                    type="number"
                    value={conversionForm.value_estimate}
                    onChange={(e) => setConversionForm(prev => ({ ...prev, value_estimate: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-green-300 rounded-lg outline-none text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isConvertingToDeal}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors disabled:bg-gray-400"
                >
                  {isConvertingToDeal ? 'Converting...' : '→ Convert to Deal'}
                </button>
              </form>
            </div>
          )}

          {prospect.converted_deal_id && (
            <Link href={`/app/deals/${prospect.converted_deal_id}`}>
              <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-emerald-900 mb-2">✓ Converted to Deal</h3>
                <p className="text-sm text-emerald-700">View the associated deal ➜</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
