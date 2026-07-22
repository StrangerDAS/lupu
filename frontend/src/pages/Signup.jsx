import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLoader, FiUser, FiLock } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'
import { auth, googleProvider } from '../config/firebase'
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from 'firebase/auth'

export default function Signup() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleEmailSignup = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error("Please enter your name")
    if (!email.includes('@')) return toast.error("Please enter a valid email")
    if (password.length < 6) return toast.error("Password must be at least 6 characters")

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Send Verification Email
      await sendEmailVerification(userCredential.user)
      toast.success("Verification email sent. Please verify your email before logging in.")

      navigate('/verify')
    } catch (error) {
      toast.error(error.message || "Failed to create account")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setLoading(true)
    try {
      const userCredential = await signInWithPopup(auth, googleProvider)
      
      // Sync with MongoDB backend
      const { data } = await authAPI.login({ name: userCredential.user.displayName || 'LUPU User', role: 'user' })
      setAuth(data.user, userCredential.user)
      
      toast.success("Signed up successfully!")
      navigate(data.user.emailVerified ? '/profile' : '/verify')
    } catch (error) {
      toast.error(error.message || "Failed to sign up with Google")
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
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="text-white/40 mt-2">Join the Dibrugarh riding community</p>
      </div>

      <div className="card p-8 shadow-2xl">
        <form onSubmit={handleEmailSignup} className="space-y-5">
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

          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative flex items-center">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
            {loading ? 'Creating account…' : 'Sign Up'}
          </motion.button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-white/10"></div>
          <span className="px-4 text-xs text-white/30 font-medium uppercase tracking-wider">OR</span>
          <div className="flex-1 border-t border-white/10"></div>
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition font-medium disabled:opacity-50"
        >
          <FcGoogle size={20} />
          Continue with Google
        </button>

        <div className="mt-6 text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-brand hover:text-brand/80 font-medium">
            Log in
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
