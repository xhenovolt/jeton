'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserX, UserCheck, MoreVertical, Mail, Building2, Briefcase } from 'lucide-react';
import { getRoleBadgeColor, getRoleDisplayName } from '@/lib/permissions';
import StaffActionMenu from './StaffActionMenu';

export default function StaffTable({ staff, onRefresh }) {
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Department
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member, index) => (
            <motion.tr
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {/* Name */}
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <p className="font-medium text-slate-900">{member.full_name}</p>
                  <p className="text-sm text-slate-500">
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </p>
                </div>
              </td>

              {/* Email */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4" />
                  {member.email}
                </div>
              </td>

              {/* Role */}
              <td className="px-6 py-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(member.role)}`}>
                  {getRoleDisplayName(member.role)}
                </span>
              </td>

              {/* Department */}
              <td className="px-6 py-4">
                {member.department ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="w-4 h-4" />
                    {member.department}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>

              {/* Status */}
              <td className="px-6 py-4">
                {member.status === 'active' ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <UserCheck className="w-4 h-4" />
                    <span className="text-sm font-medium">Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <UserX className="w-4 h-4" />
                    <span className="text-sm font-medium">Suspended</span>
                  </div>
                )}
              </td>

              {/* Actions */}
              <td className="px-6 py-4 text-right">
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors inline-block"
                  >
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>

                  {menuOpen === member.id && (
                    <StaffActionMenu
                      staff={member}
                      onClose={() => setMenuOpen(null)}
                      onRefresh={onRefresh}
                    />
                  )}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
