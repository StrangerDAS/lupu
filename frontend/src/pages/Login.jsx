import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiMail, FiLoader, FiLock, FiSmartphone, FiCheckCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { auth, googleProvider } from '../firebase/config'
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  RecaptchaVerifier, 
  signInWithPhoneNumber 
} from 'firebase/auth'

export default function Login() {
  const navigate = useNavigate()
  
  const [authMethod, setAuthMethod] = useState('email') // 'email' | 'phone'
  const [loading, setLoading] = useState(false)
  
  // Email states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Phone states
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)

  useEffect(() => {
    // Setup recaptcha once when switching to phone auth
    if (authMethod === 'phone' && !window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': () => {
          // reCAPTCHA solved
        }
      });
    }

    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [authMethod])

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) return toast.error("Please enter a valid email")
    if (password.length < 6) return toast.error("Password must be at least 6 characters")

    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      toast.success("Successfully logged in!")
    } catch (error) {
      toast.error(error.message || "Error logging in")
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      toast.success("Successfully logged in with Google!")
    } catch (error) {
      toast.error(error.message || "Error with Google sign-in")
    }
    setLoading(false)
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!phoneNumber || phoneNumber.length !== 10) return toast.error("Please enter a valid 10-digit phone number")

    setLoading(true)
    try {
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) throw new Error("RecaptchaVerifier is not initialized. Please refresh the page.");
      
      // Ensure the invisible reCAPTCHA is fully rendered before requesting the OTP
      await appVerifier.render();

      const formattedPhone = `+91${phoneNumber}`;
      
      console.log("PROJECT", auth.app.options.projectId);
      console.log("VERIFIER", window.recaptchaVerifier);
      console.log("RECAPTCHA_CONTAINER", document.getElementById("recaptcha-container"));

      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      setConfirmationResult(confirmation)
      toast.success("OTP sent successfully!")
    } catch (error) {
      console.error("FULL OTP ERROR", error);
      toast.error(error.message || "Error sending OTP")
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.render().then(widgetId => {
          window.grecaptcha.reset(widgetId);
        });
      }
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) return toast.error("Please enter a 6-digit OTP")

    setLoading(true)
    try {
      await confirmationResult.confirm(otp)
      toast.success("Phone verified and logged in!")
    } catch (error) {
      toast.error("Invalid OTP")
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
        <div className="flex rounded-lg bg-white/5 p-1 mb-6">
          <button
            onClick={() => setAuthMethod('email')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${authMethod === 'email' ? 'bg-brand text-white' : 'text-white/40 hover:text-white'}`}
          >
            Email
          </button>
          <button
            onClick={() => { setAuthMethod('phone'); setConfirmationResult(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${authMethod === 'phone' ? 'bg-brand text-white' : 'text-white/40 hover:text-white'}`}
          >
            Phone
          </button>
        </div>

        {authMethod === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div>
              <label className="label" htmlFor="email">Email address</label>
              <div className="relative">
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
              <div className="relative">
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
              {loading ? 'Logging in…' : 'Log in'}
            </motion.button>
          </form>
        ) : (
          <div className="space-y-5">
            <div id="recaptcha-container"></div>
            
            {!confirmationResult ? (
              <form onSubmit={handleSendOtp} className="space-y-5">
                <div>
                  <label className="label" htmlFor="phone">Phone Number</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/70 border-r border-white/10 pr-2 z-10 select-none">
                      <span role="img" aria-label="India">🇮🇳</span> <span className="font-semibold">+91</span>
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        if (val.length <= 10) setPhoneNumber(val)
                      }}
                      placeholder="7002630628"
                      className="input-field pl-[84px]"
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
                  <label className="label" htmlFor="otp">Enter 6-digit OTP</label>
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
                  onClick={() => setConfirmationResult(null)}
                  className="w-full text-sm text-brand mt-2"
                >
                  Change Phone Number
                </button>
              </form>
            )}
          </div>
        )}

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
              onClick={handleGoogleLogin}
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
          Don&apos;t have an account?{' '}
          <Link to="/auth/signup" className="text-brand hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </motion.div>
  )
}
