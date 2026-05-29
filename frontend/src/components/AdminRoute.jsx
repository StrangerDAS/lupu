import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import PageLoader from './PageLoader'
import { ADMIN_ROLES } from '../lib/roleUtils'

/**
 * AdminRoute — gate for all /admin/* routes.
 *
 * Only roles in ADMIN_ROLES ['founder', 'super_admin', 'admin'] may enter.
 * Role value is always sourced from Firestore (populated in App.jsx), so
 * localStorage manipulation cannot bypass this gate — Firebase re-validates
 * on every page load.
 *
 * Same authReady logic as ProtectedRoute (see that file for explanation).
 */
export default function AdminRoute() {
  const { user, token, authReady } = useAuthStore()
  const location = useLocation()

  console.log('[AdminRoute] 🔍 Evaluating', location.pathname, {
    authReady,
    hasToken: !!token,
    hasUser:  !!user,
    role:     user?.role,
  })

  // ── Wait for first Firebase resolution ───────────────────────────────────
  if (!authReady) {
    console.log('[AdminRoute] ⏳ authReady=false — showing loader')
    return <PageLoader />
  }

  // ── Must be authenticated ─────────────────────────────────────────────────
  if (!token || !user) {
    console.log(`[AdminRoute] ⛔ DENIED (not authenticated) → /auth/login`)
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // ── Suspended / banned ────────────────────────────────────────────────────
  const status = user.accountStatus || user.status
  if (status === 'suspended' || status === 'banned') {
    console.warn(`[AdminRoute] ⛔ DENIED (account ${status}) → /auth/login`)
    return <Navigate to="/auth/login" replace />
  }

  // ── Admin role check ──────────────────────────────────────────────────────
  const hasAdminRole = ADMIN_ROLES.includes(user.role)
  if (!hasAdminRole) {
    console.warn(
      `[AdminRoute] ⛔ DENIED | role="${user.role}" not in ADMIN_ROLES [${ADMIN_ROLES.join(', ')}] → /hub`
    )
    return <Navigate to="/hub" replace />
  }

  // ── GRANTED ───────────────────────────────────────────────────────────────
  console.log(`[AdminRoute] ✅ GRANTED | role=${user.role} | uid=${user.uid} | path=${location.pathname}`)
  return <Outlet />
}
