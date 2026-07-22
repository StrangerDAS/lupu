import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  isFounder     as _isFounder,
  isSuperAdmin  as _isSuperAdmin,
  isAdmin       as _isAdmin,
  hasRole       as _hasRole,
  hasPermission as _hasPermission,
} from '../lib/roleUtils'

const STORAGE_KEY = 'lupu-auth'

/**
 * useAuthStore — Zustand auth store with Express/JWT-driven RBAC.
 *
 * ── Authentication flow ────────────────────────────────────────────────────────
 *
 * 1. User enters OTP → backend validates → issues JWT.
 * 2. JWT + user object stored in Zustand (persisted to localStorage).
 * 3. On page reload, `authReady` is already true (persisted), so no loader flash.
 * 4. App.jsx calls `/api/auth/me` to re-validate the token with the backend.
 * 5. If token is invalid/expired, the Axios 401 interceptor calls logout().
 *
 * `authReady` is persisted. On a hard reload with a cached session, the route
 * guards can trust the cache immediately while the background `/api/auth/me`
 * call confirms validity. On first visit (no cache), authReady=false shows a
 * loader until verification completes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── Persisted state ─────────────────────────────────────────────────
      user:          null,   // User object from Express API
      firebaseUser:  null,   // Firebase user object
      authReady:     false,  // Has auth been resolved at least once?
      permissions:   [],     // Explicit permission strings
      accountStatus: null,   // 'active' | 'suspended' | 'banned'

      // ── Setters ─────────────────────────────────────────────────────────

      /**
       * setAuth — called exclusively by App.jsx's session verification.
       * This is the ONLY way user + token enter the store.
       */
      setAuth: (user, firebaseUser) => {
        if (import.meta.env.DEV) {
          const msg = user
            ? `[AuthStore] ✅ setAuth → uid=${user._id} | role=${user.role}`
            : '[AuthStore] 🔴 setAuth → cleared (signed out)'
          console.log(msg)
        }

        set({
          user,
          firebaseUser,
          authReady:     true,
          permissions:   user?.permissions   ?? [],
          accountStatus: user?.status        ?? null,
        })
      },

      /** Explicitly mark auth as resolved (used in edge-cases) */
      setAuthReady: () => {
        set({ authReady: true })
      },

      /** Patch individual user fields (e.g. after KYC step completes) */
      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      // ── Logout ──────────────────────────────────────────────────────────

      /**
       * logout(navigate?)
       *  1. Clear Zustand state eagerly (UI updates immediately)
       *  2. Wipe localStorage key (prevent restore on next load)
       *  3. Navigate to /auth/login (if navigate is provided)
       *
       * The Axios 401 interceptor calls logout() without navigate,
       * then uses window.location.replace('/auth/login') separately.
       */
      logout: async (navigate) => {
        if (import.meta.env.DEV) {
          console.log('[AuthStore] 🔐 logout() called — terminating session…')
        }

        set({
          user:          null,
          firebaseUser:  null,
          permissions:   [],
          accountStatus: null,
          // Keep authReady = true — auth has resolved, answer is "no user"
        })

        localStorage.removeItem(STORAGE_KEY)

        if (navigate) {
          navigate('/auth/login', { replace: true })
        }
      },

      // ── Role predicates ─────────────────────────────────────────────────
      // All delegate to roleUtils — no role logic lives here directly.

      isAuthenticated: () => {
        const { user } = get()
        return !!user
      },

      isFounder:    () => _isFounder(get().user),
      isSuperAdmin: () => _isSuperAdmin(get().user),
      isAdmin:      () => _isAdmin(get().user),
      hasRole:      (roles) => _hasRole(get().user, roles),
      hasPermission: (permission) => _hasPermission(get().user, permission),

      isKycComplete: () => {
        const { user } = get()
        if (!user) return false
        if (_isAdmin(user)) return true
        return user.kycStatus === 'verified' || !!user.emailVerified
      },

      // isOwner: admins can act as owners in the system
      isOwner: () => !!get().user?.isOwner || _isAdmin(get().user),
      isRider: () => !!get().user?.isRider,
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        user:          state.user,
        firebaseUser:  state.firebaseUser,
        authReady:     state.authReady,
        permissions:   state.permissions,
        accountStatus: state.accountStatus,
      }),
    }
  )
)

export default useAuthStore
