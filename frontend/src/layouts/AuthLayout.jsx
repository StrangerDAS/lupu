import { Navigate, Outlet, Link } from 'react-router-dom'
import { RiMotorbikeLine } from 'react-icons/ri'
import useAuthStore from '../store/authStore'
import PageLoader from '../components/PageLoader'
import { ADMIN_ROLES } from '../lib/roleUtils'

/**
 * AuthLayout — wraps /auth/login and /auth/signup.
 *
 * FIX for Bug #5 (Login Redirect Loop):
 * If the user is already authenticated (token + user exist in Zustand), they
 * are immediately bounced away from the auth pages without rendering the form.
 *
 * If authReady is still false (Firebase hasn't resolved yet), we show a loader
 * rather than flashing the login form for a split second to a logged-in user.
 *
 * Redirect destinations:
 *   admin / super_admin / founder → /admin
 *   regular user / owner          → /hub
 */
export default function AuthLayout() {
  const { user, token, authReady } = useAuthStore()

  // ── Still waiting for Firebase to resolve ───────────────────────────────
  if (!authReady) {
    console.log('[AuthLayout] ⏳ Waiting for auth resolution…')
    return <PageLoader />
  }

  // ── Already authenticated — bounce the user to the right place ──────────
  if (token && user) {
    const dest = ADMIN_ROLES.includes(user.role) ? '/admin' : '/hub'
    console.log(`[AuthLayout] ✅ Already authenticated (role=${user.role}) — redirecting to ${dest}`)
    return <Navigate to={dest} replace />
  }

  // ── Not authenticated — show the auth form ───────────────────────────────
  console.log('[AuthLayout] 🔓 No active session — rendering auth form')
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="flex items-center gap-2 mb-10">
        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/30">
          <RiMotorbikeLine className="text-white text-xl" />
        </div>
        <span className="text-2xl font-bold">
          lupu<span className="text-brand">.</span>
        </span>
      </Link>
      <Outlet />
    </div>
  )
}
