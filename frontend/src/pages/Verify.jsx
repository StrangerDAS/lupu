import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiUser, FiCheckCircle, FiPhone, FiMail, FiShield, FiAlertCircle, FiRefreshCw, FiLock } from 'react-icons/fi'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import useAuthStore from '../store/authStore'
import { authAPI, userAPI } from '../api/endpoints'

export default function Verify() {
  const { user, setAuth, token } = useAuthStore()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [emailToVerify, setEmailToVerify] = useState(user?.email || '')
  
  const [otpPhone, setOtpPhone] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  
  const [phoneOtpSent, setPhoneOtpSent] = useState(false)
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  
  const [loadingPhone, setLoadingPhone] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)

  const handleReload = async () => {
    try {
      const { data } = await authAPI.me()
      setAuth(data, token)
      toast.success('Verification status refreshed!')
    } catch (err) {
      toast.error('Failed to refresh status')
    }
  }

  // --- Email Verification ---
  const handleSendEmailOTP = async (e) => {
    if (e) e.preventDefault()
    if (!emailToVerify || !emailToVerify.includes('@')) {
      toast.error('Please enter a valid email')
      return
    }
    setLoadingEmail(true)
    try {
      const res = await authAPI.sendOtp({ identifier: emailToVerify })
      if (res.data._dev_otp) console.log('DEV EMAIL OTP:', res.data._dev_otp)
      setEmailOtpSent(true)
      toast.success('OTP sent to your email!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    }
    setLoadingEmail(false)
  }

  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault()
    if (!otpEmail || otpEmail.length !== 6) {
      toast.error('Please enter a 6-digit OTP')
      return
    }
    setLoadingEmail(true)
    try {
      const { data } = await authAPI.verifyContact({ identifier: emailToVerify, otp: otpEmail })
      toast.success('Email verified successfully!')
      setAuth(data.user, token)
      setEmailOtpSent(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    }
    setLoadingEmail(false)
  }

  // --- Phone Verification ---
  const handleSendPhoneOTP = async (e) => {
    e.preventDefault()
    if (!phoneNumber || phoneNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number')
      return
    }
    setLoadingPhone(true)
    try {
      const res = await authAPI.sendOtp({ identifier: phoneNumber })
      if (res.data._dev_otp) console.log('DEV PHONE OTP:', res.data._dev_otp)
      setPhoneOtpSent(true)
      toast.success('OTP sent successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    }
    setLoadingPhone(false)
  }

  const handleVerifyPhoneOTP = async (e) => {
    e.preventDefault()
    if (!otpPhone || otpPhone.length !== 6) {
      toast.error('Please enter a 6-digit OTP')
      return
    }
    setLoadingPhone(true)
    try {
      const { data } = await authAPI.verifyContact({ identifier: phoneNumber, otp: otpPhone })
      toast.success('Phone verified and linked successfully!')
      setAuth(data.user, token)
      setPhoneOtpSent(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    }
    setLoadingPhone(false)
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
              ) : null}
            </div>

            {!user?.emailVerified && (
              <div className="border-t border-white/5 pt-4 mt-4">
                {!emailOtpSent ? (
                  <form onSubmit={handleSendEmailOTP} className="flex gap-2 max-w-md">
                    <input
                      type="email"
                      placeholder="Enter email address"
                      value={emailToVerify}
                      onChange={(e) => setEmailToVerify(e.target.value)}
                      className="input-field py-2 text-sm flex-1"
                    />
                    <button type="submit" disabled={loadingEmail} className="btn-primary text-xs px-4 py-2 shrink-0">
                      {loadingEmail ? 'Sending…' : 'Send OTP'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyEmailOTP} className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      className="input-field py-2 text-sm flex-1 tracking-widest text-center"
                      maxLength={6}
                    />
                    <button type="submit" disabled={loadingEmail} className="btn-primary text-xs px-4 py-2 shrink-0">
                      {loadingEmail ? 'Verifying…' : 'Verify OTP'}
                    </button>
                    <button type="button" onClick={() => setEmailOtpSent(false)} className="text-xs text-brand ml-2">
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Phone Verification Card */}
          <div className="card p-6 border-white/5">
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
                {!phoneOtpSent ? (
                  <form onSubmit={handleSendPhoneOTP} className="flex gap-2 max-w-md">
                    <div className="relative flex items-center flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-white/70 border-r border-white/10 pr-2 z-10 select-none text-sm">
                        <span role="img" aria-label="India">🇮🇳</span> <span className="font-semibold">+91</span>
                      </span>
                      <input
                        type="tel"
                        placeholder="7002630628"
                        value={phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          if (val.length <= 10) setPhoneNumber(val)
                        }}
                        className="input-field py-2 text-sm pl-[80px] w-full"
                      />
                    </div>
                    <button type="submit" disabled={loadingPhone} className="btn-primary text-xs px-4 py-2 shrink-0">
                      {loadingPhone ? 'Sending…' : 'Send OTP'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyPhoneOTP} className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otpPhone}
                      onChange={(e) => setOtpPhone(e.target.value)}
                      className="input-field py-2 text-sm flex-1 tracking-widest text-center"
                      maxLength={6}
                    />
                    <button type="submit" disabled={loadingPhone} className="btn-primary text-xs px-4 py-2 shrink-0">
                      {loadingPhone ? 'Verifying…' : 'Verify OTP'}
                    </button>
                    <button type="button" onClick={() => setPhoneOtpSent(false)} className="text-xs text-brand ml-2">
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* KYC Document Upload Card */}
          <div className="card p-6 border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <FiUser className="text-purple-400 text-lg" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">KYC Documents</h3>
                  <p className="text-white/40 text-xs mt-0.5">
                    {user?.kycStatus === 'verified' ? 'Documents verified' :
                     user?.kycStatus === 'pending' ? 'Verification in progress' :
                     user?.kycStatus === 'rejected' ? 'Documents rejected - Action Required' : 'Please upload your ID'}
                  </p>
                </div>
              </div>
              {user?.kycStatus === 'verified' ? (
                <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs flex items-center gap-1.5 w-fit">
                  <FiCheckCircle size={12} /> Verified
                </span>
              ) : user?.kycStatus === 'pending' ? (
                <span className="badge bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs flex items-center gap-1.5 w-fit">
                  <FiAlertCircle size={12} /> Pending Review
                </span>
              ) : user?.kycStatus === 'rejected' ? (
                <span className="badge bg-red-500/10 text-red-400 border border-red-500/20 text-xs flex items-center gap-1.5 w-fit">
                  <FiAlertCircle size={12} /> Rejected
                </span>
              ) : null}
            </div>

            {user?.kycStatus === 'rejected' && user?.kycRejectionReason && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <p className="text-red-400 text-sm font-medium">Rejection Reason:</p>
                <p className="text-red-300 text-sm mt-1">{user.kycRejectionReason}</p>
              </div>
            )}

            {user?.kycStatus !== 'verified' && user?.kycStatus !== 'pending' && (
              <div className="border-t border-white/5 pt-4">
                <form className="space-y-4" onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.target)
                  try {
                    const { data } = await userAPI.submitKyc(formData)
                    toast.success('KYC documents submitted!')
                    setAuth(data.user, token)
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to submit KYC')
                  }
                }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs mb-1.5 block">Government ID (Aadhar/PAN)</label>
                      <input type="file" name="governmentIdUrl" required accept="image/*,.pdf" className="input-field text-sm p-2" />
                    </div>
                    <div>
                      <label className="label text-xs mb-1.5 block">College ID</label>
                      <input type="file" name="collegeIdUrl" required accept="image/*,.pdf" className="input-field text-sm p-2" />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary text-sm px-4 py-2 w-full mt-2">
                    Submit Documents
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
