import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'
import { auth } from '../firebase/config'
import { signOut } from 'firebase/auth'

/**
 * useAuth — convenience wrapper around the auth store + API calls.
 *
 * Usage:
 *   const { user, login, logout, isAuthenticated } = useAuth()
 */
export function useAuth() {
  const { user, token, setAuth, logout: storeLogout, isAuthenticated, hasRole } = useAuthStore()
  const navigate = useNavigate()

  const login = useCallback(async (credentials) => {
    const res = await authAPI.login(credentials)
    const { user: u, token: t } = res.data
    setAuth(u, t)
    toast.success(`Welcome back, ${u.name}!`)
    return u
  }, [setAuth])

  const signup = useCallback(async (data) => {
    const res = await authAPI.signup(data)
    const { user: u, token: t } = res.data
    setAuth(u, t)
    toast.success('Account created! Welcome to LUPU 🏍️')
    return u
  }, [setAuth])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
      storeLogout()
      toast.success('Logged out')
      navigate('/')
    } catch (error) {
      toast.error('Error logging out')
    }
  }, [storeLogout, navigate])

  return { user, token, login, signup, logout, isAuthenticated, hasRole }
}
