import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiShield,
  FiCheckCircle,
  FiAlertCircle,
  FiCamera,
  FiUploadCloud,
  FiX,
  FiArrowRight,
  FiRefreshCw,
  FiFileText,
  FiCreditCard,
  FiUserCheck,
  FiInfo,
  FiCheck,
  FiLock,
  FiMail,
} from 'react-icons/fi'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { verificationAPI, authAPI } from '../api/endpoints'
import { auth } from '../config/firebase'
import { sendEmailVerification } from 'firebase/auth'

export default function Verify() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/explore'
  const initialType = searchParams.get('type') || 'student_id'

  const { user, updateUser } = useAuthStore()

  // Stepper: 'document' | 'face' | 'status'
  const [step, setStep] = useState('document')

  // Document selection
  const [documentType, setDocumentType] = useState(
    ['student_id', 'aadhaar', 'driving_license'].includes(initialType) ? initialType : 'student_id'
  )

  // Document form fields
  const [docNumber, setDocNumber] = useState('')
  const [institutionName, setInstitutionName] = useState(user?.college || '')
  const [expiryDate, setExpiryDate] = useState('')
  const [categories, setCategories] = useState('MCWG')

  // Uploaded files & previews
  const [frontFile, setFrontFile] = useState(null)
  const [frontPreview, setFrontPreview] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [backPreview, setBackPreview] = useState(null)

  // Face verification
  const [biometricConsent, setBiometricConsent] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [capturedSelfie, setCapturedSelfie] = useState(null)
  const [livenessStage, setLivenessStage] = useState('ready') // 'ready' | 'detecting' | 'captured'
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Remote verification status
  const [remoteStatus, setRemoteStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchingStatus, setFetchingStatus] = useState(true)

  // Email verification helper
  const [emailSending, setEmailSending] = useState(false)

  // 1. Fetch remote verification status on mount
  const loadStatus = async () => {
    try {
      setFetchingStatus(true)
      const { data } = await verificationAPI.getStatus()
      setRemoteStatus(data)

      if (data.overallStatus === 'verified') {
        setStep('status')
      } else if (data.faceStatus === 'face_under_review' || data.overallStatus === 'under_review') {
        setStep('status')
      } else if (data.documentStatus === 'document_submitted' && data.faceStatus !== 'face_verified') {
        setStep('face')
      }
    } catch (err) {
      console.warn('[Verify] Could not load verification status:', err.message)
    } finally {
      setFetchingStatus(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  // File to base64 preview helper
  const handleFileChange = (type, file) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size must be under 15MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (type === 'front') {
        setFrontFile(file)
        setFrontPreview(reader.result)
      } else {
        setBackFile(file)
        setBackPreview(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  // Camera start for Face Verification
  const startCamera = async () => {
    try {
      if (!biometricConsent) {
        toast.error('Please agree to the biometric consent first.')
        return
      }
      setCameraActive(true)
      setLivenessStage('detecting')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.error('[Camera] Access error:', err)
      toast.error('Could not access device camera. Please check camera permissions.')
      setCameraActive(false)
      setLivenessStage('ready')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Capture live selfie from video stream
  const captureSelfie = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedSelfie(dataUrl)
    setLivenessStage('captured')
    stopCamera()
    toast.success('Live selfie captured! Please verify and submit.')
  }

  const retakeSelfie = () => {
    setCapturedSelfie(null)
    setLivenessStage('ready')
    startCamera()
  }

  // Aadhaar Masking on change
  const handleAadhaarChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12)
    setDocNumber(raw)
  }

  // 2. Submit Identity Document
  const handleSubmitDocument = async (e) => {
    e.preventDefault()

    if (!frontFile && !frontPreview) {
      toast.error('Please upload the front photograph of your document.')
      return
    }

    if (['aadhaar', 'driving_license'].includes(documentType) && !backFile && !backPreview) {
      toast.error('Please upload both the front and back of your document.')
      return
    }

    if (!docNumber.trim()) {
      toast.error('Please enter the document number.')
      return
    }

    if (documentType === 'aadhaar' && docNumber.replace(/\D/g, '').length !== 12) {
      toast.error('Please enter a valid 12-digit Aadhaar number.')
      return
    }

    if (documentType === 'student_id' && !institutionName.trim()) {
      toast.error('Please enter your Institution or College name.')
      return
    }

    if (documentType === 'driving_license') {
      if (!expiryDate) {
        toast.error('Please provide your Driving License expiry date.')
        return
      }
      if (new Date(expiryDate) <= new Date()) {
        toast.error('Your Driving License is expired. An unexpired license is required.')
        return
      }
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('documentType', documentType)
      formData.append('documentNumber', docNumber.trim())
      if (institutionName) formData.append('institutionName', institutionName.trim())
      if (expiryDate) formData.append('expiryDate', expiryDate)
      if (categories) formData.append('categories', categories)

      if (frontFile) formData.append('documentFront', frontFile)
      if (backFile) formData.append('documentBack', backFile)

      const res = await verificationAPI.submitDocument(formData)
      toast.success('Document submitted! Proceed to Face Verification.')
      updateUser({
        documentType,
        documentStatus: 'document_submitted',
        verificationStatus: 'face_pending',
      })
      await loadStatus()
      setStep('face')
    } catch (err) {
      console.error('[Document Submit] Error:', err)
      toast.error(err.response?.data?.message || 'Failed to submit document')
    } finally {
      setLoading(false)
    }
  }

  // 3. Submit Live Face Verification
  const handleSubmitFace = async () => {
    if (!capturedSelfie) {
      toast.error('Please capture a live selfie before submitting.')
      return
    }
    if (!biometricConsent) {
      toast.error('Biometric consent is required.')
      return
    }

    setLoading(true)
    try {
      const res = await verificationAPI.submitFace({
        selfieDataUrl: capturedSelfie,
        biometricConsent: true,
      })
      toast.success('Face verification submitted! Under review.')
      updateUser({
        faceStatus: 'face_under_review',
        verificationStatus: 'under_review',
      })
      await loadStatus()
      setStep('status')
    } catch (err) {
      console.error('[Face Submit] Error:', err)
      toast.error(err.response?.data?.message || 'Face verification submission failed')
    } finally {
      setLoading(false)
    }
  }

  // Send Email verification link
  const handleSendEmail = async () => {
    if (!auth.currentUser) return
    setEmailSending(true)
    try {
      await sendEmailVerification(auth.currentUser)
      toast.success('Verification link sent to ' + auth.currentUser.email)
    } catch (err) {
      toast.error(err.message || 'Failed to send verification email')
    } finally {
      setEmailSending(false)
    }
  }

  const isVerified =
    remoteStatus?.overallStatus === 'verified' ||
    user?.verificationStatus === 'verified' ||
    user?.isVerified === true ||
    user?.kycStatus === 'verified'

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/30 text-brand text-xs font-bold tracking-wide uppercase">
            <FiShield className="text-sm" /> Renter Trust & Safety System
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Mandatory Identity & Face Verification
          </h1>
          <p className="text-white/60 text-sm max-w-xl mx-auto">
            To ensure community safety, all renters must verify an approved identity document and complete live face verification before booking any vehicle.
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="grid grid-cols-3 gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 text-xs font-semibold text-center">
          <button
            onClick={() => setStep('document')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              step === 'document' ? 'bg-brand text-white shadow-lg' : 'text-white/60 hover:text-white'
            }`}
          >
            <FiFileText /> 1. Identity Document
          </button>
          <button
            onClick={() => setStep('face')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              step === 'face' ? 'bg-brand text-white shadow-lg' : 'text-white/60 hover:text-white'
            }`}
          >
            <FiCamera /> 2. Face Verification
          </button>
          <button
            onClick={() => setStep('status')}
            className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              step === 'status' ? 'bg-brand text-white shadow-lg' : 'text-white/60 hover:text-white'
            }`}
          >
            <FiUserCheck /> 3. Verification Status
          </button>
        </div>

        {/* STEP 1: DOCUMENT VERIFICATION */}
        {step === 'document' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiCreditCard className="text-brand" /> Select Identity Document
              </h2>
              <p className="text-white/50 text-xs mt-1">
                Choose one accepted government or institutional document to verify your identity.
              </p>
            </div>

            {/* Three Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'student_id',
                  title: 'Student ID Card',
                  subtitle: 'Dibrugarh University & Affiliated Colleges',
                  badge: 'Campus Identity',
                },
                {
                  id: 'aadhaar',
                  title: 'Aadhaar Card',
                  subtitle: 'Government of India (UIDAI Masked)',
                  badge: 'Standard Identity',
                },
                {
                  id: 'driving_license',
                  title: 'Driving License',
                  subtitle: 'Mandatory for Geared & Motor Vehicles',
                  badge: 'Driving Eligible',
                },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => {
                    setDocumentType(opt.id)
                    setDocNumber('')
                    setFrontFile(null)
                    setFrontPreview(null)
                    setBackFile(null)
                    setBackPreview(null)
                  }}
                  className={`cursor-pointer rounded-xl p-4 border transition-all text-left flex flex-col justify-between space-y-3 ${
                    documentType === opt.id
                      ? 'border-brand bg-brand/10 shadow-lg ring-1 ring-brand'
                      : 'border-white/10 bg-black/40 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                        {opt.badge}
                      </span>
                      {documentType === opt.id && <FiCheck className="text-brand text-base" />}
                    </div>
                    <div className="font-bold text-sm text-white pt-1">{opt.title}</div>
                    <p className="text-[11px] text-white/50 leading-relaxed">{opt.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Notice for Driving License Requirement */}
            {documentType !== 'driving_license' ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2.5">
                <FiInfo className="text-base shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> Student ID and Aadhaar verify identity. However, motorbikes and scooters requiring a legal driving license will require an approved Driving License before booking.
                </span>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-xs text-green-300 flex items-start gap-2.5">
                <FiCheckCircle className="text-base shrink-0 mt-0.5" />
                <span>
                  <strong>Full Eligibility:</strong> A verified Driving License establishes both your identity and full driving authorization across all platform vehicles.
                </span>
              </div>
            )}

            {/* Form Fields Based on Selected Document */}
            <form onSubmit={handleSubmitDocument} className="space-y-5">
              {documentType === 'student_id' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">Institution / College Name *</label>
                    <input
                      type="text"
                      required
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder="e.g. Dibrugarh University Institute of Technology"
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">Student Roll / ID Number *</label>
                    <input
                      type="text"
                      required
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="e.g. DU-2024-CS-042"
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
              )}

              {documentType === 'aadhaar' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">
                      12-Digit Aadhaar Number (Masked securely) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={12}
                      value={docNumber}
                      onChange={handleAadhaarChange}
                      placeholder="Enter 12-digit Aadhaar number"
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-brand"
                    />
                    <p className="text-[11px] text-white/40">
                      Masked as: <strong className="text-brand font-mono">{docNumber.length >= 4 ? `XXXX-XXXX-${docNumber.slice(-4)}` : 'XXXX-XXXX-XXXX'}</strong>
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-white/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-white/70 font-semibold">
                      <FiLock /> UIDAI Compliance Notice
                    </div>
                    <p>
                      Full Aadhaar numbers are never stored in plaintext or logged. Only the legally compliant masked representation and document image are retained for verification.
                    </p>
                  </div>
                </div>
              )}

              {documentType === 'driving_license' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-xs font-semibold text-white/70">Driving License No. *</label>
                    <input
                      type="text"
                      required
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. AS06-20220012345"
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">License Expiry Date *</label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70">Vehicle Class</label>
                    <select
                      value={categories}
                      onChange={(e) => setCategories(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand"
                    >
                      <option value="MCWG">MCWG (Motorcycle with Gear)</option>
                      <option value="MCWOG">MCWOG (Without Gear / Scooty)</option>
                      <option value="MCWG,LMV">MCWG + LMV (Car & Bike)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Upload Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Front Image */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                    <span>Document Front Photograph *</span>
                    {frontPreview && (
                      <button
                        type="button"
                        onClick={() => { setFrontFile(null); setFrontPreview(null); }}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                      >
                        <FiX /> Remove
                      </button>
                    )}
                  </label>
                  {frontPreview ? (
                    <div className="w-full h-44 rounded-xl border border-white/20 overflow-hidden relative group bg-black/60">
                      <img src={frontPreview} alt="Front preview" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <label className="w-full h-44 rounded-xl border-2 border-dashed border-white/20 hover:border-brand/60 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center">
                      <FiUploadCloud className="text-3xl text-white/40 mb-2 group-hover:text-brand" />
                      <span className="text-xs font-semibold text-white/80">Upload Front Side</span>
                      <span className="text-[10px] text-white/40 mt-1">PNG, JPG, WEBP up to 15MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange('front', e.target.files[0])}
                      />
                    </label>
                  )}
                </div>

                {/* Back Image (Required for Aadhaar & DL) */}
                {['aadhaar', 'driving_license'].includes(documentType) ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
                      <span>Document Back Photograph *</span>
                      {backPreview && (
                        <button
                          type="button"
                          onClick={() => { setBackFile(null); setBackPreview(null); }}
                          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                        >
                          <FiX /> Remove
                        </button>
                      )}
                    </label>
                    {backPreview ? (
                      <div className="w-full h-44 rounded-xl border border-white/20 overflow-hidden relative group bg-black/60">
                        <img src={backPreview} alt="Back preview" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <label className="w-full h-44 rounded-xl border-2 border-dashed border-white/20 hover:border-brand/60 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center">
                        <FiUploadCloud className="text-3xl text-white/40 mb-2 group-hover:text-brand" />
                        <span className="text-xs font-semibold text-white/80">Upload Back Side</span>
                        <span className="text-[10px] text-white/40 mt-1">PNG, JPG, WEBP up to 15MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange('back', e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="h-44 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center p-4 text-center text-white/40 text-xs">
                    <FiCheckCircle className="text-2xl text-brand/60 mb-2" />
                    <span>Single-sided Student ID accepted</span>
                    <span className="text-[10px] text-white/30 mt-1">Ensure student photo and roll number are clear</span>
                  </div>
                )}
              </div>

              {/* Submit Document Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand/20 mt-4"
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="animate-spin" /> Submitting Document...
                  </>
                ) : (
                  <>
                    Submit Document & Proceed to Face Verification <FiArrowRight />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* STEP 2: FACE VERIFICATION */}
        {step === 'face' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiCamera className="text-brand" /> Live Face Verification
              </h2>
              <p className="text-white/50 text-xs mt-1">
                Capture a live selfie to compare with your submitted identity document. Printed photos and screen replays will be rejected.
              </p>
            </div>

            {/* Biometric Consent Box */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={biometricConsent}
                  onChange={(e) => setBiometricConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 text-brand focus:ring-brand accent-brand cursor-pointer"
                />
                <label htmlFor="consentCheckbox" className="text-xs text-white/80 cursor-pointer space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <FiLock className="text-brand" /> Mandatory Biometric Data Collection Consent
                  </div>
                  <p className="text-white/50 text-[11px] leading-relaxed">
                    I explicitly consent to LUPU capturing and verifying my live facial photograph to compare against my submitted identity document for vehicle rental security, fraud prevention, and community safety. Data is encrypted and retained strictly according to platform retention guidelines.
                  </p>
                </label>
              </div>
            </div>

            {/* Camera View / Selfie Display */}
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-full max-w-sm h-72 sm:h-80 bg-black rounded-2xl overflow-hidden border-2 border-white/20 flex items-center justify-center shadow-2xl">
                {/* Live Video Stream */}
                {cameraActive && (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                )}

                {/* Captured Selfie Preview */}
                {!cameraActive && capturedSelfie && (
                  <img
                    src={capturedSelfie}
                    alt="Captured Selfie"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Idle / Off Camera State */}
                {!cameraActive && !capturedSelfie && (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center mx-auto text-brand text-2xl">
                      <FiCamera />
                    </div>
                    <div className="text-xs font-semibold text-white/80">Camera Inactive</div>
                    <p className="text-[11px] text-white/40 max-w-xs">
                      Check the biometric consent box and click Start Camera to begin face verification.
                    </p>
                  </div>
                )}

                {/* Face Alignment Oval Overlay */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-64 border-2 border-dashed border-brand/80 rounded-[50%] animate-pulse" />
                    <span className="absolute bottom-4 px-3 py-1 bg-black/70 backdrop-blur rounded-full text-[10px] text-brand font-semibold">
                      Align your face inside the oval
                    </span>
                  </div>
                )}
              </div>

              {/* Camera Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-center w-full max-w-sm">
                {!cameraActive && !capturedSelfie && (
                  <button
                    type="button"
                    disabled={!biometricConsent}
                    onClick={startCamera}
                    className="w-full py-3 bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <FiCamera className="text-base" /> Start Live Camera
                  </button>
                )}

                {cameraActive && (
                  <button
                    type="button"
                    onClick={captureSelfie}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                  >
                    <FiCheckCircle className="text-base" /> Capture Live Selfie
                  </button>
                )}

                {!cameraActive && capturedSelfie && (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <button
                      type="button"
                      onClick={retakeSelfie}
                      className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <FiRefreshCw /> Retake
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleSubmitFace}
                      className="py-3 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-brand/20"
                    >
                      {loading ? <FiRefreshCw className="animate-spin" /> : <FiCheck />} Confirm & Submit
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 flex justify-between items-center text-xs text-white/50">
              <button
                type="button"
                onClick={() => setStep('document')}
                className="hover:text-white transition-colors"
              >
                ← Back to Document Details
              </button>
              <button
                type="button"
                onClick={() => setStep('status')}
                className="hover:text-brand transition-colors"
              >
                Skip to Status →
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: VERIFICATION STATUS & SUMMARY */}
        {step === 'status' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiUserCheck className="text-brand" /> Verification Status Dashboard
              </h2>
              <p className="text-white/50 text-xs mt-1">
                Real-time review and booking eligibility status across the LUPU platform.
              </p>
            </div>

            {/* Status Indicator Card */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-xs text-white/40 block">Overall Renter Status</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isVerified ? (
                      <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-extrabold flex items-center gap-1.5">
                        <FiCheckCircle /> VERIFIED RENTER
                      </span>
                    ) : remoteStatus?.overallStatus === 'rejected' ? (
                      <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-extrabold flex items-center gap-1.5">
                        <FiAlertCircle /> VERIFICATION REJECTED
                      </span>
                    ) : remoteStatus?.overallStatus === 'under_review' ? (
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1.5">
                        <FiRefreshCw className="animate-spin" /> UNDER REVIEW
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 border border-white/20 text-xs font-extrabold flex items-center gap-1.5">
                        <FiInfo /> INCOMPLETE VERIFICATION
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={loadStatus}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 flex items-center gap-1.5 border border-white/10"
                >
                  <FiRefreshCw className={fetchingStatus ? 'animate-spin' : ''} /> Refresh Status
                </button>
              </div>

              {/* Sub-status checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-xs space-y-1">
                  <span className="text-white/40 block text-[10px]">1. Identity Document</span>
                  <div className="font-semibold capitalize text-white flex items-center gap-1.5">
                    {remoteStatus?.documentStatus === 'document_verified' ? (
                      <span className="text-green-400 flex items-center gap-1"><FiCheck /> Approved</span>
                    ) : remoteStatus?.documentStatus === 'document_submitted' ? (
                      <span className="text-amber-400 flex items-center gap-1"><FiInfo /> Submitted</span>
                    ) : remoteStatus?.documentStatus === 'document_rejected' ? (
                      <span className="text-red-400 flex items-center gap-1"><FiX /> Rejected</span>
                    ) : (
                      <span className="text-white/50">Not Submitted</span>
                    )}
                    <span className="text-white/40 text-[10px] ml-auto">
                      {remoteStatus?.documentType ? remoteStatus.documentType.replace('_', ' ') : '—'}
                    </span>
                  </div>
                  {remoteStatus?.maskedDocumentNumber && (
                    <div className="text-[11px] font-mono text-brand mt-0.5">
                      {remoteStatus.maskedDocumentNumber}
                    </div>
                  )}
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-xs space-y-1">
                  <span className="text-white/40 block text-[10px]">2. Live Face Verification</span>
                  <div className="font-semibold capitalize text-white flex items-center gap-1.5">
                    {remoteStatus?.faceStatus === 'face_verified' ? (
                      <span className="text-green-400 flex items-center gap-1"><FiCheck /> Face Comparison Approved</span>
                    ) : remoteStatus?.faceStatus === 'face_under_review' ? (
                      <span className="text-amber-400 flex items-center gap-1"><FiRefreshCw className="animate-spin text-[10px]" /> Awaiting Manual Face Review</span>
                    ) : remoteStatus?.faceStatus === 'face_failed' ? (
                      <span className="text-red-400 flex items-center gap-1"><FiX /> Face Comparison Rejected</span>
                    ) : (
                      <span className="text-white/50">Pending Live Capture</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/40">
                    {remoteStatus?.faceStatus === 'face_under_review'
                      ? 'Selfie captured — In queue for manual face comparison'
                      : 'Live in-app selfie capture comparison'}
                  </div>
                </div>
              </div>

              {/* Rejection notice if rejected */}
              {remoteStatus?.rejectionReason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <FiAlertCircle /> Rejection Feedback
                  </div>
                  <p>{remoteStatus.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-3 justify-end pt-2">
              {!isVerified ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('document')}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Resubmit Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('face')}
                    className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all shadow-lg"
                  >
                    Capture Face Selfie
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(redirectUrl)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                >
                  <FiCheckCircle /> Continue to Vehicle Booking
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Collapsible Email Verification Note */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-2.5">
            <FiMail className="text-base text-brand" />
            <span>
              Email: <strong>{auth.currentUser?.email || user?.email || '—'}</strong> ({auth.currentUser?.emailVerified ? 'Verified' : 'Unverified'})
            </span>
          </div>
          {!auth.currentUser?.emailVerified && (
            <button
              onClick={handleSendEmail}
              disabled={emailSending}
              className="text-brand hover:underline font-semibold"
            >
              {emailSending ? 'Sending...' : 'Resend Email Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
