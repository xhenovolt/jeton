'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone, MessageCircle, MapPin, Building2, Calendar, Activity } from 'lucide-react';
import Link from 'next/link';

/**
 * Prospect Detail Page
 * View individual prospect information, activities, and history
 */
export default function ProspectDetailPage() {
  const params = useParams();
  const prospectId = params.id;
  const [prospect, setProspect] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!prospectId) return;

    const fetchProspectData = async () => {
      try {
        setLoading(true);

        // Fetch prospect details
        const res = await fetch(`/api/prospects/${prospectId}`);
        if (!res.ok) {
          setError('Prospect not found');
          return;
        }

        const data = await res.json();
        setProspect(data.data.prospect);
        setActivities(data.data.activities || []);
      } catch (err) {
        console.error('Error fetching prospect:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProspectData();
  }, [prospectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-700 dark:text-gray-300">Loading prospect...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 pb-20 md:pb-0 flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Link
            href="/app/prospects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Prospects
          </Link>
        </div>
      </div>
    );
  }

  if (!prospect) return null;

  return (
    <div className="flex-1 pb-20 md:pb-0">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-16 md:top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 z-20"
      >
        <div className="max-w-4xl mx-auto">
          <Link
            href="/app/prospects"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <ArrowLeft size={18} />
            Back
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {prospect.prospect_name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{prospect.company_name}</p>
        </div>
      </motion.div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Info Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Contact Info */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Info</h2>
            <div className="space-y-3">
              {prospect.email && (
                <div className="flex items-center gap-3">
                  <Mail className="text-blue-600 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Email</p>
                    <a
                      href={`mailto:${prospect.email}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {prospect.email}
                    </a>
                  </div>
                </div>
              )}

              {prospect.phone_number && (
                <div className="flex items-center gap-3">
                  <Phone className="text-green-600 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Phone</p>
                    <a
                      href={`tel:${prospect.phone_number}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {prospect.phone_number}
                    </a>
                  </div>
                </div>
              )}

              {prospect.whatsapp_number && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="text-green-400 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">WhatsApp</p>
                    <p className="text-sm truncate">{prospect.whatsapp_number}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location & Company */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Details</h2>
            <div className="space-y-3">
              {prospect.company_name && (
                <div className="flex items-start gap-3">
                  <Building2 className="text-purple-600 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Company</p>
                    <p className="text-sm text-gray-900 dark:text-white">{prospect.company_name}</p>
                  </div>
                </div>
              )}

              {prospect.city || prospect.country ? (
                <div className="flex items-start gap-3">
                  <MapPin className="text-red-600 flex-shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Location</p>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {[prospect.city, prospect.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              ) : null}

              {prospect.status && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      prospect.status === 'active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {prospect.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Activity Timeline */}
        {activities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Activity size={20} />
              Activity Timeline
            </h2>

            <div className="space-y-4">
              {activities.map((activity, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border-l-2 border-blue-500 pl-4 py-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {activity.activity_type}
                      </p>
                      {activity.subject && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {activity.subject}
                        </p>
                      )}
                      {activity.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* No Activities */}
        {activities.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center"
          >
            <p className="text-gray-600 dark:text-gray-400">No activities recorded yet.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
