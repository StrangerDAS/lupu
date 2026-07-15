import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  isFounder     as _isFounder,
  isSuperAdmin  as _isSuperAdmin,
  isAdmin       as _isAdmin,
  hasRole       as _hasRole,
  hasPermission as _hasPermission,
} from '../lib/roleUtils'

const STORAGE_KEY = 'uniride-auth'

/**
 * useAuthStore — Zustand auth store with Express/JWT-driven RBAC.
 *
 * ── Design decisions ─────────────────────────────────────────────────────────
 *
 * authReady is now PERSISTED.
 *
 * Why: On a hard page reload, the browser restores token + user from
 * localStorage instantly (before Firebase resolves). If authReady stayed
 * false until Firebase called back, ProtectedRoute would show a full-screen
 * PageLoader for 1–3 seconds even though we already have a valid cached
 * session. By persisting authReady=true alongside the token, the route guard
 * can trust the cached session immediately and let Firebase silently confirm
 * it in the background.
 *
 * When a user logs out, authReady stays true (Firebase has resolved —
 * we know the answer: no user). It only becomes false on a fresh install
 * (no localStorage) or after an explicit localStorage clear.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      // ── Persisted state ─────────────────────────────────────────────────
      user:          null,   // User object from Express API
      token:         null,   // JWT token from Express backend
      authReady:     false,  // Has Firebase resolved auth at least once?
      permissions:   [],     // Explicit permission strings
      accountStatus: null,   // 'active' | 'suspended' | 'banned'

      // ── Setters ─────────────────────────────────────────────────────────

      /**
       * setAuth — called exclusively by App.jsx's onAuthStateChanged callback.
       * This is the ONLY way user + token enter the store.
       */
      setAuth: (user, token) => {
        const msg = user
          ? `[AuthStore] ✅ setAuth → uid=${user.uid} | role=${user.role} | status=${user.status}`
          : '[AuthStore] 🔴 setAuth → cleared (user signed out)'
        console.log(msg)

        set({
          user,
          token,
          authReady:     true, // Firebase has resolved — persist this
          permissions:   user?.permissions   ?? [],
          accountStatus: user?.status        ?? null,
        })
      },

      /** Explicitly mark Firebase as resolved (used in edge-cases) */
      setAuthReady: () => {
        console.log('[AuthStore] 🏁 setAuthReady called')
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
       *  1. Firebase signOut → server-side session terminated
       *  2. Clear Zustand state eagerly (UI updates immediately)
       *  3. Wipe localStorage key (prevent restore on next load)
       *  4. Navigate to /auth/login
       *
       * navigate is optional — pass it from components using React Router.
       * The Axios interceptor (401 handler) can call logout() without navigate,
       * and then use window.location.replace('/auth/login') separately.
       */
      logout: async (navigate) => {
        console.log('[AuthStore] 🔐 logout() called — terminating session…')

        // Clear Zustand eagerly so the UI responds immediately
        set({
          user:          null,
          token:         null,
          permissions:   [],
          accountStatus: null,
          // Keep authReady = true — Firebase resolved, answer is "no user"
        })

        // Wipe persisted localStorage (prevents restore on next page load)
        localStorage.removeItem(STORAGE_KEY)
        console.log('[AuthStore] 🗑️  localStorage cleared')

        // Redirect
        if (navigate) {
          navigate('/auth/login', { replace: true })
          console.log('[AuthStore] 🔀 Navigated to /auth/login')
        }
      },

      // ── Role predicates ─────────────────────────────────────────────────
      // All delegate to roleUtils — no role logic lives here directly.

      isAuthenticated: () => {
        const { token, user } = get()
        const result = !!(token && user)
        console.log('[AuthStore] 🔒 isAuthenticated() →', result, '| token:', !!token, '| user:', !!user)
        return result
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
        return user.kycStatus === 'Verified' || !!user.emailVerified || !!user.phoneVerified
      },

      // isOwner: admins can act as owners in the system
      isOwner: () => !!get().user?.isOwner || _isAdmin(get().user),
      isRider: () => !!get().user?.isRider,
    }),
    {
      name: STORAGE_KEY,
      // Persist ALL relevant auth fields including authReady
      partialize: (state) => ({
        user:          state.user,
        token:         state.token,
        authReady:     state.authReady,
        permissions:   state.permissions,
        accountStatus: state.accountStatus,
      }),
    }
  )
)

export default useAuthStore
