'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, Users, ChevronRight, ChevronDown, Search, Shield, Crown, UserCircle, Briefcase } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';

/**
 * Organizational Hierarchy Dashboard
 * Interactive tree: Departments → Roles → Staff members
 */

export default function OrgHierarchyPage() {
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState({});
  const [expandedRoles, setExpandedRoles] = useState({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState('tree'); // tree | grid

  useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/departments').then(r => r.json()),
      fetchWithAuth('/api/staff').then(r => r.json()),
    ]).then(([deptData, staffData]) => {
      if (deptData.success) setDepartments(deptData.data || []);
      if (staffData.success) setStaff(staffData.data || []);
      // Auto-expand all
      const expanded = {};
      (deptData.data || []).forEach(d => { expanded[d.id] = true; });
      setExpandedDepts(expanded);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleDept = (id) => setExpandedDepts(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleRole = (key) => setExpandedRoles(prev => ({ ...prev, [key]: !prev[key] }));

  // Build hierarchy: Department → grouped roles → staff
  const buildHierarchy = () => {
    return departments
      .filter(d => d.is_active !== false)
      .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()))
      .map(dept => {
        const deptStaff = staff.filter(s =>
          s.department_id === dept.id || s.department === dept.name || s.dept_name === dept.name
        );
        // Group by role
        const roleGroups = {};
        deptStaff.forEach(s => {
          const roleName = s.role_name || s.role || 'Unassigned';
          if (!roleGroups[roleName]) roleGroups[roleName] = { name: roleName, hierarchy_level: s.hierarchy_level, members: [] };
          roleGroups[roleName].members.push(s);
        });
        // Sort roles by hierarchy level (lower = higher authority)
        const sortedRoles = Object.values(roleGroups).sort((a, b) => (a.hierarchy_level || 999) - (b.hierarchy_level || 999));
        return { ...dept, staffCount: deptStaff.length, roles: sortedRoles };
      });
  };

  const hierarchy = buildHierarchy();
  const totalActive = staff.filter(s => s.status === 'active').length;

  const HierarchyIcon = ({ level }) => {
    if (level <= 2) return <Crown className="w-3.5 h-3.5 text-yellow-500" />;
    if (level <= 4) return <Shield className="w-3.5 h-3.5 text-blue-500" />;
    return <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6" style={{ color: 'var(--theme-primary, #3b82f6)' }} />
            Organization Hierarchy
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {departments.length} departments · {staff.length} members · {totalActive} active
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search departments..." className="pl-8 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm w-56" />
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button onClick={() => setView('tree')} className={`px-3 py-2 text-xs font-medium ${view === 'tree' ? 'text-white' : 'text-muted-foreground hover:bg-muted'}`} style={view === 'tree' ? { background: 'var(--theme-primary, #3b82f6)' } : {}}>Tree</button>
            <button onClick={() => setView('grid')} className={`px-3 py-2 text-xs font-medium ${view === 'grid' ? 'text-white' : 'text-muted-foreground hover:bg-muted'}`} style={view === 'grid' ? { background: 'var(--theme-primary, #3b82f6)' } : {}}>Grid</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--theme-primary, #3b82f6)' }} /></div>
      ) : hierarchy.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No departments found.</div>
      ) : view === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hierarchy.map(dept => (
            <div key={dept.id} className="bg-card rounded-xl border p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: dept.color || 'var(--theme-primary, #3b82f6)' }}>
                  {dept.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{dept.name}</h3>
                  {dept.alias && <p className="text-xs text-muted-foreground">{dept.alias}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{dept.staffCount} members</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{dept.roles.length} roles</span>
              </div>
              <div className="space-y-1">
                {dept.roles.slice(0, 5).map((role, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-foreground">
                      <HierarchyIcon level={role.hierarchy_level || 99} />
                      {role.name}
                    </span>
                    <span className="text-muted-foreground">{role.members.length}</span>
                  </div>
                ))}
                {dept.roles.length > 5 && <p className="text-xs text-muted-foreground">+{dept.roles.length - 5} more roles</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Tree View */
        <div className="bg-card rounded-xl border divide-y divide-border">
          {hierarchy.map(dept => (
            <div key={dept.id}>
              {/* Department header */}
              <button
                onClick={() => toggleDept(dept.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition text-left"
              >
                {expandedDepts[dept.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: dept.color || 'var(--theme-primary, #3b82f6)' }}>
                  {dept.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-foreground">{dept.name}</span>
                  {dept.alias && <span className="text-xs text-muted-foreground ml-2">({dept.alias})</span>}
                </div>
                <span className="text-xs text-muted-foreground">{dept.staffCount} members · {dept.roles.length} roles</span>
              </button>

              {/* Expanded roles */}
              {expandedDepts[dept.id] && dept.roles.map((role, ri) => {
                const roleKey = `${dept.id}-${role.name}`;
                return (
                  <div key={ri}>
                    <button
                      onClick={() => toggleRole(roleKey)}
                      className="w-full flex items-center gap-3 pl-14 pr-4 py-2.5 hover:bg-muted/30 transition text-left"
                    >
                      {expandedRoles[roleKey] ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      <HierarchyIcon level={role.hierarchy_level || 99} />
                      <span className="text-sm font-medium text-foreground">{role.name}</span>
                      {role.hierarchy_level && <span className="text-xs text-muted-foreground">L{role.hierarchy_level}</span>}
                      <span className="text-xs text-muted-foreground ml-auto">{role.members.length}</span>
                    </button>

                    {expandedRoles[roleKey] && role.members.map(member => (
                      <div key={member.id} className="flex items-center gap-3 pl-24 pr-4 py-2 hover:bg-muted/20">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {member.name?.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-foreground">{member.name}</span>
                          {member.position && <span className="text-xs text-muted-foreground ml-2">{member.position}</span>}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                          member.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          member.status === 'inactive' ? 'bg-muted text-muted-foreground' :
                          'bg-blue-100 text-blue-700'
                        }`}>{member.status}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
