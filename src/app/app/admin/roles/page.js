'use client';

import { useEffect, useState } from 'react';
import { Shield, Plus, X, Check, Trash2, ChevronRight, Lock } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({ flat: [], grouped: {} });
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePerms, setNewRolePerms] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetchWithAuth('/api/admin/roles'),
        fetchWithAuth('/api/admin/permissions'),
      ]);
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      if (rolesData.success) setRoles(rolesData.data);
      if (permsData.success) setPermissions({ flat: permsData.data, grouped: permsData.grouped });
    } catch (err) {
      console.error('Failed to fetch roles/permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role) => {
    setSelectedRole(role);
    setShowCreate(false);
    try {
      const res = await fetchWithAuth(`/api/admin/roles/${role.id}`);
      const data = await res.json();
      if (data.success) {
        setRolePermissions(data.data.permissions.map((p) => p.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await fetchWithAuth(`/api/admin/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission_ids: rolePermissions }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim().toLowerCase().replace(/\s+/g, '_'),
          description: newRoleDescription.trim() || undefined,
          permission_ids: newRolePerms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setNewRoleName('');
        setNewRoleDescription('');
        setNewRolePerms([]);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (roleId) => {
    if (!confirm('Delete this role? Users with this role will lose associated permissions.')) return;
    try {
      await fetchWithAuth(`/api/admin/roles/${roleId}`, { method: 'DELETE' });
      if (selectedRole?.id === roleId) setSelectedRole(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = (permId, list, setter) => {
    setter(list.includes(permId) ? list.filter((id) => id !== permId) : [...list, permId]);
  };

  const toggleModule = (modulePerms, list, setter) => {
    const ids = modulePerms.map((p) => p.id);
    const allSelected = ids.every((id) => list.includes(id));
    if (allSelected) {
      setter(list.filter((id) => !ids.includes(id)));
    } else {
      setter([...new Set([...list, ...ids])]);
    }
  };

  const PermissionGrid = ({ permList, setPerm, isSystem }) => (
    <div className="space-y-4">
      {Object.entries(permissions.grouped).map(([module, perms]) => {
        const moduleIds = perms.map((p) => p.id);
        const selectedCount = moduleIds.filter((id) => permList.includes(id)).length;
        const allSelected = selectedCount === moduleIds.length;

        return (
          <div key={module} className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <button
              onClick={() => !isSystem && toggleModule(perms, permList, setPerm)}
              disabled={isSystem}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white capitalize">{module}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-gray-400">
                  {selectedCount}/{moduleIds.length}
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  allSelected
                    ? 'border-transparent'
                    : selectedCount > 0
                      ? 'border-white/20 bg-white/[0.1]'
                      : 'border-white/10'
                }`}
                style={allSelected ? { background: 'var(--theme-primary, #3b82f6)' } : {}}
              >
                {allSelected && <Check size={10} className="text-white" />}
                {!allSelected && selectedCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-white/50" />}
              </div>
            </button>
            <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {perms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => !isSystem && togglePermission(p.id, permList, setPerm)}
                  disabled={isSystem}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-xs disabled:cursor-not-allowed ${
                    permList.includes(p.id) ? 'bg-white/[0.06] text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      permList.includes(p.id) ? 'border-transparent' : 'border-white/10'
                    }`}
                    style={permList.includes(p.id) ? { background: 'var(--theme-primary, #3b82f6)' } : {}}
                  >
                    {permList.includes(p.id) && <Check size={8} className="text-white" />}
                  </div>
                  <span className="truncate">{p.action.replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--theme-primary, #3b82f6)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles & Permissions</h1>
          <p className="text-sm text-gray-500 mt-1">{roles.length} roles configured</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedRole(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity"
          style={{ background: 'var(--theme-primary, #3b82f6)' }}
        >
          <Plus size={16} />
          New Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Role List */}
        <div className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => selectRole(role)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                selectedRole?.id === role.id
                  ? 'bg-white/[0.08] border-white/[0.12]'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: role.is_system
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #6366f1))',
                  }}
                >
                  {role.is_system ? <Lock size={14} className="text-white" /> : <Shield size={14} className="text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white capitalize truncate">{role.name.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-gray-500">{role.permission_count || 0} permissions &middot; {role.user_count || 0} users</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!role.is_system && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRole(role.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <ChevronRight size={14} className="text-gray-600" />
              </div>
            </button>
          ))}
        </div>

        {/* Permission Editor */}
        <div>
          {showCreate && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Create New Role</h2>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-white/[0.08] rounded-lg">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role Name</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. manager"
                    className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/[0.2] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/[0.2] text-sm"
                  />
                </div>
              </div>
              <PermissionGrid permList={newRolePerms} setPerm={setNewRolePerms} isSystem={false} />
              <button
                onClick={createRole}
                disabled={saving || !newRoleName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--theme-primary, #3b82f6)' }}
              >
                <Check size={14} />
                {saving ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          )}

          {selectedRole && !showCreate && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white capitalize">{selectedRole.name.replace(/_/g, ' ')}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedRole.description || 'No description'}</p>
                  {selectedRole.is_system && (
                    <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                      <Lock size={10} /> System role — permissions are read-only
                    </p>
                  )}
                </div>
                {!selectedRole.is_system && (
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--theme-primary, #3b82f6)' }}
                  >
                    <Check size={14} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
              <PermissionGrid
                permList={rolePermissions}
                setPerm={setRolePermissions}
                isSystem={selectedRole.is_system}
              />
            </div>
          )}

          {!selectedRole && !showCreate && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
              <Shield size={48} className="text-gray-700 mb-4" />
              <p className="text-gray-400 text-sm">Select a role to view and edit its permissions</p>
              <p className="text-gray-600 text-xs mt-1">Or create a new custom role</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
