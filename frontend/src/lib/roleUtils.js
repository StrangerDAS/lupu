/**
 * roleUtils.js — Centralised RBAC definitions for LUPU.
 *
 * Single source of truth for every role, its hierarchy weight,
 * and which admin navigation modules it may access.
 *
 * NEVER duplicate this logic in components — always import from here.
 */

// ── Role hierarchy ────────────────────────────────────────────────────────────
// Higher weight = more privilege.  Used for "at-least" checks.
export const ROLE_WEIGHT = {
  founder:     100,
  super_admin:  80,
  admin:        60,
  user:         10,
}

// All roles that grant access to any /admin/* route
export const ADMIN_ROLES = ['founder', 'super_admin', 'admin']

// ── Role predicate helpers ────────────────────────────────────────────────────

/** Returns true if the user is a founder */
export const isFounder     = (user) => user?.role === 'founder'

/** Returns true if the user is a super_admin or above */
export const isSuperAdmin  = (user) => ['founder', 'super_admin'].includes(user?.role)

/** Returns true if the user holds any administrative role */
export const isAdmin       = (user) => ADMIN_ROLES.includes(user?.role)

/** Returns true if user's role is in the supplied list */
export const hasRole       = (user, roles = []) => roles.includes(user?.role)

/**
 * Returns true if the user's role weight is at least `minRole`.
 * e.g. atLeast(user, 'admin') → true for admin, super_admin, founder
 */
export const atLeast = (user, minRole) =>
  (ROLE_WEIGHT[user?.role] ?? 0) >= (ROLE_WEIGHT[minRole] ?? 0)

/**
 * hasPermission — extensible permission gate.
 * Currently backed by role weight but can be expanded to
 * per-user `permissions[]` array stored in MongoDB.
 */
export const hasPermission = (user, permission) => {
  if (!user) return false

  // Founder has every permission
  if (user.role === 'founder') return true

  const permissionMap = {
    // super_admin permissions
    manage_admins:       isSuperAdmin(user),
    view_revenue:        isSuperAdmin(user),
    change_commission:   isFounder(user), // founder only
    platform_settings:  isFounder(user), // founder only

    // admin permissions
    approve_vehicles:    isAdmin(user),
    reject_vehicles:     isAdmin(user),
    manage_disputes:     isAdmin(user),
    manage_tickets:      isAdmin(user),
    view_users:          isAdmin(user),
    view_bookings:       isAdmin(user),
    view_payments:       isAdmin(user),
    review_moderation:   isAdmin(user),
    view_audit_logs:     isAdmin(user),
  }

  return !!permissionMap[permission]
}

// ── Admin sidebar modules per role ────────────────────────────────────────────
// Each entry maps to a subview ID used in AdminPanel's router.
export const ADMIN_NAV_MODULES = [
  { id: 'dashboard',     label: 'Dashboard',          roles: ADMIN_ROLES },
  { id: 'founder',       label: 'Founder Dashboard',   roles: ['founder'] },
  { id: 'users',         label: 'User Base',           roles: ADMIN_ROLES },
  { id: 'vehicles',      label: 'Verifications',       roles: ADMIN_ROLES },
  { id: 'bookings',      label: 'Booking Logs',        roles: ADMIN_ROLES },
  { id: 'payments',      label: 'Revenue',            roles: ADMIN_ROLES },
  { id: 'safety',        label: 'Trust & Safety',      roles: ADMIN_ROLES },
  { id: 'support',       label: 'Tickets',             roles: ADMIN_ROLES },
  { id: 'reviews',       label: 'Reviews',             roles: ADMIN_ROLES },
  { id: 'audit-logs',    label: 'Audit Logs',          roles: ADMIN_ROLES },
  { id: 'admins',        label: 'Admin Management',    roles: ['founder', 'super_admin'] },
  { id: 'commission',    label: 'Commission',          roles: ['founder'] },
  { id: 'settings',      label: 'Settings',            roles: ['founder'] },
  { id: 'notifications', label: 'System Alerts',       roles: ADMIN_ROLES },
]

/** Filter nav modules a given user can see */
export const getVisibleModules = (user) =>
  ADMIN_NAV_MODULES.filter((m) => hasRole(user, m.roles))

