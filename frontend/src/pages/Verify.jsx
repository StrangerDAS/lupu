import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiCheckCircle, FiLoader } from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'
import { auth } from '../config/firebase'
import { sendEmailVerification } from 'firebase/auth'

export default function Verify() {
  const navigate = useNavigate()
  const { user, setAuth } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  // Redirect if already verified
  useEffect(() => {
    if (user?.emailVerified) {
      navigate('/explore', { replace: true })
    }
  }, [user, navigate])

  const handleResendVerification = async () => {
    if (!auth.currentUser) return toast.error("You must be logged in to verify your email.")
    
    setLoading(true)
    try {
      await sendEmailVerification(auth.currentUser)
      toast.success("Verification email sent! Please check your inbox.")
    } catch (error) {
      toast.error(error.message || "Failed to send verification email.")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return
    
    setChecking(true)
    try {
      await auth.currentUser.reload() // Refresh Firebase user state
      if (auth.currentUser.emailVerified) {
        toast.success("Email verified successfully!")
        
        // The prompt asked to redirect to login if verified
        toast.success("Email verified successfully! Please log in.")
        // Optionally logout so they have to login again, but I'll just redirect to login
        navigate('/auth/login', { replace: true })
      } else {
        toast.error("Email not verified yet. Please check your inbox.")
      }
    } catch (error) {
      toast.error("Error checking verification status.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="card p-8 md:p-12 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand/30">
            <FiMail className="text-2xl text-brand" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verify your email</h1>
          <p className="text-white/60">
            We've sent a verification link to <strong className="text-white">{user?.email || auth.currentUser?.email}</strong>. 
            Please click the link in the email to verify your account.
          </p>
        </div>

        <div className="space-y-4 relative z-10">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheckVerification}
            disabled={checking}
            className="btn-primary w-full py-4 text-lg font-medium flex justify-center items-center gap-2"
          >
            {checking ? <FiLoader className="animate-spin" /> : <FiCheckCircle />}
            {checking ? 'Checking...' : "I've Verified My Email"}
          </motion.button>
          
          <button
            onClick={handleResendVerification}
            disabled={loading}
            className="w-full py-4 text-white/60 hover:text-white hover:bg-white/5 border border-white/10 rounded-xl transition font-medium"
          >
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
