import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import PageLoader from './PageLoader'

/**
 * ProtectedRoute — gate for any authenticated user.
 *
 * Props:
 *   requireOwner {boolean} — if true, user must have isOwner or an admin role.
 *   allowedRoles {string[]} — if provided, user.role must be in this list.
 *   children — if provided, renders children instead of <Outlet>
 *
 * authReady flow:
 *   - First visit (no localStorage): authReady=false → show PageLoader until
 *     App.jsx's /api/auth/me call resolves.
 *   - Returning user (localStorage has token+user): authReady=true instantly →
 *     no loader flash, direct access. Backend re-validates in background.
 *   - After logout: authReady=true, token=null → redirect to login immediately.
 */
export default function ProtectedRoute({ requireOwner = false, allowedRoles, children }) {
  const { user, token, authReady, isAdmin } = useAuthStore()
  const location = useLocation()

  // Wait for first auth resolution (only on fresh install with no cached session)
  if (!authReady) {
    return <PageLoader />
  }

  // Not authenticated
  if (!token || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Suspended or banned account
  const status = user.accountStatus || user.status
  if (status === 'suspended' || status === 'banned') {
    return <Navigate to="/auth/login" replace />
  }

  // Email verification gate
  if (user.email && !user.emailVerified && location.pathname !== '/verify') {
    return <Navigate to="/verify" replace />
  }

  // Role-based gate (e.g. allowedRoles={['user', 'admin']})
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/hub" replace />
  }

  // Owner gate
  if (requireOwner && !user.isOwner && !isAdmin()) {
    return <Navigate to="/hub" replace />
  }

  return children ?? <Outlet />
}
