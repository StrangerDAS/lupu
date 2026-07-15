import axios from 'axios'
import useAuthStore from '../store/authStore'

// Base axios instance (only used for the legacy mock REST API, not Firestore)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
