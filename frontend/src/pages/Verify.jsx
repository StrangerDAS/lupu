import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiUser, FiCheckCircle, FiPhone, FiMail, FiShield, FiAlertCircle, FiRefreshCw, FiLock } from 'react-icons/fi'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import useAuthStore from '../store/authStore'
import { auth } from '../firebase/config'
import { sendEmailVerification, RecaptchaVerifier, linkWithPhoneNumber } from 'firebase/auth'

export default function Verify() {
  const { user, updateUser } = useAuthStore()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    }
  }, [])

  const handleReload = async () => {
    if (!auth.currentUser) return
    try {
      await auth.currentUser.reload()
      const u = auth.currentUser
      updateUser({
        emailVerified: u.emailVerified,
        phoneVerified: !!u.phoneNumber,
        phone: u.phoneNumber || ''
      })
      toast.success('Verification status refreshed!')
    } catch (err) {
      toast.error('Failed to refresh status')
    }
  }

  const handleSendEmail = async () => {
    if (!auth.currentUser) return
    setSendingEmail(true)
    try {
      await sendEmailVerification(auth.currentUser)
      toast.success('Verification email sent! Check your inbox.')
    } catch (err) {
      toast.error(err.message || 'Failed to send verification email')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number with country code (e.g. +91...)')
      return
    }
    setLoading(true)
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {}
        })
      }
      const confirmation = await linkWithPhoneNumber(auth.currentUser, phoneNumber, window.recaptchaVerifier)
      setConfirmationResult(confirmation)
      toast.success('OTP sent successfully!')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to send OTP')
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP')
      return
    }
    setLoading(true)
    try {
      await confirmationResult.confirm(otp)
      toast.success('Phone verified and linked successfully!')
      await auth.currentUser.reload()
      updateUser({
        phoneVerified: true,
        phone: auth.currentUser.phoneNumber || phoneNumber
      })
      setConfirmationResult(null)
    } catch (err) {
      toast.error('Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="pt-24 pb-24 max-w-3xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 text-center sm:text-left">
          <div>
            <h1 className="text-3xl font-bold flex items-center justify-center sm:justify-start gap-2.5">
              <FiShield className="text-brand" />
              Verification Center
            </h1>
            <p className="text-white/50 text-sm mt-1">Verify your email or phone to unlock booking and listing rides.</p>
          </div>
          <button
            onClick={handleReload}
            className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 px-4 border-white/10 w-fit mx-auto sm:mx-0 hover:bg-white/5"
          >
            <FiRefreshCw className="animate-spin-slow" /> Refresh Status
          </button>
        </div>

        <div className="space-y-6">
          {/* Email Verification Card */}
          <div className="card p-6 border-white/5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                  <FiMail className="text-brand text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Email Verification</h3>
                  <p className="text-white/40 text-xs mt-0.5">{user?.email || 'No email registered'}</p>
                </div>
              </div>
              {user?.emailVerified ? (
                <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs flex items-center gap-1.5 w-fit">
                  <FiCheckCircle size={12} /> Verified
                </span>
              ) : (
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="btn-primary text-xs px-4 py-2 w-fit shrink-0"
                >
                  {sendingEmail ? 'Sending…' : 'Send Verification Email'}
                </button>
              )}
            </div>
            {!user?.emailVerified && (
              <p className="text-white/30 text-xs mt-4 border-t border-white/5 pt-3">
                ⚠️ Verification link will be sent to your registered email address. Click the link to complete verification, then click "Refresh Status" above.
              </p>
            )}
          </div>

          {/* Phone Verification Card */}
          <div className="card p-6 border-white/5">
            <div id="recaptcha-container"></div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <FiPhone className="text-blue-400 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Mobile Number Verification</h3>
                  <p className="text-white/40 text-xs mt-0.5">{user?.phone || 'No phone number registered'}</p>
                </div>
              </div>
              {user?.phoneVerified ? (
                <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs flex items-center gap-1.5 w-fit">
                  <FiCheckCircle size={12} /> Verified
                </span>
              ) : null}
            </div>

            {!user?.phoneVerified && (
              <div className="border-t border-white/5 pt-4">
                {!confirmationResult ? (
                  <form onSubmit={handleSendOTP} className="flex gap-2 max-w-md">
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="input-field py-2 text-sm flex-1"
                    />
                    <button type="submit" disabled={loading} className="btn-primary text-xs px-4 py-2 shrink-0">
                      {loading ? 'Sending…' : 'Send OTP'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="input-field py-2 text-sm flex-1 tracking-widest text-center"
                      maxLength={6}
                    />
                    <button type="submit" disabled={loading} className="btn-primary text-xs px-4 py-2 shrink-0">
                      {loading ? 'Verifying…' : 'Verify OTP'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
