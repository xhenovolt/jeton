'use client';

import React, { useState } from 'react';
import { 
  Calendar, 
  MessageSquare, 
  Phone, 
  Users, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Lock,
  ArrowRight
} from 'lucide-react';

const activityTypeIcons = {
  'INITIAL_CONTACT': <Phone size={16} className="text-blue-500" />,
  'CONVERSATION': <MessageSquare size={16} className="text-indigo-500" />,
  'MEETING': <Users size={16} className="text-purple-500" />,
  'FOLLOW_UP': <ArrowRight size={16} className="text-orange-500" />,
  'EMAIL': <MessageSquare size={16} className="text-gray-500" />,
  'DEMO': <Zap size={16} className="text-yellow-500" />,
  'PROPOSAL': <CheckCircle size={16} className="text-green-500" />,
  'NEGOTIATION': <AlertCircle size={16} className="text-purple-500" />,
  'OBJECTION_HANDLED': <CheckCircle size={16} className="text-green-600" />,
  'CONVERTED': <CheckCircle size={16} className="text-emerald-600" />,
  'LOST': <AlertCircle size={16} className="text-red-600" />,
  'NOTE': <MessageSquare size={16} className="text-gray-400" />,
};

const outcomeColors = {
  'positive': 'text-green-600 bg-green-50',
  'neutral': 'text-gray-600 bg-gray-50',
  'negative': 'text-red-600 bg-red-50',
  'pending': 'text-yellow-600 bg-yellow-50',
  'action_required': 'text-orange-600 bg-orange-50',
};

const moodEmojis = {
  'very_interested': '🤩 Very Interested',
  'interested': '😊 Interested',
  'neutral': '😐 Neutral',
  'lukewarm': '🫤 Lukewarm',
  'cold': '❄️ Cold',
};

export default function ActivityTimeline({ activities, isLoading, prospectName }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare size={48} className="text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-semibold">No activities recorded yet</p>
        <p className="text-gray-400 text-sm">Log your first interaction with {prospectName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="relative">
          {/* Timeline line */}
          {index < activities.length - 1 && (
            <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
          )}

          {/* Activity card */}
          <div className={`relative pl-16 pb-4 ${outcomeColors[activity.outcome] || 'bg-white'} p-4 rounded-lg border border-gray-200`}>
            {/* Icon bubble */}
            <div className="absolute left-0 top-4 w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
              {activityTypeIcons[activity.activity_type] || <MessageSquare size={16} />}
            </div>

            {/* Locked indicator */}
            {activity.is_locked && (
              <div className="absolute top-2 right-2">
                <Lock size={14} className="text-gray-400" title="Activity is locked" />
              </div>
            )}

            {/* Header: Type + Title + Date */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase">
                    {activity.activity_type.replace(/_/g, ' ')}
                  </span>
                  {activity.communication_method && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      {activity.communication_method}
                    </span>
                  )}
                </div>
                <h4 className="font-semibold text-gray-900">
                  {activity.title}
                </h4>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(activity.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Description */}
            {activity.description && (
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                {activity.description}
              </p>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
              {/* Product discussed */}
              {activity.product_discussed && (
                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-2">
                  <div className="text-blue-700 font-semibold">Product Discussed</div>
                  <div className="text-blue-600">{activity.product_discussed}</div>
                </div>
              )}

              {/* Mood & Confidence */}
              {activity.prospect_mood && (
                <div className="bg-purple-50 border border-purple-200 rounded p-2">
                  <div className="text-purple-700 font-semibold">Mood</div>
                  <div className="text-purple-600">{moodEmojis[activity.prospect_mood]}</div>
                </div>
              )}

              {activity.confidence_level && (
                <div className="bg-indigo-50 border border-indigo-200 rounded p-2">
                  <div className="text-indigo-700 font-semibold">Confidence</div>
                  <div className="text-indigo-600">{activity.confidence_level}/10</div>
                </div>
              )}

              {/* Objections */}
              {activity.objections_raised && (
                <div className="col-span-2 bg-red-50 border border-red-200 rounded p-2">
                  <div className="text-red-700 font-semibold">Objections Raised</div>
                  <div className="text-red-600">{activity.objections_raised}</div>
                </div>
              )}

              {/* Resolution */}
              {activity.resolution && (
                <div className="col-span-2 bg-green-50 border border-green-200 rounded p-2">
                  <div className="text-green-700 font-semibold">
                    {activity.objections_handled ? '✓ Resolution' : 'How Addressed'}
                  </div>
                  <div className="text-green-600">{activity.resolution}</div>
                </div>
              )}

              {/* Duration */}
              {activity.duration_minutes && (
                <div className="bg-gray-50 border border-gray-200 rounded p-2">
                  <div className="text-gray-700 font-semibold">Duration</div>
                  <div className="text-gray-600">{activity.duration_minutes} min</div>
                </div>
              )}

              {/* Outcome */}
              {activity.outcome && (
                <div className={`${outcomeColors[activity.outcome]}-light border rounded p-2`}>
                  <div className="font-semibold">Outcome</div>
                  <div className="capitalize">{activity.outcome}</div>
                </div>
              )}
            </div>

            {/* Next action */}
            {activity.next_action && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2">
                <div className="text-amber-700 font-semibold text-xs">Next Action</div>
                <div className="text-amber-600 text-sm">{activity.next_action}</div>
              </div>
            )}

            {/* Follow-up scheduling */}
            {activity.follow_up_date && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar size={14} className="text-blue-600" />
                  <span className="font-semibold text-blue-700">
                    Follow-up scheduled for {new Date(activity.follow_up_date).toLocaleDateString()}
                  </span>
                  {activity.follow_up_type && (
                    <span className="text-blue-600">({activity.follow_up_type})</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
