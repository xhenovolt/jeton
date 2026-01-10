'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Mail,
  Phone,
  Building2,
  Shield,
  Trash2,
  UserX,
  UserCheck,
  Loader,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import StaffDialog from '@/components/staff/StaffDialog';
import StaffTable from '@/components/staff/StaffTable';

export default function StaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchStaff();
  }, [refreshKey]);

  async function fetchStaff() {
    try {
      setLoading(true);
      const response = await fetchWithAuth('/api/staff');

      if (!response.ok) throw new Error('Failed to fetch staff');

      const result = await response.json();
      if (result.success) {
        setStaff(result.data);
      } else {
        throw new Error(result.error || 'Failed to fetch staff');
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    setRefreshKey(prev => prev + 1);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
                <Users className="w-10 h-10 text-blue-600" />
                Staff Management
              </h1>
              <p className="text-slate-600 mt-2">
                Manage team members, roles, and permissions
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Invite Staff
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Staff', value: staff.length, icon: Users, color: 'bg-blue-100 text-blue-700' },
            { label: 'Finance Team', value: staff.filter(s => s.role === 'FINANCE').length, icon: Building2, color: 'bg-green-100 text-green-700' },
            { label: 'Sales Team', value: staff.filter(s => s.role === 'SALES').length, icon: Shield, color: 'bg-purple-100 text-purple-700' },
            { label: 'Active', value: staff.filter(s => s.status === 'active').length, icon: UserCheck, color: 'bg-emerald-100 text-emerald-700' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Table or Loading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-slate-600">Loading staff members...</p>
              </div>
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-600">No staff members yet</p>
              <p className="text-slate-500 text-sm mt-1">Invite your first team member to get started</p>
            </div>
          ) : (
            <StaffTable staff={staff} onRefresh={handleRefresh} />
          )}
        </motion.div>
      </div>

      {/* Dialog */}
      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
