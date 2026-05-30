import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import PageLoader from './PageLoader'

/**
 * ProtectedRoute — gate for any authenticated user.
 *
 * Props:
 *   requireOwner {boolean} — if true, user must have isOwner or an admin role.
 *
 * authReady flow:
 *   - First install (no localStorage): authReady=false → show PageLoader until
 *     Firebase resolves via onAuthStateChanged in App.jsx.
 *   - Returning user (localStorage has token+user): authReady=true instantly →
 *     no loader flash, direct access. Firebase still validates in background.
 *   - After logout: authReady=true, token=null → redirect to login immediately.
 */
export default function ProtectedRoute({ requireOwner = false }) {
  const { user, token, authReady, isAdmin } = useAuthStore()
  const location = useLocation()

  console.log('[ProtectedRoute] 🔍 Evaluating', location.pathname, {
    authReady,
    hasToken:  !!token,
    hasUser:   !!user,
    role:      user?.role,
  })

  // ── Wait for first Firebase resolution ───────────────────────────────────
  // Only happens on fresh install with no cached session
  if (!authReady) {
    console.log('[ProtectedRoute] ⏳ authReady=false — showing loader')
    return <PageLoader />
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!token || !user) {
    console.log(`[ProtectedRoute] ⛔ DENIED (not authenticated) → /auth/login | from: ${location.pathname}`)
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // ── Suspended / banned ────────────────────────────────────────────────────
  const status = user.accountStatus || user.status
  if (status === 'suspended' || status === 'banned') {
    console.warn(`[ProtectedRoute] ⛔ DENIED (account ${status}) → /auth/login`)
    return <Navigate to="/auth/login" replace />
  }

  // ── Email Verification Gate ───────────────────────────────────────────────
  if (user.email && !user.emailVerified && location.pathname !== '/verify') {
    console.warn(`[ProtectedRoute] ⛔ DENIED (email not verified) → /verify`)
    return <Navigate to="/verify" replace />
  }

  // ── Owner gate ────────────────────────────────────────────────────────────
  if (requireOwner && !user.isOwner && !isAdmin()) {
    console.warn(`[ProtectedRoute] ⛔ DENIED (requireOwner=true, not owner/admin) → /hub`)
    return <Navigate to="/hub" replace />
  }

  console.log(`[ProtectedRoute] ✅ GRANTED | role=${user.role} | path=${location.pathname}`)
  return <Outlet />
}
