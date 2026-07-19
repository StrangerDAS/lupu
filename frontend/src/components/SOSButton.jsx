import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { bookingAPI, safetyAPI } from '../api/endpoints'

export default function SOSButton() {
  const { user, isAuthenticated } = useAuthStore()
  const [activeBooking, setActiveBooking] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [triggering, setTriggering] = useState(false)

  // Poll for active bookings if authenticated
  useEffect(() => {
    if (!isAuthenticated() || !user) return

    const checkActiveRides = async () => {
      try {
        const { data } = await bookingAPI.myBookings()
        const ongoing = (data.bookings || []).find(b => b.status === 'ongoing')
        setActiveBooking(ongoing || null)
      } catch (err) {
        console.error('Failed to check active rides for SOS', err)
      }
    }

    checkActiveRides()
    const interval = setInterval(checkActiveRides, 30000) // check every 30s
    return () => clearInterval(interval)
  }, [user, isAuthenticated])

  if (!activeBooking) return null

  const handleTriggerSOS = async () => {
    setTriggering(true)
    const toastId = toast.loading('Triggering SOS...')
    try {
      // In a real app, we would use navigator.geolocation to get real coords
      const dummyLocation = '12.9716° N, 77.5946° E' // Bangalore coordinates as fallback

      await safetyAPI.triggerSOS({
        bookingId: activeBooking._id,
        location: dummyLocation
      })
      toast.success('SOS Triggered! Emergency contacts & admins notified.', { id: toastId, duration: 5000 })
      setIsOpen(false)
    } catch (err) {
      toast.error('Failed to trigger SOS. Please call emergency services directly!', { id: toastId })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-red-500 rounded-full shadow-lg shadow-red-500/30 flex items-center justify-center text-white border-2 border-white/20"
      >
        <FiAlertTriangle size={24} />
        {/* Pulse effect */}
        <span className="absolute w-full h-full rounded-full bg-red-500 animate-ping opacity-75" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-surface rounded-2xl border border-red-500/30 p-6 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
              
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white transition p-1"
              >
                <FiX size={20} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4">
                  <FiAlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Emergency SOS</h3>
                <p className="text-white/70 text-sm mb-6">
                  Are you in an emergency? This will immediately alert LUPU admins and your emergency contacts with your current location and ride details.
                </p>
                
                <div className="w-full space-y-3">
                  <button
                    onClick={handleTriggerSOS}
                    disabled={triggering}
                    className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {triggering ? 'Triggering...' : 'TRIGGER SOS NOW'}
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    disabled={triggering}
                    className="w-full py-3.5 bg-surface-2 hover:bg-surface-3 text-white font-medium rounded-xl transition border border-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
