/**
 * Permissions System
 * Enterprise-grade role-based access control for Jeton
 */

/**
 * Permission Matrix
 * Defines what each role can do across the system
 */
const PERMISSION_MATRIX = {
  FOUNDER: {
    // Full access to all resources
    assets: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock', 'export'],
    liabilities: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock', 'export'],
    deals: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock', 'export'],
    shares: ['create', 'read', 'update', 'delete', 'issue', 'transfer', 'revoke'],
    reports: ['read', 'create', 'export', 'schedule'],
    staff: ['create', 'read', 'update', 'suspend', 'reactivate', 'delete', 'assign_role'],
    audit_logs: ['read', 'export'],
    settings: ['read', 'update', 'manage_integrations'],
    permissions: ['read', 'update'],
  },
  ADMIN: {
    // Administrator with wide access (except financial and staff management)
    assets: ['create', 'read', 'update', 'restore', 'export'],
    liabilities: ['create', 'read', 'update', 'restore', 'export'],
    deals: ['create', 'read', 'update', 'restore', 'export'],
    shares: ['read'],
    reports: ['read', 'create', 'export', 'schedule'],
    staff: ['read', 'update', 'suspend', 'reactivate'],
    audit_logs: ['read', 'export'],
    settings: ['read'],
    permissions: ['read'],
  },
  FINANCE: {
    // Finance manager with access to financial records
    assets: ['create', 'read', 'update', 'export'],
    liabilities: ['create', 'read', 'update', 'export'],
    deals: ['read', 'export'],
    shares: ['read'],
    reports: ['read', 'create', 'export'],
    staff: [],
    audit_logs: ['read'],
    settings: [],
    permissions: [],
  },
  SALES: {
    // Sales manager with access to deals and contacts
    assets: ['read'],
    liabilities: [],
    deals: ['create', 'read', 'update', 'export'],
    shares: ['read'],
    reports: ['read'],
    staff: [],
    audit_logs: [],
    settings: [],
    permissions: [],
  },
  AUDITOR: {
    // Auditor with read-only access to sensitive data
    assets: ['read', 'export'],
    liabilities: ['read', 'export'],
    deals: ['read', 'export'],
    shares: ['read'],
    reports: ['read', 'export'],
    staff: ['read'],
    audit_logs: ['read', 'export'],
    settings: [],
    permissions: [],
  },
  VIEWER: {
    // View-only access
    assets: ['read'],
    liabilities: ['read'],
    deals: ['read'],
    shares: ['read'],
    reports: ['read'],
    staff: [],
    audit_logs: [],
    settings: [],
    permissions: [],
  },
};

/**
 * Role hierarchy - used for inheritance and validation
 */
const ROLE_HIERARCHY = {
  FOUNDER: 6,
  ADMIN: 5,
  FINANCE: 4,
  SALES: 3,
  AUDITOR: 2,
  VIEWER: 1,
};

/**
 * Check if user can perform an action on a resource
 * @param {Object} user - User object with id, role, status
 * @param {string} resource - Resource type (assets, liabilities, deals, reports, staff, etc.)
 * @param {string} action - Action type (create, read, update, delete, etc.)
 * @returns {boolean} True if user has permission
 */
export function canAccess(user, resource, action) {
  // Suspended users cannot access anything
  if (user.status === 'suspended') {
    return false;
  }

  // Check if user role exists in matrix
  const rolePermissions = PERMISSION_MATRIX[user.role];
  if (!rolePermissions) {
    return false;
  }

  // Check if resource exists in role permissions
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  // Check if action is allowed for this resource
  return resourcePermissions.includes(action);
}

/**
 * Check if a user can manage another user
 * Only higher-ranked roles can manage lower-ranked roles
 * @param {Object} manager - Manager user object
 * @param {Object} target - Target user object
 * @returns {boolean} True if manager can manage target
 */
export function canManageUser(manager, target) {
  if (manager.status === 'suspended') {
    return false;
  }

  const managerRank = ROLE_HIERARCHY[manager.role];
  const targetRank = ROLE_HIERARCHY[target.role];

  // Must have higher rank and be an admin-level role
  return managerRank > targetRank && managerRank >= 5;
}

