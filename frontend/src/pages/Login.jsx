import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLoader, FiCheckCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!identifier.includes('@')) return toast.error("Please enter a valid email")

    setLoading(true)
    try {
      // In dev, the OTP is returned in the response for convenience
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
      const { data } = await authAPI.login({ identifier, otp })
      // data.user, data.token
      setAuth(data.user, data.token)
      toast.success("Logged in successfully!")
      navigate('/hub')
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
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-white/40 mt-2">Sign in to your LUPU account</p>
      </div>

      <div className="card p-8 shadow-2xl">
        


        <div className="space-y-5">
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
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
                {loading ? 'Verifying…' : 'Verify & Login'}
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

        <p className="text-center text-white/40 text-sm mt-8">
          Don&apos;t have an account?{' '}
          <Link to="/auth/signup" className="text-brand hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
