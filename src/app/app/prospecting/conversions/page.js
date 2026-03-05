'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, TrendingUp, User, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

/**
 * Conversions Page
 * Prospects ready to move from prospect to client
 * Warm leads that should be converted and contracts created
 */
export default function ConversionsPage() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProspects = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/prospects/conversions');
        
        if (!response.ok) {
          throw new Error('Failed to fetch prospects ready for conversion');
        }
        
        const data = await response.json();
        setProspects(data.data || []);
      } catch (err) {
        console.error('Error fetching conversions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProspects();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading conversion opportunities...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Ready to Convert</h1>
          <p className="text-gray-600 mt-2">
            Warm leads ready to become clients. Convert and create contracts.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error loading prospects</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!error && prospects.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <TrendingUp className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No prospects ready to convert yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Move prospects to Negotiating/Interested stage to see them here
            </p>
          </div>
        )}

        {/* Prospects Grid */}
        {!error && prospects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prospects.map((prospect) => (
              <div
                key={prospect.id}
                className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition overflow-hidden"
              >
                {/* Card Header - Status */}
                <div className={`px-4 py-3 border-b ${
                  prospect.sales_stage === 'Negotiating' 
                    ? 'bg-orange-50 border-b-orange-200' 
                    : 'bg-blue-50 border-b-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-4 h-4 ${
                      prospect.sales_stage === 'Negotiating' 
                        ? 'text-orange-600' 
                        : 'text-blue-600'
                    }`} />
                    <span className={`text-sm font-semibold ${
                      prospect.sales_stage === 'Negotiating' 
                        ? 'text-orange-900' 
                        : 'text-blue-900'
                    }`}>
                      {prospect.sales_stage}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  {/* Name */}
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {prospect.prospect_name}
                  </h3>

                  {/* Company */}
                  {prospect.business_name && (
                    <p className="text-gray-600 text-sm mt-1">{prospect.business_name}</p>
                  )}

                  {/* Contact Info */}
                  <div className="mt-4 space-y-2">
                    {prospect.email && (
                      <a
                        href={`mailto:${prospect.email}`}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{prospect.email}</span>
                      </a>
                    )}
                    {prospect.phone && (
                      <a
                        href={`tel:${prospect.phone}`}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{prospect.phone}</span>
                      </a>
                    )}
                  </div>

                  {/* Activity Count */}
                  {prospect.total_activities > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600">
                        {prospect.total_activities} activity
                        {prospect.total_activities !== 1 ? 'ies' : ''}
                      </p>
                      {prospect.last_contact_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last contact: {new Date(prospect.last_contact_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer - Action */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex gap-2">
                  <Link
                    href={`/app/prospects/${prospect.id}`}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition text-center"
                  >
                    View
                  </Link>
                  <Link
                    href={`/app/prospects/${prospect.id}?action=convert`}
                    className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition text-center"
                  >
                    Convert
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
