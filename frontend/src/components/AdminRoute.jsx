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
  const { user, authReady } = useAuthStore()
  const location = useLocation()

  // Wait for first auth resolution
  if (!authReady) {
    return <PageLoader />
  }

  // Must be authenticated
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Admin role check — ONLY dasstranger421@gmail.com with admin role
  const isSoleAdmin = user.email?.toLowerCase() === 'dasstranger421@gmail.com' && ADMIN_ROLES.includes(user.role)
  if (isSoleAdmin) {
    return <Outlet />
  }

  // Suspended or banned account
  const status = user.accountStatus || user.status
  if (status === 'suspended' || status === 'banned') {
    useAuthStore.getState().logout()
    return <Navigate to="/auth/login" replace />
  }

  return <Navigate to="/hub" replace />
}
