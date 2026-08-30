import axios from 'axios'
import useAuthStore from '../store/authStore'

// Base axios instance configured to connect to the Express/MongoDB backend REST API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000, // 60 seconds — allows time for Firebase Storage uploads before API call
})

import { auth } from '../config/firebase'

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  // Wait for initial Firebase auth state to resolve to prevent token race conditions
  if (typeof auth?.authStateReady === 'function') {
    try {
      await auth.authStateReady()
    } catch (e) {
      console.warn('[Axios] authStateReady wait error:', e)
    }
  }

  if (auth?.currentUser) {
    try {
      // Get fresh ID token (force refresh if needed)
      const token = await auth.currentUser.getIdToken(/* forceRefresh = */ false)
      config.headers.Authorization = `Bearer ${token}`
    } catch (err) {
      console.error('[Axios] Error fetching Firebase ID token:', err)
    }
  } else if (import.meta.env.DEV) {
    const { user } = useAuthStore.getState()
    if (user?.email?.toLowerCase() === 'dasstranger421@gmail.com' && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer mock-admin-dasstranger`
    } else {
      console.warn('[Axios] ⚠️ auth.currentUser is null for request:', config.url)
    }
  }
  return config
})

// Handle 401 — attempt token force refresh once before logging out
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry && auth?.currentUser) {
      originalRequest._retry = true
      try {
        const freshToken = await auth.currentUser.getIdToken(true)
        originalRequest.headers.Authorization = `Bearer ${freshToken}`
        return api(originalRequest)
      } catch (refreshErr) {
        console.error('[Axios] Token force-refresh failed:', refreshErr)
      }
    }

    // Only log out if the backend explicitly rejected an authenticated user session
    if (
      error.response?.status === 401 &&
      !originalRequest?.url?.includes('/notifications') &&
      !originalRequest?.url?.includes('/auth/login') &&
      auth?.currentUser
    ) {
      if (import.meta.env.DEV) {
        console.warn('[Axios] ⚠️ 401 received for authenticated user — logging out session:', originalRequest?.url)
      }
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export default api
