import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

// Layouts
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'
import CustomerDashboard from './pages/CustomerDashboard'
import SimulatedInbox from './pages/SimulatedInbox'

// Route guards
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'

// Loading fallback
import PageLoader from './components/PageLoader'

import { auth, db } from './firebase/config'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import useAuthStore from './store/authStore'
import { ADMIN_ROLES } from './lib/roleUtils'

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

export default function App() {
  const { setAuth } = useAuthStore()
  const navigate    = useNavigate()

  /**
   * navigateRef — keeps navigate() current across re-renders.
   *
   * FIX for Bug #3: useEffect with [] captures `navigate` once at mount.
   * After the async Firestore call completes, the captured `navigate`
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
    console.log('%c[Auth] 🔄 Initializing Firebase Auth listener', 'color:#6ee7b7;font-weight:bold')

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {

      // ── SIGNED OUT ─────────────────────────────────────────────────────────
      if (!firebaseUser) {
        console.log('[Auth] 🔴 Auth State Changed → no user (signed out or not yet logged in)')
        setAuth(null, null)
        if (tokenRefreshRef.current) {
          clearInterval(tokenRefreshRef.current)
          tokenRefreshRef.current = null
        }
        return
      }

      // ── SIGNED IN ──────────────────────────────────────────────────────────
      console.log('[Auth] ✅ Auth State Changed → Firebase user detected', {
        uid:           firebaseUser.uid,
        email:         firebaseUser.email,
        emailVerified: firebaseUser.emailVerified,
        provider:      firebaseUser.providerData?.[0]?.providerId,
      })

      const userEmail    = firebaseUser.email    || ''
      const userName     = firebaseUser.displayName
                          || (userEmail ? userEmail.split('@')[0] : 'User')
      const userPhotoURL = firebaseUser.photoURL || null

      // ──────────────────────────────────────────────────────────────────────
      // STEP 1: Load Firestore profile
      //
      // FIX for Bug #1: Firestore errors no longer force-signOut the user.
      // We split read and write into separate try/catch blocks so that:
      //  - A write failure (updateDoc) does NOT abort the login flow.
      //  - A read failure falls back gracefully (role defaults to 'user').
      // ──────────────────────────────────────────────────────────────────────
      let firestoreData = null
      const userRef     = doc(db, 'users', firebaseUser.uid)

      // ── READ ──
      try {
        let userSnap = await getDoc(userRef)
        console.log('[Auth] 🔍 Firestore User Loaded →', {
          uid:    firebaseUser.uid,
          exists: userSnap.exists(),
        })

        if (!userSnap.exists()) {
          // Check if there is an existing user document with the same email
          let foundDoc = null
          if (userEmail) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', userEmail))
              const qSnap = await getDocs(q)
              if (!qSnap.empty) {
                foundDoc = qSnap.docs[0]
                console.log('[Auth] 💡 Found existing user profile by email query:', foundDoc.id, foundDoc.data())
              }
            } catch (queryErr) {
              console.warn('[Auth] ⚠️ Failed query by email:', queryErr.message)
            }
          }

          if (foundDoc) {
            // Document exists under a different ID or is missing uid field.
            // Let's migrate/set it under the correct auth UID path.
            const existingData = foundDoc.data()
            const mergedUserData = {
              ...existingData,
              uid: firebaseUser.uid,
              updatedAt: serverTimestamp(),
              emailVerified: firebaseUser.emailVerified,
              phoneVerified: !!firebaseUser.phoneNumber,
              phoneNumber: firebaseUser.phoneNumber || existingData.phoneNumber || '',
            }
            try {
              await setDoc(userRef, mergedUserData)
              console.log('[Auth] 📝 Firestore → profile migrated/copied to correct uid:', firebaseUser.uid)
              // If the old document has a different ID, delete it to keep db clean
              if (foundDoc.id !== firebaseUser.uid) {
                await deleteDoc(foundDoc.ref)
                console.log('[Auth] 🗑️ Old user document deleted:', foundDoc.id)
              }
            } catch (migrateErr) {
              console.error('[Auth] ❌ Failed to migrate profile by email:', migrateErr.message)
            }
            // Use the migrated data
            firestoreData = mergedUserData
          } else {
            // Brand-new user — create their document
            const newUserData = {
              uid:           firebaseUser.uid,
              displayName:   userName,
              email:         userEmail,
              photoURL:      userPhotoURL || '',
              role:          'user',
              roles:         ['user'],
              status:        'active',
              accountStatus: 'active',
              isOwner:       false,
              isRider:       true,
              favorites:     [],
              permissions:   [],
              createdAt:     serverTimestamp(),
              emailVerified: firebaseUser.emailVerified,
              phoneVerified: !!firebaseUser.phoneNumber,
              phoneNumber:   firebaseUser.phoneNumber || '',
              notificationPreferences: {
                booking: true,
                vehicle: true,
                payment: true,
                email: true
              }
            }
            try {
              await setDoc(userRef, newUserData)
              console.log('[Auth] 📝 Firestore → new user document created for', firebaseUser.uid)
            } catch (writeErr) {
              // setDoc failed — likely security rules. Still log in with defaults.
              console.error('[Auth] ⚠️ Firestore setDoc failed (continuing with defaults):', writeErr.code, writeErr.message)
            }
            firestoreData = newUserData
          }
        } else {
          firestoreData = userSnap.data()
          // Ensure it has the uid field populated
          if (!firestoreData.uid) {
            firestoreData.uid = firebaseUser.uid
          }
          console.log('[Auth] 👤 Firestore data loaded:', {
            uid:    firestoreData.uid,
            role:   firestoreData.role,
            status: firestoreData.status || firestoreData.accountStatus,
          })
        }
      } catch (readErr) {
        // getDoc failed — security rules or network. Log in with minimal Firebase data.
        console.error('[Auth] ⚠️ Firestore getDoc failed (continuing with Firebase defaults):', readErr.code, readErr.message)
        console.warn('[Auth] 🔐 Check your Firestore rules — users must be able to read their own document:')
        console.warn('  allow read, write: if request.auth.uid == resource.data.uid;')
        // Use minimal object so user still gets logged in
        firestoreData = {
          role:          'user',
          accountStatus: 'active',
          status:        'active',
          isOwner:       false,
          isRider:       true,
          permissions:   [],
          displayName:   userName,
          photoURL:      userPhotoURL || '',
        }
      }

      // ── WRITE (non-blocking — does NOT block login even on failure) ──
      try {
        // Only attempt if the document existed (i.e., was a read, not a create)
        if (firestoreData.uid) {
          await updateDoc(userRef, {
            emailVerified: firebaseUser.emailVerified,
            phoneVerified: !!firebaseUser.phoneNumber,
            phoneNumber:   firebaseUser.phoneNumber || '',
            lastSeenAt:    serverTimestamp(),
          })
          console.log('[Auth] 📡 Firestore lastSeenAt updated')
        }
      } catch (updateErr) {
        // updateDoc failure is non-fatal — user is still logged in
        console.warn('[Auth] ⚠️ Firestore updateDoc failed (non-fatal):', updateErr.code, updateErr.message)
      }

      // ──────────────────────────────────────────────────────────────────────
      // STEP 2: Extract role + account status from Firestore data
      // Priority: data.role → data.roles[0] → 'user'
      // ──────────────────────────────────────────────────────────────────────
      const role          = firestoreData.role
                            || firestoreData.roles?.[0]
                            || 'user'
      const accountStatus = firestoreData.accountStatus
                            || firestoreData.status
                            || 'active'
      const permissions   = firestoreData.permissions || []
      const isOwner       = !!firestoreData.isOwner

      console.log('[Auth] 🛡️  Role Loaded →', role)
      console.log('[Auth] 🔑 Permissions Loaded →', permissions.length ? permissions : '(none)')

      // ── STEP 3: Block suspended / banned accounts ──────────────────────
      if (accountStatus === 'suspended' || accountStatus === 'banned') {
        console.warn('[Auth] ⛔ Account is', accountStatus, '— signing out immediately')
        setAuth(null, null)
        await signOut(auth)
        return
      }

      // ──────────────────────────────────────────────────────────────────────
      // STEP 4: Get Firebase ID token
      // ──────────────────────────────────────────────────────────────────────
      let idToken = null
      try {
        idToken = await firebaseUser.getIdToken(false)
        console.log('[Auth] 🎟️  ID token obtained for', firebaseUser.uid)
      } catch (tokenErr) {
        console.error('[Auth] ❌ ID token fetch failed:', tokenErr)
        // Token failure is fatal — we cannot authenticate the API
        setAuth(null, null)
        return
      }

      // ──────────────────────────────────────────────────────────────────────
      // STEP 5: Token refresh loop (55 min cycle)
      //
      // FIX for Bug #2: Clear existing interval before creating a new one.
      // StrictMode mounts twice; without this we'd have two concurrent refresh
      // timers fighting each other.
      // ──────────────────────────────────────────────────────────────────────
      if (tokenRefreshRef.current) {
        clearInterval(tokenRefreshRef.current)
      }
      tokenRefreshRef.current = setInterval(async () => {
        try {
          await firebaseUser.getIdToken(true)
          console.log('[Auth] 🔄 ID token silently refreshed (55-min cycle)')
        } catch (err) {
          console.error('[Auth] ❌ Token refresh failed — logging out:', err)
          clearInterval(tokenRefreshRef.current)
          tokenRefreshRef.current = null
          await signOut(auth)
        }
      }, 55 * 60 * 1000)

      // ──────────────────────────────────────────────────────────────────────
      // STEP 6: Build normalized user object
      // ──────────────────────────────────────────────────────────────────────
      const userObj = {
        _id:           firebaseUser.uid,
        uid:           firebaseUser.uid,
        email:         userEmail,
        name:          userName,
        displayName:   firestoreData.displayName || userName,
        phone:         firebaseUser.phoneNumber  || '',
        photoURL:      firestoreData.photoURL    || userPhotoURL,

        // RBAC — always from Firestore, NEVER hardcoded
        role,
        permissions,
        accountStatus,
        status: accountStatus,
        isOwner,
        isRider: firestoreData.isRider !== false,

        emailVerified: firebaseUser.emailVerified,
        phoneVerified: !!firebaseUser.phoneNumber,
      }

      // ── DEBUGGING LOGS ──
      const firestoreUser = firestoreData
      console.log("Firestore Role:", firestoreUser.role)
      console.log("Auth User:", userObj)

      // ──────────────────────────────────────────────────────────────────────
      // STEP 7: Commit to Zustand store (this also persists to localStorage)
      // ──────────────────────────────────────────────────────────────────────
      setAuth(userObj, idToken)
      console.log('[Auth] 🚀 Zustand setAuth called → user committed to store:', {
        uid:           userObj.uid,
        role:          userObj.role,
        accountStatus: userObj.accountStatus,
        isAdminRole:   ADMIN_ROLES.includes(userObj.role),
      })

      // ──────────────────────────────────────────────────────────────────────
      // STEP 8: Post-login redirect
      //
      // FIX for Bug #3: Use navigateRef.current so the navigate fn is always
      // up-to-date even after re-renders, and we never call a stale closure.
      //
      // FIX for Bug #5: Use window.location.pathname (authoritative) to decide
      // whether to redirect, independent of React Router's render cycle.
      // ──────────────────────────────────────────────────────────────────────
      const currentPath = window.location.pathname
      const isOnAuthPage = currentPath === '/' || currentPath.startsWith('/auth')

      console.log('[Auth] 🗺️  Current path:', currentPath, '| isOnAuthPage:', isOnAuthPage)

      if (isOnAuthPage) {
        if (ADMIN_ROLES.includes(role)) {
          console.log('[Auth] 🔀 Redirect → /admin (admin/founder role detected)')
          navigateRef.current('/admin', { replace: true })
        } else if (userObj.email && !userObj.emailVerified) {
          console.log('[Auth] 🔀 Redirect → /verify (email not verified)')
          navigateRef.current('/verify', { replace: true })
        } else {
          console.log('[Auth] 🔀 Redirect → /hub (regular user)')
          navigateRef.current('/hub', { replace: true })
        }
      } else {
        console.log('[Auth] 🔀 No redirect needed — user is already on:', currentPath)
      }
    })

    return () => {
      console.log('[Auth] 🔌 Unsubscribing Firebase Auth listener')
      unsubscribe()
      // Clean up token refresh timer on unmount (handles StrictMode double-invoke)
      if (tokenRefreshRef.current) {
        clearInterval(tokenRefreshRef.current)
        tokenRefreshRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentionally run once — navigateRef gives access to latest navigate

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
                  <ProtectedRoute allowedRoles={['user', 'admin']}>
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
    </Suspense>
  )
}