/**
 * Check if user can access staff management
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER or ADMIN
 */
export function isStaffAdmin(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER' || user.role === 'ADMIN';
}

/**
 * Check if user can modify financial records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER, ADMIN, or FINANCE
 */
export function isFinanceUser(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'FINANCE'].includes(user.role);
}

/**
 * Check if user can manage deals
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER, ADMIN, or SALES
 */
export function isSalesUser(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'SALES'].includes(user.role);
}

/**
 * Check if user is an auditor
 * @param {Object} user - User object
 * @returns {boolean} True if user is AUDITOR or higher
 */
export function isAuditor(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'AUDITOR'].includes(user.role);
}

/**
 * Check if user can soft delete/restore records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER or ADMIN
 */
export function canSoftDelete(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN'].includes(user.role);
}

/**
 * Check if user can lock/unlock records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER
 */
export function canLock(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER';
}

/**
 * Check if user can export data
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER, ADMIN, or AUDITOR
 */
export function canExport(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return ['FOUNDER', 'ADMIN', 'AUDITOR'].includes(user.role);
}

/**
 * Get all available roles
 * @returns {string[]} Array of role names sorted by hierarchy
 */
export function getAllRoles() {
  return Object.keys(ROLE_HIERARCHY).sort((a, b) => ROLE_HIERARCHY[b] - ROLE_HIERARCHY[a]);
}

/**
 * Get permissions for a specific role
 * @param {string} role - Role name
 * @returns {Object} Permissions object
 */
export function getRolePermissions(role) {
  return PERMISSION_MATRIX[role] || null;
}

/**
 * Get role hierarchy level
 * @param {string} role - Role name
 * @returns {number} Hierarchy level (higher = more permissions)
 */
export function getRoleLevel(role) {
  return ROLE_HIERARCHY[role] || 0;
}

/**
 * Check if a role is higher than another
 * @param {string} role1 - First role
 * @param {string} role2 - Second role
 * @returns {boolean} True if role1 has higher privilege
 */
export function isRoleHigher(role1, role2) {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

/**
 * Check if record is locked and user cannot edit it
 * @param {Object} record - Record object with locked property
 * @param {Object} user - User object
 * @returns {boolean} True if record is locked and user is not FOUNDER
 */
export function isRecordLocked(record, user) {
  if (user.role === 'FOUNDER') {
    return false; // Founders can always edit
  }
  return record.locked === true;
}

/**
 * Get role badge color for UI
 * @param {string} role - Role name
 * @returns {string} Color class name
 */
export function getRoleBadgeColor(role) {
  const colors = {
    FOUNDER: 'bg-red-100 text-red-800',
    ADMIN: 'bg-purple-100 text-purple-800',
    FINANCE: 'bg-blue-100 text-blue-800',
    SALES: 'bg-green-100 text-green-800',
    AUDITOR: 'bg-yellow-100 text-yellow-800',
    VIEWER: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

/**
 * Get role display name
 * @param {string} role - Role name
 * @returns {string} Display name
 */
export function getRoleDisplayName(role) {
  const names = {
    FOUNDER: 'Founder',
    ADMIN: 'Administrator',
    FINANCE: 'Finance Manager',
    SALES: 'Sales Manager',
    AUDITOR: 'Auditor',
    VIEWER: 'Viewer',
  };
  return names[role] || role;
}

/**
 * Get role description for UI
 * @param {string} role - Role name
 * @returns {string} Role description
 */
export function getRoleDescription(role) {
  const descriptions = {
    FOUNDER: 'Full system access, manage all users and settings',
    ADMIN: 'Administrative access to all features except user roles',
    FINANCE: 'Manage financial records including assets and liabilities',
    SALES: 'Manage deals and sales opportunities',
    AUDITOR: 'Read-only access to all records for audit purposes',
    VIEWER: 'Read-only access to dashboards and reports',
  };
  return descriptions[role] || 'No description available';
}
