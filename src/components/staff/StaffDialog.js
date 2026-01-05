'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader } from 'lucide-react';
import { z } from 'zod';

const staffSchema = z.object({
  email: z.string().email('Invalid email'),
  full_name: z.string().min(2, 'Name required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'FINANCE', 'SALES', 'AUDITOR', 'VIEWER']),
  department: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
});

export default function StaffDialog({ open, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'VIEWER',
    department: '',
    title: '',
    phone: '',
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    setMessage('');

    try {
      setLoading(true);

      // Validate
      const validation = staffSchema.safeParse(formData);
      if (!validation.success) {
        const fieldErrors = {};
        validation.error.errors.forEach(err => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }

      // Submit with session credentials (no manual token extraction)
      const response = await fetch('/api/staff', {
        method: 'POST',
        credentials: 'include',  // Automatically sends HTTP-only session cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validation.data),
      });

      if (!response.ok) {
        const data = await response.json();
        setMessage(data.error || 'Failed to create staff');
        return;
      }

      setMessage('Staff member created successfully!');
      setFormData({
        email: '',
        full_name: '',
        password: '',
        role: 'VIEWER',
        department: '',
        title: '',
        phone: '',
      });

      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 1000);
    } catch (error) {
      console.error('Error:', error);
      setMessage('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Dialog Container - Responsive and Scrollable */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-[calc(100%-2rem)] max-w-md max-h-[90vh] flex flex-col"
          >
            {/* Header - Sticky */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-900">Invite Staff Member</h2>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Scrollable Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="team@example.com"
                />
                {errors.email && (
                  <p className="text-red-600 text-sm mt-1">{errors.email}</p>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.full_name ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="John Doe"
                />
                {errors.full_name && (
                  <p className="text-red-600 text-sm mt-1">{errors.full_name}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? 'border-red-500' : 'border-slate-300'
                  }`}
                  placeholder="••••••••"
                />
                {errors.password && (
                  <p className="text-red-600 text-sm mt-1">{errors.password}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="VIEWER">Viewer (Read-only)</option>
                  <option value="FINANCE">Finance (Assets & Liabilities)</option>
                  <option value="SALES">Sales (Deals)</option>
                </select>
              </div>

              {/* Department (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Department (Optional)
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Finance, Sales, etc."
                />
              </div>

              {/* Title (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Job Title (Optional)
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Financial Manager"
                />
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Message */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg text-sm ${
                    message.includes('Error') || message.includes('Failed')
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                  }`}
                >
                  {message}
                </motion.div>
              )}
            </form>

            {/* Footer - Sticky */}
            <div className="flex gap-3 p-6 border-t border-slate-200 flex-shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-medium"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Invite'
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
