'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, UserX, UserCheck, Trash2, CheckCircle, AlertCircle } from 'lucide-react';

export default function StaffActionMenu({ staff, onClose, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleAction(action) {
    try {
      setLoading(true);
      setMessage('');

      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];

      if (!token) {
        setMessage('Not authenticated');
        return;
      }

      let response;

      if (action === 'suspend' || action === 'reactivate') {
        response = await fetch(`/api/staff/${staff.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ action }),
        });
      } else if (action === 'delete') {
        if (!confirm('Are you sure? This action cannot be undone.')) {
          return;
        }
        response = await fetch(`/api/staff/${staff.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      if (response?.ok) {
        setMessage(`✓ ${action === 'suspend' ? 'Suspended' : action === 'reactivate' ? 'Reactivated' : 'Deleted'} successfully`);
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 800);
      } else {
        const data = await response?.json();
        setMessage(data?.error || 'Action failed');
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 min-w-max z-10"
    >
      <div className="py-1">
        {/* Edit */}
        <button
          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          <Edit2 className="w-4 h-4" />
          Edit Details
        </button>

        {/* Suspend/Reactivate */}
        <button
          onClick={() => handleAction(staff.status === 'active' ? 'suspend' : 'reactivate')}
          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors disabled:opacity-50 ${
            staff.status === 'active'
              ? 'text-red-600 hover:bg-red-50'
              : 'text-green-600 hover:bg-green-50'
          }`}
          disabled={loading}
        >
          {staff.status === 'active' ? (
            <>
              <UserX className="w-4 h-4" />
              Suspend
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4" />
              Reactivate
            </>
          )}
        </button>

        {/* Delete */}
        <button
          onClick={() => handleAction('delete')}
          className="w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2 transition-colors disabled:opacity-50 border-t border-slate-200"
          disabled={loading}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>

      {/* Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`px-4 py-2 text-sm flex items-center gap-2 border-t border-slate-200 ${
            message.includes('successfully')
              ? 'text-green-700 bg-green-50'
              : 'text-red-700 bg-red-50'
          }`}
        >
          {message.includes('successfully') ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message}
        </motion.div>
      )}
    </motion.div>
  );
}
