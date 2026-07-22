import axios from 'axios'
import useAuthStore from '../store/authStore'

// Base axios instance configured to connect to the Express/MongoDB backend REST API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
})

import { auth } from '../config/firebase'

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    } catch (err) {
      console.error('Error fetching Firebase ID token:', err)
    }
  }
  return config
})

// Handle 401 — token expired or invalid → full Zustand logout
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      if (import.meta.env.DEV) {
        console.warn('[Axios] ⚠️ 401 received — forcing full logout (token expired)')
      }
      // Clear Zustand + localStorage
      useAuthStore.getState().logout()
      // Hard redirect — no React Router available in interceptor scope
      window.location.replace('/auth/login')
    }
    return Promise.reject(error)
  }
)

export default api
