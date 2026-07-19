import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import PageLoader from './PageLoader'
import { ADMIN_ROLES } from '../lib/roleUtils'

/**
 * AdminRoute — gate for all /admin/* routes.
 *
 * Only roles in ADMIN_ROLES ['founder', 'super_admin', 'admin'] may enter.
 * Role value is sourced from the JWT-backed Zustand store, populated by
 * App.jsx's /api/auth/me call on every page load.
 *
 * authReady flow mirrors ProtectedRoute (see that file for explanation).
 */
export default function AdminRoute() {
  const { user, token, authReady } = useAuthStore()
  const location = useLocation()

  // Wait for first auth resolution
  if (!authReady) {
    return <PageLoader />
  }

  // Must be authenticated
  if (!token || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Suspended or banned account
  const status = user.accountStatus || user.status
  if (status === 'suspended' || status === 'banned') {
    return <Navigate to="/auth/login" replace />
  }

  // Admin role check
  if (!ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/hub" replace />
  }

  return <Outlet />
}
