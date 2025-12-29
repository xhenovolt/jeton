/**
 * Permissions System
 * Role-based access control for Jeton
 */

/**
 * Permission Matrix
 * Defines what each role can do
 */
const PERMISSION_MATRIX = {
  FOUNDER: {
    assets: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock'],
    liabilities: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock'],
    deals: ['create', 'read', 'update', 'delete', 'restore', 'lock', 'unlock'],
    reports: ['read'],
    staff: ['create', 'read', 'update', 'suspend', 'reactivate'],
  },
  FINANCE: {
    assets: ['create', 'read', 'update'],
    liabilities: ['create', 'read', 'update'],
    deals: ['read'],
    reports: ['read'],
    staff: [],
  },
  SALES: {
    assets: [],
    liabilities: [],
    deals: ['create', 'read', 'update'],
    reports: ['read'],
    staff: [],
  },
  VIEWER: {
    assets: ['read'],
    liabilities: ['read'],
    deals: ['read'],
    reports: ['read'],
    staff: [],
  },
};

/**
 * Check if user can perform an action on a resource
 * @param {Object} user - User object with id, role, status
 * @param {string} resource - Resource type (assets, liabilities, deals, reports, staff)
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
 * Check if user can access staff management
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER
 */
export function isStaffAdmin(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER';
}

/**
 * Check if user can modify financial records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER or FINANCE
 */
export function isFinanceUser(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER' || user.role === 'FINANCE';
}

/**
 * Check if user can manage deals
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER or SALES
 */
export function isSalesUser(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER' || user.role === 'SALES';
}

/**
 * Check if user can soft delete/restore records
 * @param {Object} user - User object
 * @returns {boolean} True if user is FOUNDER
 */
export function canSoftDelete(user) {
  if (user.status === 'suspended') {
    return false;
  }
  return user.role === 'FOUNDER';
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
 * Get all available roles
 * @returns {string[]} Array of role names
 */
export function getAllRoles() {
  return Object.keys(PERMISSION_MATRIX);
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
    FINANCE: 'bg-blue-100 text-blue-800',
    SALES: 'bg-green-100 text-green-800',
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
    FINANCE: 'Finance',
    SALES: 'Sales',
    VIEWER: 'Viewer',
  };
  return names[role] || role;
}
