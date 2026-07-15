import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLoader, FiSmartphone, FiCheckCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  
  const [authMethod, setAuthMethod] = useState('email') // 'email' | 'phone'
  const [loading, setLoading] = useState(false)
  
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (authMethod === 'email' && !identifier.includes('@')) return toast.error("Please enter a valid email")
    if (authMethod === 'phone' && identifier.length !== 10) return toast.error("Please enter a valid 10-digit phone number")

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
        
        {/* Auth Method Toggle */}
        {!otpSent && (
          <div className="flex rounded-lg bg-white/5 p-1 mb-6">
            <button
              onClick={() => { setAuthMethod('email'); setIdentifier(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${authMethod === 'email' ? 'bg-brand text-white' : 'text-white/40 hover:text-white'}`}
            >
              Email
            </button>
            <button
              onClick={() => { setAuthMethod('phone'); setIdentifier(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${authMethod === 'phone' ? 'bg-brand text-white' : 'text-white/40 hover:text-white'}`}
            >
              Phone
            </button>
          </div>
        )}

        <div className="space-y-5">
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="label" htmlFor="identifier">
                  {authMethod === 'email' ? 'Email address' : 'Phone Number'}
                </label>
                <div className="relative flex items-center">
                  {authMethod === 'email' ? (
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  ) : (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/70 border-r border-white/10 pr-2 z-10 select-none">
                      <span role="img" aria-label="India">🇮🇳</span> <span className="font-semibold">+91</span>
                    </span>
                  )}
                  
                  <input
                    id="identifier"
                    type={authMethod === 'email' ? "email" : "tel"}
                    required
                    value={identifier}
                    onChange={(e) => {
                      if (authMethod === 'phone') {
                        const val = e.target.value.replace(/\D/g, '')
                        if (val.length <= 10) setIdentifier(val)
                      } else {
                        setIdentifier(e.target.value)
                      }
                    }}
                    placeholder={authMethod === 'email' ? "you@example.com" : "7002630628"}
                    className={`input-field ${authMethod === 'email' ? 'pl-11' : 'pl-[84px]'}`}
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
                Change {authMethod === 'email' ? 'Email' : 'Phone Number'}
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
