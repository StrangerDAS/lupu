import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLoader, FiArrowLeft } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { auth } from '../config/firebase'
import { sendPasswordResetEmail } from 'firebase/auth'

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) return toast.error("Please enter a valid email")

    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
      toast.success("Password reset email sent!")
    } catch (error) {
      toast.error(error.message || "Failed to send reset email")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="mb-6">
        <Link to="/auth/login" className="text-white/40 hover:text-white flex items-center gap-2 transition text-sm">
          <FiArrowLeft /> Back to Login
        </Link>
      </div>

      <div className="card p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
          <p className="text-white/40">
            {sent 
              ? "Check your inbox for a link to reset your password."
              : "Enter your email address and we'll send you a link to reset your password."}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative flex items-center">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-11"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-60 flex justify-center items-center gap-2"
            >
              {loading && <FiLoader className="animate-spin" />}
              {loading ? 'Sending…' : 'Send Reset Link'}
            </motion.button>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setSent(false)}
              className="w-full py-3.5 text-white/60 hover:text-white border border-white/10 rounded-xl transition font-medium"
            >
              Try another email
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
