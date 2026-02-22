'use client';

import React from 'react';
import { Phone, Mail, Building2, Calendar, Users, Badge } from 'lucide-react';
import Link from 'next/link';

const statusColors = {
  'New': 'bg-blue-100 text-blue-800 border-blue-300',
  'Contacted': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Follow-Up Needed': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Interested': 'bg-green-100 text-green-800 border-green-300',
  'Negotiating': 'bg-purple-100 text-purple-800 border-purple-300',
  'Converted': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Not Interested': 'bg-gray-100 text-gray-800 border-gray-300',
  'Lost': 'bg-red-100 text-red-800 border-red-300',
};

const interestColors = {
  'Low': 'bg-red-50',
  'Medium': 'bg-yellow-50',
  'High': 'bg-green-50',
  'Very High': 'bg-emerald-50',
  'New': 'bg-blue-50',
};

export default function ProspectCard({ prospect, onSelect }) {
  const daysOverdue = prospect.next_follow_up_date
    ? Math.max(0, Math.floor((new Date() - new Date(prospect.next_follow_up_date)) / (1000 * 60 * 60 * 24)))
    : null;

  const isOverdue = daysOverdue > 0;

  return (
    <Link href={`/app/prospecting/${prospect.id}`}>
      <div
        className={`
          border rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer
          ${interestColors[prospect.interest_level] || 'bg-white'}
          ${isOverdue ? 'border-red-300 border-2' : 'border-gray-200'}
        `}
        onClick={() => onSelect?.(prospect)}
      >
        {/* Header: Name + Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 line-clamp-2">
              {prospect.prospect_name}
            </h3>
            {prospect.business_name && (
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                <Building2 size={14} />
                {prospect.business_name}
              </p>
            )}
          </div>
          <Badge className={`whitespace-nowrap border ${statusColors[prospect.sales_stage]}`}>
            {prospect.sales_stage}
          </Badge>
        </div>

        {/* Contact Info */}
        <div className="space-y-1 mb-3 text-sm">
          {prospect.phone && (
            <p className="text-gray-700 flex items-center gap-2">
              <Phone size={14} className="text-gray-500" />
              {prospect.phone}
            </p>
          )}
          {prospect.email && (
            <p className="text-gray-700 flex items-center gap-2 truncate">
              <Mail size={14} className="text-gray-500 flex-shrink-0" />
              <span className="truncate">{prospect.email}</span>
            </p>
          )}
        </div>

        {/* Activity & Follow-up Info */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="bg-white bg-opacity-50 rounded p-2">
            <div className="text-gray-500">Activities</div>
            <div className="text-lg font-semibold text-gray-900">
              {prospect.total_activities_count || 0}
            </div>
          </div>
          <div className="bg-white bg-opacity-50 rounded p-2">
            <div className="text-gray-500">Interest</div>
            <div className="text-lg font-semibold text-gray-900">
              {prospect.interest_level || 'New'}
            </div>
          </div>
        </div>

        {/* Next Follow-up */}
        {prospect.next_follow_up_date && (
          <div className={`
            rounded p-2 flex items-start gap-2
            ${isOverdue ? 'bg-red-100 border border-red-300' : 'bg-gray-100'}
          `}>
            <Calendar size={14} className={`flex-shrink-0 mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`} />
            <div className="text-xs flex-1">
              <div className={isOverdue ? 'text-red-900 font-semibold' : 'text-gray-600'}>
                {isOverdue ? `🔴 ${daysOverdue}d OVERDUE` : 'Follow-up:'}
              </div>
              <div className={isOverdue ? 'text-red-800 font-semibold' : 'text-gray-700'}>
                {new Date(prospect.next_follow_up_date).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* If converted */}
        {prospect.converted_deal_id && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-emerald-700 font-semibold">
              ✓ Converted to Deal
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
