import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

// Layouts
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'

// Route guards
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'

// Loading fallback
import PageLoader from './components/PageLoader'

import { authAPI } from './api/endpoints'
import useAuthStore from './store/authStore'
import { ADMIN_ROLES } from './lib/roleUtils'
import SOSButton from './components/SOSButton'

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
const Home              = lazy(() => import('./pages/Home'))
const Overview          = lazy(() => import('./pages/Overview'))
const Explore           = lazy(() => import('./pages/Explore'))
const UserHub           = lazy(() => import('./pages/UserHub'))
const OwnerSetup        = lazy(() => import('./pages/OwnerSetup'))
const HowItWorks        = lazy(() => import('./pages/HowItWorks'))
const Verify            = lazy(() => import('./pages/Verify'))
const VehicleDetail     = lazy(() => import('./pages/VehicleDetail'))
const BookingFlow       = lazy(() => import('./pages/BookingFlow'))
const OwnerDashboard    = lazy(() => import('./pages/OwnerDashboard'))
const AdminPanel        = lazy(() => import('./pages/AdminPanel'))
const Profile           = lazy(() => import('./pages/Profile'))
const Login             = lazy(() => import('./pages/Login'))
const Signup            = lazy(() => import('./pages/Signup'))
const NotFound          = lazy(() => import('./pages/NotFound'))
const About             = lazy(() => import('./pages/About'))
const Handover          = lazy(() => import('./pages/Handover'))
const LegalCenter       = lazy(() => import('./pages/LegalCenter'))
const PrivacyPolicy     = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfService    = lazy(() => import('./pages/TermsOfService'))
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'))
const SimulatedInbox    = lazy(() => import('./pages/SimulatedInbox'))
const PaymentSuccess    = lazy(() => import('./pages/PaymentSuccess'))

export default function App() {
  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  /**
   * navigateRef — keeps navigate() current across re-renders.
   *
   * FIX for Bug #3: useEffect with [] captures `navigate` once at mount.
   * After the async API call completes, the captured `navigate`
   * might be stale (React Router v6 returns a stable ref, but being
   * explicit via useRef removes any doubt and survives StrictMode double-mount).
   */
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])

  /**
   * tokenRefreshRef — tracks the setInterval id for the token refresh loop
   * so we can clear it on both normal unmount and StrictMode double-invoke.
   */
  const tokenRefreshRef = useRef(null)

  useEffect(() => {
    console.log('%c[Auth] 🔄 Initializing Auth verification', 'color:#6ee7b7;font-weight:bold')

    const verifySession = async () => {
      const { token, setAuth, logout } = useAuthStore.getState()
      
      if (!token) {
        console.log('[Auth] 🔴 No token found in store (signed out or not yet logged in)')
        setAuth(null, null)
        return
      }

      try {
        console.log('[Auth] 🔍 Verifying token with backend...')
        const response = await authAPI.me()
        const userObj = response.data

        // Normalize roles and permissions
        userObj.role = userObj.role || 'user'
        userObj.permissions = userObj.permissions || []
        userObj.accountStatus = userObj.accountStatus || userObj.status || 'active'
        userObj.status = userObj.accountStatus
        
        // Block suspended accounts
        if (userObj.accountStatus === 'suspended' || userObj.accountStatus === 'banned') {
          console.warn('[Auth] ⛔ Account is', userObj.accountStatus, '— signing out immediately')
          logout()
          return
        }

        console.log('[Auth] ✅ Session verified, user loaded:', { uid: userObj._id, role: userObj.role })
        setAuth(userObj, token)
        
        // Post-login redirect logic
        const currentPath = window.location.pathname
        const isOnAuthPage = currentPath === '/' || currentPath.startsWith('/auth')
        
        if (isOnAuthPage) {
          if (ADMIN_ROLES.includes(userObj.role)) {
            navigateRef.current('/admin', { replace: true })
          } else if (userObj.email && !userObj.emailVerified && !userObj.otpVerified) {
            navigateRef.current('/verify', { replace: true })
          } else {
            navigateRef.current('/hub', { replace: true })
          }
        }
      } catch (err) {
        console.error('[Auth] ❌ Session verification failed (token expired/invalid). Logging out.', err)
        logout()
      }
    }

    verifySession()
  }, []) // Intentionally run once

  return (
    <Suspense fallback={<PageLoader />}>
      <AnimatePresence mode="wait">
        <Routes>

          {/* ── Landing ──────────────────────────────────────────── */}
          <Route path="/" element={<Overview />} />

          {/* ── Public routes (Navbar + Footer) ──────────────────── */}
          <Route element={<MainLayout />}>
            <Route path="/home"         element={<Home />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/about"        element={<About />} />
            <Route path="/legal"        element={<LegalCenter />} />
            <Route path="/privacy"      element={<PrivacyPolicy />} />
            <Route path="/terms"        element={<TermsOfService />} />

            {/* ── Any authenticated user ──────────────────────────── */}
            <Route element={<ProtectedRoute />}>
              <Route path="/hub"                  element={<UserHub />} />
              <Route path="/customer-dashboard" element={
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/inbox" element={
                  <ProtectedRoute allowedRoles={['admin', 'founder', 'super_admin']}>
                    <SimulatedInbox />
                  </ProtectedRoute>
                } />
              <Route path="/verify"               element={<Verify />} />
              <Route path="/owner/setup"          element={<OwnerSetup />} />
              <Route path="/explore"              element={<Explore />} />
              <Route path="/vehicles/:id"         element={<VehicleDetail />} />
              <Route path="/404"                  element={<NotFound />} />
              <Route path="/profile"              element={<Profile />} />
              <Route path="/book/:id"             element={<BookingFlow />} />
              <Route path="/my-bookings"          element={<CustomerDashboard />} />
              <Route path="/handover/:bookingId"  element={<Handover />} />
              <Route path="/payment-success"      element={<PaymentSuccess />} />
            </Route>

            {/* ── Owner or any admin ──────────────────────────────── */}
            <Route element={<ProtectedRoute requireOwner />}>
              <Route path="/dashboard" element={<OwnerDashboard />} />
            </Route>

            {/* ── Admin / super_admin / founder only ──────────────── */}
            <Route element={<AdminRoute />}>
              <Route path="/admin"          element={<AdminPanel />} />
              <Route path="/admin/:subview" element={<AdminPanel />} />
            </Route>
          </Route>

          {/* ── Auth pages (redirect out if already logged in) ───── */}
          <Route element={<AuthLayout />}>
            <Route path="/auth/login"  element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </AnimatePresence>
      <SOSButton />
    </Suspense>
  )
}
