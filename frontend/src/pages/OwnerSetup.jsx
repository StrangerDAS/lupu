import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { roleAPI } from '../api/endpoints'

/**
 * OwnerSetup — Activates the owner role if needed, then navigates to Dashboard to open Add Vehicle modal.
 */
export default function OwnerSetup() {
  const navigate = useNavigate()
  const { user, updateUser, isAdmin } = useAuthStore()

  useEffect(() => {
    let mounted = true

    const setupOwner = async () => {
      try {
        if (user && !user.isOwner && !isAdmin()) {
          const { data } = await roleAPI.activateOwner()
          if (mounted) {
            updateUser(data.user || data)
          }
        }
      } catch (err) {
        console.warn('[OwnerSetup] Could not auto-activate owner role:', err)
      } finally {
        if (mounted) {
          navigate('/dashboard?addVehicle=true', { replace: true })
        }
      }
    }

    setupOwner()

    return () => {
      mounted = false
    }
  }, [user, updateUser, isAdmin, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
    </div>
  )
}
