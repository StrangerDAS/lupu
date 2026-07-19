import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RiMotorbikeLine } from 'react-icons/ri'
import { FiArrowRight } from 'react-icons/fi'
import useAuthStore from '../store/authStore'

/**
 * OwnerSetup — Deprecated.
 *
 * This page previously wrote directly to Firestore (bypassing the Express API).
 * It has been replaced by the full vehicle listing flow in OwnerDashboard.
 *
 * All new vehicle listings should be created from /dashboard → "Add Vehicle".
 * This component now redirects there immediately.
 */
export default function OwnerSetup() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  useEffect(() => {
    // Auto-redirect after a short delay to show the message
    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true })
    }, 2500)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand/20">
          <RiMotorbikeLine className="text-brand text-3xl" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Listing moved!</h1>
        <p className="text-white/50 mb-6">
          Vehicle listings are now managed from your{' '}
          <span className="text-white/80 font-medium">Owner Dashboard</span>.
          Redirecting you there now…
        </p>
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="btn-primary flex items-center gap-2 mx-auto px-6 py-3"
        >
          Go to Dashboard <FiArrowRight />
        </button>
      </motion.div>
    </div>
  )
}
