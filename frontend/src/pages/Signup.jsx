import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMail, FiLoader, FiUser, FiLock, FiEye, FiEyeOff, FiCheck, FiCircle, FiX } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/endpoints'
import { auth, googleProvider } from '../config/firebase'
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from 'firebase/auth'

/* ─────────────────────────────────────────────────────────
   PASSWORD POLICY
   Matches Firebase's minimum (6 chars) + stricter LUPU rules.
   Client-side = UX only. Firebase is the authoritative gate.
──────────────────────────────────────────────────────────── */
const PASSWORD_RULES = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (p) => p.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'At least 1 uppercase letter (A–Z)',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lowercase',
    label: 'At least 1 lowercase letter (a–z)',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'number',
    label: 'At least 1 number (0–9)',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    label: 'At least 1 special symbol (e.g. ! @ # $ %)',
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
]

function isPasswordValid(password) {
  return PASSWORD_RULES.every((r) => r.test(password))
}

/* ─────────────────────────────────────────────────────────
   PASSWORD STRENGTH INDICATOR
──────────────────────────────────────────────────────────── */
function PasswordRequirements({ password, touched }) {
  if (!touched) return null

  return (
    <AnimatePresence>
      <motion.div
        key="pw-requirements"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className="mt-2.5 p-3.5 rounded-xl bg-surface-2 border border-white/8 space-y-1.5"
        role="status"
        aria-live="polite"
        aria-label="Password requirements"
      >
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">
          Password must contain:
        </p>
        {PASSWORD_RULES.map((rule) => {
          const satisfied = rule.test(password)
          return (
            <div
              key={rule.id}
              className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
                satisfied ? 'text-green-400' : 'text-white/40'
              }`}
            >
              {satisfied ? (
                <FiCheck
                  size={13}
                  className="shrink-0 text-green-400"
                  aria-hidden="true"
                />
              ) : (
                <FiCircle
                  size={13}
                  className="shrink-0 text-white/25"
                  aria-hidden="true"
                />
              )}
              <span>{rule.label}</span>
            </div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}

/* ─────────────────────────────────────────────────────────
   CONFIRM PASSWORD INDICATOR
──────────────────────────────────────────────────────────── */
function ConfirmPasswordStatus({ password, confirmPassword, confirmTouched }) {
  if (!confirmTouched || !confirmPassword) return null

  const matches = password === confirmPassword

  return (
    <div
      className={`flex items-center gap-1.5 text-xs mt-1.5 transition-colors duration-200 ${
        matches ? 'text-green-400' : 'text-red-400'
      }`}
      role="status"
      aria-live="polite"
    >
      {matches ? (
        <>
          <FiCheck size={12} aria-hidden="true" />
          <span>Passwords match</span>
        </>
      ) : (
        <>
          <FiX size={12} aria-hidden="true" />
          <span>Passwords do not match</span>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
──────────────────────────────────────────────────────────── */
export default function Signup() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Track whether user has started typing in each field
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)

  // Derived state — computed on every render, no extra effect needed
  const passwordValid = useMemo(() => isPasswordValid(password), [password])
  const passwordsMatch = password === confirmPassword
  const canSubmit = passwordValid && passwordsMatch && confirmPassword.length > 0

  const handleEmailSignup = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error("Please enter your name")
    if (!email.includes('@')) return toast.error("Please enter a valid email")

    // Client-side gate (Firebase remains authoritative)
    if (!passwordValid) {
      setPasswordTouched(true)
      return toast.error("Password does not meet all requirements")
    }
    if (!passwordsMatch) {
      setConfirmTouched(true)
      return toast.error("Passwords do not match")
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      console.log(`[Signup] Successfully created Firebase user with UID: ${userCredential.user.uid}`)
      
      // Send Verification Email
      // actionCodeSettings: passing a continueUrl improves deliverability
      // and reduces spam scoring vs. a bare verification link.
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/login`,
        handleCodeInApp: false,
      }
      console.log(`[Signup] Attempting to send verification email to: ${userCredential.user.email}`)
      await sendEmailVerification(userCredential.user, actionCodeSettings)
      console.log('[Signup] Verification email sent successfully!')
      
      toast.success("Verification email sent. Please verify your email before logging in.")

      navigate('/verify')
    } catch (error) {
      console.error('[Signup] Error during signup flow:', error)
      if (error.code === 'auth/email-already-in-use') {
        toast.error("An account with this email already exists. Please log in instead.", { duration: 5000 })
        navigate('/auth/login')
      } else {
        toast.error(error.message || "Failed to create account")
      }
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
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="text-white/40 mt-2">Join the Dibrugarh riding community</p>
      </div>

      <div className="card p-8 shadow-2xl">
        <form onSubmit={handleEmailSignup} className="space-y-5">

          {/* ── Full Name ───────────────────────────────────── */}
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
                autoComplete="name"
              />
            </div>
          </div>

          {/* ── Email ───────────────────────────────────────── */}
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
                autoComplete="email"
              />
            </div>
          </div>

          {/* ── Password ────────────────────────────────────── */}
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative flex items-center">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (!passwordTouched) setPasswordTouched(true)
                }}
                placeholder="••••••••"
                className="input-field pl-11 pr-11"
                autoComplete="new-password"
                aria-describedby="pw-requirements"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>

            {/* Live password requirements */}
            <PasswordRequirements
              password={password}
              touched={passwordTouched}
            />
          </div>

          {/* ── Confirm Password ────────────────────────────── */}
          <div>
            <label className="label" htmlFor="confirm-password">Confirm Password</label>
            <div className="relative flex items-center">
              <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (!confirmTouched) setConfirmTouched(true)
                }}
                placeholder="••••••••"
                className="input-field pl-11 pr-11"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand/50"
              >
                {showConfirmPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>

            {/* Confirm password match status */}
            <ConfirmPasswordStatus
              password={password}
              confirmPassword={confirmPassword}
              confirmTouched={confirmTouched}
            />
          </div>

          {/* ── Submit ──────────────────────────────────────── */}
          <motion.button
            type="submit"
            disabled={loading || !canSubmit}
            whileHover={canSubmit && !loading ? { scale: 1.01 } : {}}
            whileTap={canSubmit && !loading ? { scale: 0.98 } : {}}
            className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            title={
              !passwordValid
                ? 'Password does not meet all requirements'
                : !passwordsMatch
                ? 'Passwords do not match'
                : undefined
            }
          >
            {loading && <FiLoader className="animate-spin" />}
            {loading ? 'Creating account…' : 'Create Account'}
          </motion.button>

          {/* Helpful hint when button is disabled */}
          {!canSubmit && (passwordTouched || confirmTouched) && (
            <p className="text-center text-xs text-white/30 -mt-2">
              {!passwordValid
                ? 'Complete all password requirements above'
                : 'Confirm your password to continue'}
            </p>
          )}
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
    </div>
  )
}
