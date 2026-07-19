import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLoader, FiCheckCircle, FiUser } from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'

export default function Signup() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error("Please enter your name")
    if (!identifier.includes('@')) return toast.error("Please enter a valid email")

    setLoading(true)
    try {
      const res = await authAPI.sendOtp({ identifier })
      if (res.data._dev_otp) {
        console.log('DEV OTP:', res.data._dev_otp) // For easy testing
      }
      setOtpSent(true)
      toast.success("OTP sent successfully!")
    } catch (error) {
      toast.error(error.response?.data?.message || "Error sending OTP")
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) return toast.error("Please enter a 6-digit OTP")

    setLoading(true)
    try {
      const { data } = await authAPI.signup({ identifier, otp, name, role: 'user' })
      setAuth(data.user, data.token)
      toast.success("Account created successfully!")
      navigate('/verify')
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP")
    }
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="text-white/40 mt-2">Join the Dibrugarh riding community</p>
      </div>

      <div className="card p-8 shadow-2xl">
        


        <div className="space-y-5">
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="label" htmlFor="name">Full Name</label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="input-field pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="identifier">
                  Email address
                </label>
                <div className="relative flex items-center">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  
                  <input
                    id="identifier"
                    type="email"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
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
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="label" htmlFor="otp">Enter 6-digit OTP sent to {identifier}</label>
                <div className="relative">
                  <FiCheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="otp"
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="input-field pl-11 tracking-widest"
                    maxLength={6}
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
                {loading ? 'Verifying…' : 'Verify & Sign Up'}
              </motion.button>
              
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="w-full text-sm text-brand mt-2"
              >
                Change Email
              </button>
            </form>
          )}
        </div>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#1A1A1A] text-white/40">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => toast('Google Sign-in disabled for Phase 2.', { icon: 'ℹ️' })}
              disabled={loading}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-white/10 rounded-xl hover:bg-white/5 transition-colors disabled:opacity-60 font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>
        </div>

        <p className="text-center text-white/40 text-sm mt-8">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-brand hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
