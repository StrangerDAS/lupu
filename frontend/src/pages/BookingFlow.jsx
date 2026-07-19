import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiCalendar, FiClock, FiUpload, FiCheck,
  FiArrowRight, FiArrowLeft, FiAlertCircle, FiShield,
  FiUser, FiFileText, FiMapPin, FiBookOpen, FiActivity
} from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import PageWrapper from '../components/PageWrapper'
import { useVehicle } from '../hooks/useVehicles'
import useAuthStore from '../store/authStore'
import {
  uploadBookingFile,
  createPaymentRecord,
  addNotification
} from '../firebase/firestoreService'
import { bookingAPI } from '../api/endpoints'
import BookingAgreementModal from '../components/BookingAgreementModal'

const STEPS = ['Select Time', 'Verify Identity', 'Sign Agreement', 'Advance Payment']

const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const calcPrice = (start, end, ratePerHour) => {
  if (!start || !end || !ratePerHour) return 0
  const ms = new Date(end) - new Date(start)
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60)) * ratePerHour
}

const calcDuration = (start, end) => {
  if (!start || !end) return 0
  const ms = new Date(end) - new Date(start)
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60))
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })
}

export default function BookingFlow() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { vehicle, loading } = useVehicle(id)
  const isBookable = vehicle?.status === 'approved' && vehicle?.isLive !== false

  // Step 1: Time Selection
  const [startTime, setStartTime] = useState(nowLocal())
  const [endTime, setEndTime] = useState('')
  const [duration, setDuration] = useState(0)
  const [rentalAmount, setRentalAmount] = useState(0)

  const bookingFee = 0 // Removed for Beta
  const totalAmount = rentalAmount
  const advanceAmount = Math.round(rentalAmount * 0.3)
  const remainingAmount = rentalAmount - advanceAmount

  // Step 2: Verification Details
  const [currentAddress, setCurrentAddress] = useState('')
  const [permanentAddress, setPermanentAddress] = useState('')
  const [sameAddress, setSameAddress] = useState(false)
  const [kycOption, setKycOption] = useState('college_id') // 'college_id' | 'aadhaar'
  const [collegeName, setCollegeName] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')

  // Files
  const [files, setFiles] = useState({
    selfie: null,
    aadhaarFront: null,
    aadhaarBack: null,
    collegeId: null,
  })
  const [previews, setPreviews] = useState({
    selfie: '',
    aadhaarFront: '',
    aadhaarBack: '',
    collegeId: '',
  })

  // Step 3: Signature & Checkboxes
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signatureData, setSignatureData] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [authorizeVerification, setAuthorizeVerification] = useState(false)

  // Step Tracker
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [showAgreementModal, setShowAgreementModal] = useState(false)

  // Pricing (No fees for Beta)ime change
  useEffect(() => {
    if (startTime && endTime && vehicle?.pricePerHour) {
      const dur = calcDuration(startTime, endTime)
      setDuration(dur)
      setRentalAmount(dur * vehicle.pricePerHour)
    } else {
      setDuration(0)
      setRentalAmount(0)
    }
  }, [startTime, endTime, vehicle])

  const [blockedDates, setBlockedDates] = useState([])
  useEffect(() => {
    if (id) {
      bookingAPI.getCalendar(id)
        .then(res => {
          setBlockedDates(res.data.bookings || [])
        })
        .catch(err => console.error('Failed to load blocked dates', err))
    }
  }, [id])

  // Sync permanent address if same address checked
  useEffect(() => {
    if (sameAddress) {
      setPermanentAddress(currentAddress)
    }
  }, [sameAddress, currentAddress])

  // File Upload Helper
  const handleFileChange = async (key, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File size must be under 5MB')
    }
    try {
      const base64 = await fileToBase64(file)
      setFiles(prev => ({ ...prev, [key]: file }))
      setPreviews(prev => ({ ...prev, [key]: base64 }))
    } catch (err) {
      console.error(err)
      toast.error('Failed to parse file preview')
    }
  }

  // Canvas Drawing Pad Handlers
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  const startDrawing = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#ff6b00'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasCoords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      saveSignature()
    }
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Check if canvas is blank
    const blank = document.createElement('canvas')
    blank.width = canvas.width
    blank.height = canvas.height
    if (canvas.toDataURL() === blank.toDataURL()) {
      setSignatureData('')
    } else {
      setSignatureData(canvas.toDataURL('image/png'))
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData('')
  }

  // Step Validations
  const validateStep = () => {
    if (currentStep === 0) {
      if (!startTime || !endTime) {
        toast.error('Please select both start and end times')
        return false
      }
      if (new Date(endTime) <= new Date(startTime)) {
        toast.error('End time must be after start time')
        return false
      }
      if (duration < 1) {
        toast.error('Rental duration must be at least 1 hour')
        return false
      }

      // Overlap checks
      const isOverlap = blockedDates.some(b => {
        const bStart = new Date(b.startTime)
        const bEnd = new Date(b.endTime)
        const selStart = new Date(startTime)
        const selEnd = new Date(endTime)
        return selStart < bEnd && selEnd > bStart
      })
      if (isOverlap) {
        toast.error('The selected dates overlap with an existing booking.')
        return false
      }

      // KYC check
      const kycStatus = (user?.kycStatus || '').toLowerCase()
      if (kycStatus !== 'verified') {
        toast.error('Only KYC-verified riders can request bookings. Please complete verification on your profile page.')
        return false
      }

      return true
    }

    if (currentStep === 1) {
      const kycStatus = (user?.kycStatus || '').toLowerCase()
      if (kycStatus === 'verified') {
        return true
      }

      if (!currentAddress || !permanentAddress) {
        toast.error('Please fill in your address details')
        return false
      }

      if (kycOption === 'college_id') {
        if (!collegeName) {
          toast.error('Please enter your college name')
          return false
        }
        if (!files.selfie || !files.collegeId) {
          toast.error('Selfie and College Student ID are required')
          return false
        }
      } else {
        if (!aadhaarNumber || aadhaarNumber.length !== 12) {
          toast.error('Please enter a valid 12-digit Aadhaar number')
          return false
        }
        if (!files.selfie || !files.aadhaarFront || !files.aadhaarBack) {
          toast.error('Selfie, Aadhaar Front, and Aadhaar Back are required')
          return false
        }
      }
      return true
    }

    if (currentStep === 2) {
      if (!signatureData) {
        toast.error('Please draw your digital signature')
        return false
      }
      if (!termsAccepted || !authorizeVerification) {
        toast.error('Please accept both terms and verification agreements')
        return false
      }
      return true
    }

    return true
  }

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(0, prev - 1))
  }

  // Compile PDF agreement in-browser and upload
  const compilePDF = async (bookingId) => {
    const doc = new jsPDF()

    // Title banner
    doc.setFillColor(255, 107, 0)
    doc.rect(0, 0, 210, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('LUPU VEHICLE RENTAL AGREEMENT', 20, 20)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(12)

    // Section 1: Vehicle & Renter Details
    doc.setFont('helvetica', 'bold')
    doc.text('1. AGREEMENT DETAILS', 20, 45)
    doc.setFont('helvetica', 'normal')
    doc.text(`Booking Reference ID: ${bookingId}`, 20, 52)
    doc.text(`Vehicle Booked: ${vehicle?.name}`, 20, 59)
    doc.text(`Vehicle Location: ${vehicle?.location}`, 20, 66)
    doc.text(`Vehicle Owner: ${vehicle?.ownerName || 'Owner'}`, 20, 73)

    doc.setFont('helvetica', 'bold')
    doc.text('2. RENTER INFORMATION', 20, 85)
    doc.setFont('helvetica', 'normal')
    doc.text(`Renter Name: ${user?.name}`, 20, 92)
    doc.text(`Renter Email: ${user?.email || '—'}`, 20, 99)
    doc.text(`Renter College: ${collegeName}`, 20, 106)
    doc.text(`Current Address: ${currentAddress}`, 20, 113)
    doc.text(`Permanent Address: ${permanentAddress}`, 20, 120)

    // Section 2: Timing & Pricing
    doc.setFont('helvetica', 'bold')
    doc.text('3. TIMING & BILLING BREAKDOWN', 20, 135)
    doc.setFont('helvetica', 'normal')
    doc.text(`Start Time: ${new Date(startTime).toLocaleString('en-IN')}`, 20, 142)
    doc.text(`End Time: ${new Date(endTime).toLocaleString('en-IN')}`, 20, 149)
    doc.text(`Duration: ${duration} hours`, 20, 156)
    doc.text(`Vehicle Rental: INR ${rentalAmount}`, 20, 163)
    doc.text(`Total Rental: INR ${totalAmount}`, 20, 170)
    doc.text(`Pay Now (30% Online): INR ${advanceAmount}`, 20, 177)
    doc.text(`Pay at Pickup (70%): INR ${remainingAmount}`, 20, 184)

    // Page 2: Uploaded Verification Docs
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('VERIFICATION DOCUMENTS ATTACHMENT', 20, 20)

    // Selfie
    if (previews.selfie) {
      try {
        doc.setFontSize(10)
        doc.text('Selfie Photo:', 20, 35)
        doc.addImage(previews.selfie, 'JPEG', 20, 40, 50, 50)
      } catch (err) { console.error('Selfie embed error:', err) }
    }

    // Signature
    if (signatureData) {
      try {
        doc.setFontSize(10)
        doc.text('Digital Signature:', 110, 35)
        doc.addImage(signatureData, 'PNG', 110, 40, 60, 30)
      } catch (err) { console.error('Signature embed error:', err) }
    }

    // Aadhaar Front & Back
    const currentY = 105
    if (previews.aadhaarFront) {
      try {
        doc.setFontSize(10)
        doc.text('Aadhaar Card (Front):', 20, currentY)
        doc.addImage(previews.aadhaarFront, 'JPEG', 20, currentY + 5, 75, 45)
      } catch (err) { console.error('Aadhaar Front embed error:', err) }
    }

    if (previews.aadhaarBack) {
      try {
        doc.setFontSize(10)
        doc.text('Aadhaar Card (Back):', 110, currentY)
        doc.addImage(previews.aadhaarBack, 'JPEG', 110, currentY + 5, 75, 45)
      } catch (err) { console.error('Aadhaar Back embed error:', err) }
    }

    // Page 3: Academic / Identity Document
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('RENTER IDENTITY DOCUMENTS', 20, 20)

    const page3Y = 35
    if (kycOption === 'college_id' && previews.collegeId) {
      try {
        doc.setFontSize(10)
        doc.text('College Student ID:', 20, page3Y)
        doc.addImage(previews.collegeId, 'JPEG', 20, page3Y + 5, 75, 45)
      } catch (err) { console.error('College ID embed error:', err) }
    } else {
      if (previews.aadhaarFront) {
        try {
          doc.setFontSize(10)
          doc.text('Aadhaar Card (Front):', 20, page3Y)
          doc.addImage(previews.aadhaarFront, 'JPEG', 20, page3Y + 5, 75, 45)
        } catch (err) { console.error('Aadhaar Front embed error:', err) }
      }
      if (previews.aadhaarBack) {
        try {
          doc.setFontSize(10)
          doc.text('Aadhaar Card (Back):', 110, page3Y)
          doc.addImage(previews.aadhaarBack, 'JPEG', 110, page3Y + 5, 75, 45)
        } catch (err) { console.error('Aadhaar Back embed error:', err) }
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('LEGAL DECLARATION & TERMS', 20, 125)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const declareText = 'The renter hereby declares that all information provided is accurate and authentic. Renter assumes full financial and legal responsibility for the vehicle during the specified rental duration. LUPU acts solely as a connecting platform and assumes no liability for disputes, accidents, or damage. Agreement completed digitally.'
    doc.text(doc.splitTextToSize(declareText, 170), 20, 132)

    // Save as blob
    const pdfBlob = doc.output('blob')
    const pdfFile = new File([pdfBlob], `agreement_${bookingId}.pdf`, { type: 'application/pdf' })
    return await uploadBookingFile(`bookings/pdfs/${bookingId}_agreement.pdf`, pdfFile)
  }

  // Complete Booking Flow Submit
  const handleFinalSubmit = async () => {
    setSubmitting(true)
    // Temporary booking ID to store documents under
    const tempId = `LUPU_${Date.now()}_${Math.floor(Math.random() * 1000)}`

    try {
      setStatusMessage('Uploading secure documents...')
      
      let selfieUrl = ''
      let frontUrl = ''
      let backUrl = ''
      let collegeUrl = ''

      if (user?.kycStatus === 'Verified') {
        selfieUrl = user.kycDetails?.selfieUrl || ''
        collegeUrl = user.kycDetails?.collegeIdUrl || ''
        frontUrl = user.kycDetails?.aadhaarFrontUrl || ''
        backUrl = user.kycDetails?.aadhaarBackUrl || ''
      } else {
        if (files.selfie) {
          selfieUrl = await uploadBookingFile(`bookings/selfie/${tempId}_selfie.jpg`, files.selfie)
        }
        if (kycOption === 'college_id') {
          if (files.collegeId) {
            collegeUrl = await uploadBookingFile(`bookings/college-id/${tempId}_college.jpg`, files.collegeId)
          }
        } else {
          if (files.aadhaarFront) {
            frontUrl = await uploadBookingFile(`bookings/aadhaar/${tempId}_front.jpg`, files.aadhaarFront)
          }
          if (files.aadhaarBack) {
            backUrl = await uploadBookingFile(`bookings/aadhaar/${tempId}_back.jpg`, files.aadhaarBack)
          }
        }
      }

      // Upload Signature
      setStatusMessage('Uploading signature...')
      // Convert signature base64 back to Blob file
      const sigRes = await fetch(signatureData)
      const sigBlob = await sigRes.blob()
      const sigFile = new File([sigBlob], `signature_${tempId}.png`, { type: 'image/png' })
      const signatureUrl = await uploadBookingFile(`bookings/signatures/${tempId}_sig.png`, sigFile)

      setStatusMessage('Compiling Verification Agreement PDF...')
      const pdfUrl = await compilePDF(tempId)

      setStatusMessage('Processing Payment...')
      // Create Order on Backend
      const orderRes = await bookingAPI.createPaymentOrder({
        bookingId: tempId,
        amount: advanceAmount,
        type: 'advance'
      })

      // Save payment transaction record
      const paymentRefId = await createPaymentRecord({
        bookingId: tempId,
        amount: advanceAmount,
        type: 'advance',
        status: 'completed',
        renterId: user?._id || 'anonymous',
        renterName: user?.name || 'Renter',
        description: `30% Advance payment for booking ${tempId}`
      })

      setStatusMessage('Submitting booking to owner review...')
      // Submit Booking details via Express MongoDB REST API
      await bookingAPI.create({
        vehicleId: id,
        startTime,
        endTime,
        agreementAccepted: true,
        agreementVersion: 'Beta v1.0',
        agreementAcceptedAt: new Date().toISOString(),
        verificationDetails: {
          currentAddress,
          permanentAddress,
          collegeName: kycOption === 'college_id' ? collegeName : '',
          aadhaarNumber: kycOption === 'aadhaar' ? aadhaarNumber : '',
          selfieUrl,
          aadhaarFrontUrl: frontUrl,
          aadhaarBackUrl: backUrl,
          collegeIdUrl: collegeUrl,
          signatureUrl,
          verificationPdfUrl: pdfUrl
        }
      })

      // Send owner notification
      await addNotification(vehicle?.ownerId, {
        title: 'New Booking Request 🚘',
        message: `Renter ${user?.name} requested to book ${vehicle?.name}. Verification documents submitted.`,
        bookingId: tempId,
        type: 'status'
      })

      toast.success('Booking & Verification Submitted Successfully! 🎉')
      navigate('/my-bookings')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Something went wrong. Please check your network and try again.')
    } finally {
      setSubmitting(false)
      setStatusMessage('')
    }
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="container-main py-10 max-w-2xl">
          <div className="skeleton h-8 w-48 rounded-xl mb-6" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </PageWrapper>
    )
  }

  if (!isBookable) {
    return (
      <PageWrapper>
        <div className="container-main py-10 max-w-2xl text-center">
          <div className="card p-10 space-y-4">
            <span className="status-dot status-dot--offline mx-auto" style={{ width: 16, height: 16 }} />
            <h2 className="text-xl font-bold text-red-400">Vehicle Unavailable</h2>
            <p className="text-white/40 text-sm">This vehicle is currently offline and cannot be booked.</p>
            <button onClick={() => navigate(-1)} className="btn-secondary mt-4">Go Back</button>
          </div>
        </div>
      </PageWrapper>
    )
  }

  const Icon = vehicle?.type === 'bike' ? RiMotorbikeLine : RiEBikeLine

  return (
    <PageWrapper>
      <div className="container-main py-10 max-w-2xl">
        <button
          onClick={() => (currentStep === 0 ? navigate(-1) : handlePrev())}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition"
        >
          <FiArrowLeft /> {currentStep === 0 ? 'Back to vehicle' : 'Previous step'}
        </button>

        {/* Step indicator */}
        <div className="flex items-center justify-between gap-2 mb-10 overflow-x-auto pb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                i < currentStep ? 'bg-brand text-white' :
                i === currentStep ? 'bg-brand/20 border border-brand text-brand' :
                'bg-surface-2 text-white/30'
              }`}>
                {i < currentStep ? <FiCheck size={14} /> : i + 1}
              </div>
              <span className={`text-sm ${i === currentStep ? 'text-white font-medium' : 'text-white/30'}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-4 sm:w-8 mx-1 ${i < currentStep ? 'bg-brand' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Vehicle summary card */}
        <div className="card p-4 flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
            <Icon className="text-brand text-3xl" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{vehicle?.name}</div>
            <div className="text-white/40 text-sm">{vehicle?.location}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold text-brand">₹{vehicle?.pricePerHour}/hr</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: TIME SELECTION */}
          {currentStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2"><FiCalendar className="text-brand" /> Select rental dates</h2>
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="startTime">Start Date & Time</label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    min={nowLocal()}
                    className="input-field"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="endTime">End Date & Time</label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    min={startTime || nowLocal()}
                    className="input-field"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {blockedDates.length > 0 && (
                <div className="mt-4 p-4 card bg-surface-2/50 border border-white/5">
                  <h4 className="text-sm font-semibold text-white/70 mb-2">Reserved Time Slots:</h4>
                  <ul className="text-xs text-white/40 space-y-1.5">
                    {blockedDates.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        {new Date(b.startTime).toLocaleString('en-IN')} to {new Date(b.endTime).toLocaleString('en-IN')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {duration > 0 && (
                <div className="card p-5 bg-brand/5 border border-brand/20">
                  <div className="flex justify-between items-center text-white text-sm mb-2">
                    <span className="text-white/60">Rental Duration</span>
                    <span className="font-semibold">{duration} Hours</span>
                  </div>
                  <div className="flex justify-between items-center text-white text-sm mb-4">
                    <span className="text-white/60">Vehicle Rental</span>
                    <span className="font-semibold">₹{rentalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-white text-sm border-t border-white/10 pt-4 mb-4">
                    <span className="text-white/80 font-bold">Total Rental</span>
                    <span className="font-bold text-lg">₹{totalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-white text-sm border-t border-white/10 pt-4 mb-2">
                    <span className="text-brand font-semibold">Pay Now (30%)</span>
                    <span className="text-brand font-bold text-xl">₹{advanceAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-white text-xs">
                    <span className="text-white/40">Pay at Pickup (70%)</span>
                    <span className="font-medium text-white/80">₹{remainingAmount}</span>
                  </div>
                </div>
              )}

              <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 mt-2">
                Continue to Verification <FiArrowRight />
              </button>
            </motion.div>
          )}

          {/* STEP 2: IDENTITY VERIFICATION */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2">
                <FiUser className="text-brand" size={20} />
                <h2 className="text-xl font-bold">Identity & Background Details</h2>
              </div>
              <p className="text-xs text-white/40">Provide authentic documents and contact details to get approved. All files are encrypted & uploaded securely.</p>

              {user?.kycStatus === 'Verified' ? (
                <div className="card p-6 border-green-500/20 bg-green-500/5 text-center space-y-3">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/25">
                    <FiCheck className="text-green-400 text-xl" />
                  </div>
                  <h3 className="font-semibold text-white">Identity Pre-Verified</h3>
                  <p className="text-xs text-white/45 max-w-sm mx-auto leading-relaxed">
                    Your KYC document verification status is <strong>Verified</strong>. Your profile details will be auto-filled for this booking. You can proceed directly to the signature step.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="label"><FiMapPin className="inline mr-1" />Current Residential Address</label>
                      <textarea
                        className="input-field min-h-[70px] py-2"
                        placeholder="Enter your current address details"
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={sameAddress}
                        onChange={(e) => setSameAddress(e.target.checked)}
                        className="accent-brand"
                      />
                      Permanent Address is same as Current Address
                    </label>
                    {!sameAddress && (
                      <div>
                        <label className="label"><FiMapPin className="inline mr-1" />Permanent Address</label>
                        <textarea
                          className="input-field min-h-[70px] py-2"
                          placeholder="Enter permanent address as on Aadhaar"
                          value={permanentAddress}
                          onChange={(e) => setPermanentAddress(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="pt-2">
                      <label className="label">KYC Document Verification Option</label>
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => setKycOption('college_id')}
                          className={`py-3 rounded-xl border text-sm font-semibold transition ${
                            kycOption === 'college_id'
                              ? 'border-brand bg-brand/10 text-white'
                              : 'border-white/10 bg-surface-2 text-white/40 hover:text-white'
                          }`}
                        >
                          College ID Card
                        </button>
                        <button
                          type="button"
                          onClick={() => setKycOption('aadhaar')}
                          className={`py-3 rounded-xl border text-sm font-semibold transition ${
                            kycOption === 'aadhaar'
                              ? 'border-brand bg-brand/10 text-white'
                              : 'border-white/10 bg-surface-2 text-white/40 hover:text-white'
                          }`}
                        >
                          Aadhaar Card
                        </button>
                      </div>
                    </div>

                    {kycOption === 'college_id' ? (
                      <div>
                        <label className="label"><FiBookOpen className="inline mr-1" />College/University Name</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. IIT Delhi, Christ University"
                          value={collegeName}
                          onChange={(e) => setCollegeName(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="label">12-Digit Aadhaar Number</label>
                        <input
                          type="text"
                          maxLength={12}
                          className="input-field font-mono tracking-wider"
                          placeholder="e.g. 123456789012"
                          value={aadhaarNumber}
                          onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="divider opacity-20 my-2" />
                  <h3 className="text-sm font-semibold text-white/80">Document Uploads</h3>

                  <div className="space-y-4">
                    {[
                      { key: 'selfie', label: 'Renter Selfie Photo', show: true },
                      { key: 'collegeId', label: 'College Student ID Card', show: kycOption === 'college_id' },
                      { key: 'aadhaarFront', label: 'Aadhaar Card (Front Side)', show: kycOption === 'aadhaar' },
                      { key: 'aadhaarBack', label: 'Aadhaar Card (Back Side)', show: kycOption === 'aadhaar' }
                    ].map(({ key, label, show }) => {
                      if (!show) return null
                      return (
                        <div key={key} className="card p-4 border border-white/5 bg-surface-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-xs font-semibold text-white/80">{label}</h4>
                            <p className="text-[10px] text-white/40 mt-0.5">Maximum size 5MB. JPEG/PNG format preferred.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {previews[key] && (
                              <img
                                src={previews[key]}
                                alt={label}
                                className="w-12 h-12 rounded-lg object-cover border border-white/10"
                              />
                            )}
                            <label className={`cursor-pointer text-xs font-medium px-4 py-2 rounded-xl transition ${
                              files[key] ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20'
                            }`}>
                              {files[key] ? 'Replace File' : 'Choose File'}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleFileChange(key, e.target.files[0])}
                              />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <button onClick={handlePrev} className="btn-secondary w-1/3 py-3.5">Back</button>
                <button onClick={handleNext} className="btn-primary w-2/3 flex items-center justify-center gap-2 py-3.5">
                  Continue <FiArrowRight />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: DIGITAL SIGNATURE */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2">
                <FiShield className="text-brand" size={20} />
                <h2 className="text-xl font-bold">Rental Agreement & Digital Signature</h2>
              </div>
              <p className="text-xs text-white/40">Please read the terms carefully and sign in the pad below using your mouse or touch.</p>

              <div className="card p-5 border border-white/10 max-h-48 overflow-y-auto space-y-3 text-xs text-white/60 leading-relaxed bg-surface-1">
                <h4 className="font-bold text-white mb-1">TERMS & RESPONSIBILITIES</h4>
                <p>1. <strong>Vehicle Condition:</strong> The renter agrees to capture verification photos at pickup. Any existing damages must be reported instantly through the app.</p>
                <p>2. <strong>Financial Liabilities:</strong> The renter accepts full responsibility for repairing costs in the event of minor/major damage or accidents during the rental period.</p>
                <p>3. <strong>Identity Declaration:</strong> The documents uploaded (Aadhaar, Student ID) are verified legal representations. Fake or forged documents will result in booking cancellation, advance forfeit, and legal police reports.</p>
                <p>4. <strong>LUPU Safety Rules:</strong> Renter certifies they possess a valid driving license, will obey Indian speed limits, and will never operate vehicles under influence.</p>
              </div>

              <div className="space-y-3">
                <label className="label">Draw Your Signature Inside the Box</label>
                <div className="relative border-2 border-dashed border-white/10 bg-surface-2 rounded-2xl overflow-hidden aspect-[3/1] max-w-full">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                  <button
                    onClick={clearSignature}
                    className="absolute right-3 bottom-3 text-xs text-white/50 hover:text-white bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 transition"
                  >
                    Clear Canvas
                  </button>
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand rounded"
                  />
                  <span className="text-xs text-white/70 leading-relaxed">
                    I declare that all details provided are correct and I accept the terms of the rental agreement.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authorizeVerification}
                    onChange={(e) => setAuthorizeVerification(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand rounded"
                  />
                  <span className="text-xs text-white/70 leading-relaxed">
                    I authorize LUPU and the vehicle owner to verify my legal document details and parent details.
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button onClick={handlePrev} className="btn-secondary w-1/3 py-3.5">Back</button>
                <button
                  onClick={handleNext}
                  disabled={!termsAccepted || !authorizeVerification || !signatureData}
                  className="btn-primary w-2/3 flex items-center justify-center gap-2 py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue to Payment <FiArrowRight />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: ADVANCE PAYMENT & UPLOADS */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold flex items-center gap-2"><FiFileText className="text-brand" /> Confirm Booking & Pay Advance</h2>
              <p className="text-xs text-white/40">Verify the checkout details. Clicking "Pay" compiles your agreement, uploads files to storage, and notifies the owner.</p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Vehicle Rental</span>
                  <span className="font-medium text-white">₹{rentalAmount}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/10 pt-3">
                  <span className="text-white/80 font-bold">Total Rental</span>
                  <span className="font-bold text-white">₹{totalAmount}</span>
                </div>
                <div className="flex justify-between items-center border-t border-brand/20 pt-3">
                  <span className="text-brand font-semibold">Pay Now (30%)</span>
                  <span className="text-xl font-extrabold text-brand">₹{advanceAmount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Pay at Pickup (70%)</span>
                  <span className="font-medium text-white/80">₹{remainingAmount}</span>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-white/60 leading-relaxed mb-8 flex gap-3 items-start">
                <FiAlertCircle className="text-brand text-lg shrink-0 mt-0.5" />
                <p>
                  The booking advance is refundable up to 24 hours before your booking start time (if booked 2+ days early). The remaining 70% payment (₹{remainingAmount}) is due at vehicle pickup directly to the owner.
                </p>
              </div>

              {submitting && (
                <div className="card p-4 bg-surface-2 border border-white/5 flex flex-col items-center justify-center gap-3 text-center py-6">
                  <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-white/90">{statusMessage}</p>
                  <p className="text-[10px] text-white/30 animate-pulse">This might take a minute, please do not close or reload this window.</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <button onClick={handlePrev} disabled={submitting} className="btn-secondary w-1/3 py-3.5 disabled:opacity-40">Back</button>
                <button
                  onClick={() => setShowAgreementModal(true)}
                  disabled={submitting}
                  className="btn-primary w-2/3 py-3.5 flex items-center justify-center gap-2 text-base font-bold disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : `Pay ₹${advanceAmount} & Confirm`}
                </button>
              </div>

              <BookingAgreementModal 
                isOpen={showAgreementModal}
                onClose={() => setShowAgreementModal(false)}
                onAccept={() => {
                  setShowAgreementModal(false)
                  handleFinalSubmit()
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  )
}
