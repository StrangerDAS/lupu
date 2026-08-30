import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * OwnerSetup — Redirects directly to the Dashboard and opens the Add Vehicle modal.
 */
export default function OwnerSetup() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/dashboard?addVehicle=true', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand"></div>
    </div>
  )
}
