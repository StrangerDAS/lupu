import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  FiCheckCircle, FiAlertCircle, FiCamera, FiCheck,
  FiFileText, FiMapPin, FiPhone, FiMail, FiUser, FiInfo, FiActivity
} from 'react-icons/fi'
import { RiMotorbikeLine as BikeIcon, RiEBikeLine as ScootyIcon } from 'react-icons/ri'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import PageWrapper from '../components/PageWrapper'
import useAuthStore from '../store/authStore'
import {
  updateHandoverDetails,
  saveIdVerificationAcknowledgement,
  activateBookingRide,
  completeReturnHandover,
  uploadBookingFile,
  createPaymentRecord,
  addNotification
} from '../firebase/firestoreService'

const HANDOVER_CHECKLIST_ITEMS = [
  { key: 'scratches', label: 'No new major scratches or dents' },
  { key: 'mirrors', label: 'Rearview mirrors intact & adjusted' },
  { key: 'lights', label: 'Headlights, taillights & indicators functional' },
  { key: 'brakes', label: 'Front & rear brakes working properly' },
  { key: 'tyres', label: 'Tyres inflated & have good grip' },
  { key: 'fuel', label: 'Fuel level matches declaration' },
  { key: 'helmet', label: 'Provided helmets strap functional' },
  { key: 'accessories', label: 'Keys and vehicle documents pouch present' }
]

const RETURN_CHECKLIST_ITEMS = [
  { key: 'scratches', label: 'No new scratches or dents detected' },
  { key: 'fuel', label: 'Fuel level is returned to same level' },
  { key: 'helmet', label: 'Provided helmets returned in good shape' },
  { key: 'keys', label: 'Keys and accessories returned to owner' }
]

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })
}

export default function Handover() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  // Real-time synchronization
  useEffect(() => {
    setLoading(true)
    const unsub = onSnapshot(doc(db, 'bookings', bookingId), (snap) => {
      if (snap.exists()) {
        setBooking({ _id: snap.id, ...snap.data() })
      } else {
        toast.error('Booking not found')
        navigate('/hub')
      }
      setLoading(false)
    }, (err) => {
      console.error(err)
      toast.error('Error fetching booking data')
      setLoading(false)
    })
    return () => unsub()
  }, [bookingId, navigate])

  const isOwner = user?._id === booking?.ownerId
  const isRenter = user?._id === booking?.renterId

  // Forms - Handover (Owner)
  const [ownerChecklist, setOwnerChecklist] = useState({
    scratches: false, mirrors: false, lights: false, brakes: false, tyres: false, fuel: false, helmet: false, accessories: false
  })
  const [ownerPhotos, setOwnerPhotos] = useState({ front: null, back: null, left: null, right: null, dashboard: null })
  const [ownerPreviews, setOwnerPreviews] = useState({ front: '', back: '', left: '', right: '', dashboard: '' })
  const [ownerComments, setOwnerComments] = useState('')
  const [ownerGps, setOwnerGps] = useState(null)
  const [ownerSignature, setOwnerSignature] = useState('')
  const [ownerDeclaration, setOwnerDeclaration] = useState(false)
  const ownerCanvasRef = useRef(null)
  const [ownerDrawing, setOwnerDrawing] = useState(false)

  // Forms - Handover (Renter)
  const [renterChecklist, setRenterChecklist] = useState({
    scratches: false, mirrors: false, lights: false, brakes: false, tyres: false, fuel: false, helmet: false, accessories: false
  })
  const [renterPhotos, setRenterPhotos] = useState({ front: null, side: null, dashboard: null })
  const [renterPreviews, setRenterPreviews] = useState({ front: '', side: '', dashboard: '' })
  const [idAcknowledged, setIdAcknowledged] = useState(false)
  const [idHoldAgreed, setIdHoldAgreed] = useState(false)
  const [renterSignature, setRenterSignature] = useState('')
  const [renterDeclaration, setRenterDeclaration] = useState(false)
  const renterCanvasRef = useRef(null)
  const [renterDrawing, setRenterDrawing] = useState(false)

  // Forms - Return (Owner)
  const [returnChecklist, setReturnChecklist] = useState({ scratches: false, fuel: false, helmet: false, keys: false })
  const [returnPhotos, setReturnPhotos] = useState({ dashboard: null, vehicle: null })
  const [returnPreviews, setReturnPreviews] = useState({ dashboard: '', vehicle: '' })
  const [returnComments, setReturnComments] = useState('')
  const [returnSignature, setReturnSignature] = useState('')
  const returnCanvasRef = useRef(null)
  const [returnDrawing, setReturnDrawing] = useState(false)
  const [paymentSettled, setPaymentSettled] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submittingMsg, setSubmittingMsg] = useState('')

  // Geolocation
  const captureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOwnerGps({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
          toast.success('GPS coordinates logged successfully!')
        },
        () => {
          toast.error('Location permissions denied or unavailable.')
        }
      )
    }
  }

  // File Upload Preview
  const handlePhotoUpload = async (key, file, role) => {
    if (!file) return
    try {
      const base64 = await fileToBase64(file)
      if (role === 'owner') {
        setOwnerPhotos(prev => ({ ...prev, [key]: file }))
        setOwnerPreviews(prev => ({ ...prev, [key]: base64 }))
      } else if (role === 'renter') {
        setRenterPhotos(prev => ({ ...prev, [key]: file }))
        setRenterPreviews(prev => ({ ...prev, [key]: base64 }))
      } else if (role === 'return') {
        setReturnPhotos(prev => ({ ...prev, [key]: file }))
        setReturnPreviews(prev => ({ ...prev, [key]: base64 }))
      }
    } catch (e) {
      toast.error('Failed to load file preview')
    }
  }

  // Canvas drawing handlers
  const getCanvasCoords = (e, canvas) => {
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e, canvas, setDrawing) => {
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#ff6b00'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const { x, y } = getCanvasCoords(e, canvas)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDrawing(true)
  }

  const draw = (e, canvas, drawing) => {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasCoords(e, canvas)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = (canvas, setDrawing, setSignature) => {
    setDrawing(false)
    const blank = document.createElement('canvas')
    blank.width = canvas.width
    blank.height = canvas.height
    if (canvas.toDataURL() !== blank.toDataURL()) {
      setSignature(canvas.toDataURL('image/png'))
    }
  }

  const clearCanvas = (canvas, setSignature) => {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignature('')
  }

  // PDF Compilation & Activation
  const compileHandoverPDF = async (ownerDet, renterDet) => {
    const doc = new jsPDF()

    // Title banner
    doc.setFillColor(255, 107, 0)
    doc.rect(0, 0, 210, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('LUPU VEHICLE HANDOVER AGREEMENT', 20, 20)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)

    // Details
    doc.setFont('helvetica', 'bold')
    doc.text('1. RENTAL DETAILS', 20, 45)
    doc.setFont('helvetica', 'normal')
    doc.text(`Booking Reference: ${bookingId}`, 20, 52)
    doc.text(`Vehicle Name: ${booking?.vehicleName}`, 20, 59)
    doc.text(`Owner Name: ${booking?.ownerName}`, 20, 66)
    doc.text(`Renter Name: ${booking?.renterName}`, 20, 73)
    doc.text(`Rental Period: ${formatDate(booking?.startTime)} → ${formatDate(booking?.endTime)}`, 20, 80)

    // ID verification records
    doc.setFont('helvetica', 'bold')
    doc.text('2. IDENTITY VERIFICATION CHECK', 20, 92)
    doc.setFont('helvetica', 'normal')
    doc.text('Physical presentation of original government ID: Acknowledged ✓', 20, 99)
    doc.text(`Mutual agreement on owner holding ID: ${booking?.handoverDetails?.idVerified?.holdAgreed ? 'Yes, agreed' : 'No, renter holds ID'}`, 20, 106)

    // GPS records
    if (ownerDet.gps) {
      doc.text(`Owner Geolocation: Lat ${ownerDet.gps.lat.toFixed(5)}, Lng ${ownerDet.gps.lng.toFixed(5)} (Accuracy: ${ownerDet.gps.accuracy.toFixed(1)}m)`, 20, 113)
    }

    // Handover Checklist Table
    doc.setFont('helvetica', 'bold')
    doc.text('3. HANDOVER CHECKLIST CONFIRMATIONS', 20, 125)
    doc.setFont('helvetica', 'normal')
    let checkY = 132
    HANDOVER_CHECKLIST_ITEMS.forEach((item) => {
      const ownerChecked = ownerDet.checklist[item.key] ? 'Yes' : 'No'
      const renterChecked = renterDet.checklist[item.key] ? 'Yes' : 'No'
      doc.text(`• ${item.label}: Owner = ${ownerChecked} | Renter = ${renterChecked}`, 20, checkY)
      checkY += 7
    })

    // Signatures
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('4. DIGITAL SIGNATURES & DECLARATIONS', 20, 20)
    doc.setFontSize(10)
    
    // Owner signature
    if (ownerDet.signature) {
      doc.text('Owner Declaration & Signature:', 20, 35)
      doc.addImage(ownerDet.signature, 'PNG', 20, 40, 60, 25)
    }
    
    // Renter signature
    if (renterDet.signature) {
      doc.text('Renter Declaration & Signature:', 110, 35)
      doc.addImage(renterDet.signature, 'PNG', 110, 40, 60, 25)
    }

    // Vehicle Photos title
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('5. VEHICLE CONDITION IMAGES AT HANDOVER', 20, 80)

    const pdfBlob = doc.output('blob')
    const pdfFile = new File([pdfBlob], `handover_${bookingId}.pdf`, { type: 'application/pdf' })
    return await uploadBookingFile(`handover/pdfs/${bookingId}_handover.pdf`, pdfFile)
  }

  // Submit Owner Pre-Handover Checklist
  const handleOwnerSubmit = async () => {
    // Validations
    if (!ownerDeclaration || !ownerSignature) {
      return toast.error('Check declaration and sign inside the pad.')
    }
    const missingPhotos = Object.values(ownerPhotos).some(p => p === null)
    if (missingPhotos) {
      return toast.error('Please upload all vehicle check photos.')
    }
    const unchecked = Object.values(ownerChecklist).some(c => c === false)
    if (unchecked) {
      return toast.error('Verify all items in the vehicle checklist.')
    }

    setSubmitting(true)
    setSubmittingMsg('Uploading condition photos...')
    try {
      const urls = {}
      for (const k of Object.keys(ownerPhotos)) {
        urls[k] = await uploadBookingFile(`handover/owner-photos/${bookingId}_owner_${k}.jpg`, ownerPhotos[k])
      }

      setSubmittingMsg('Logging signature & details...')
      const sigBlob = await (await fetch(ownerSignature)).blob()
      const sigFile = new File([sigBlob], `owner_sig_${bookingId}.png`, { type: 'image/png' })
      const sigUrl = await uploadBookingFile(`handover/signatures/${bookingId}_owner_sig.png`, sigFile)

      const details = {
        photos: urls,
        checklist: ownerChecklist,
        comments: ownerComments,
        gps: ownerGps,
        signature: sigUrl,
        verified: true
      }

      await updateHandoverDetails(bookingId, 'owner', details)
      toast.success('Your handover checklist submitted successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit pre-handover verification')
    } finally {
      setSubmitting(false)
      setSubmittingMsg('')
    }
  }

  // Submit Renter Pre-ride Checklist
  const handleRenterSubmit = async () => {
    // Validations
    if (!idAcknowledged || !renterDeclaration || !renterSignature) {
      return toast.error('Acknowledge original ID check, declaration, and sign inside the pad.')
    }
    const missingPhotos = Object.values(renterPhotos).some(p => p === null)
    if (missingPhotos) {
      return toast.error('Upload all verification check photos.')
    }
    const unchecked = Object.values(renterChecklist).some(c => c === false)
    if (unchecked) {
      return toast.error('Verify and checklist confirm all items.')
    }

    setSubmitting(true)
    setSubmittingMsg('Uploading renter verification photos...')
    try {
      const urls = {}
      for (const k of Object.keys(renterPhotos)) {
        urls[k] = await uploadBookingFile(`handover/renter-photos/${bookingId}_renter_${k}.jpg`, renterPhotos[k])
      }

      setSubmittingMsg('Uploading digital signature...')
      const sigBlob = await (await fetch(renterSignature)).blob()
      const sigFile = new File([sigBlob], `renter_sig_${bookingId}.png`, { type: 'image/png' })
      const sigUrl = await uploadBookingFile(`handover/signatures/${bookingId}_renter_sig.png`, sigFile)

      const details = {
        photos: urls,
        checklist: renterChecklist,
        signature: sigUrl,
        verified: true
      }

      await updateHandoverDetails(bookingId, 'renter', details)
      await saveIdVerificationAcknowledgement(bookingId, idHoldAgreed)

      // Automatically compile Handover PDF if Owner has also completed
      if (booking?.handoverDetails?.owner?.verified) {
        setSubmittingMsg('Compiling Handover Agreement PDF...')
        const pdfUrl = await compileHandoverPDF(booking.handoverDetails.owner, details)
        
        setSubmittingMsg('Activating rental ride...')
        await activateBookingRide(bookingId, pdfUrl)
        
        await addNotification(booking.ownerId, {
          title: 'Ride Activated! 🟢',
          message: `Booking for ${booking.vehicleName} is now ONGOING. Renter completed checklists.`,
          bookingId,
          type: 'status'
        })
        await addNotification(booking.renterId, {
          title: 'Ride Activated! 🟢',
          message: `Your booking for ${booking.vehicleName} is now active. Safe riding!`,
          bookingId,
          type: 'status'
        })
        toast.success('Agreement Compiled & Ride Activated! 🎉')
      } else {
        toast.success('Your checks logged! Waiting for Owner checklist submission.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit renter pre-ride verification')
    } finally {
      setSubmitting(false)
      setSubmittingMsg('')
    }
  }

  // Submit Owner Return Completion
  const handleReturnSubmit = async () => {
    if (!returnSignature) {
      return toast.error('Draw signature inside the pad to confirm vehicle return.')
    }
    const missingPhotos = Object.values(returnPhotos).some(p => p === null)
    if (missingPhotos) {
      return toast.error('Upload return condition dashboard & vehicle photos.')
    }
    const unchecked = Object.values(returnChecklist).some(c => c === false)
    if (unchecked) {
      return toast.error('Ensure all return checklist items are verified.')
    }
    if (!paymentSettled) {
      return toast.error('Verify renter settled final 75% payment dues.')
    }

    setSubmitting(true)
    setSubmittingMsg('Uploading vehicle return condition photos...')
    try {
      const urls = {}
      for (const k of Object.keys(returnPhotos)) {
        urls[k] = await uploadBookingFile(`return/owner-photos/${bookingId}_return_${k}.jpg`, returnPhotos[k])
      }

      setSubmittingMsg('Uploading digital signature...')
      const sigBlob = await (await fetch(returnSignature)).blob()
      const sigFile = new File([sigBlob], `return_sig_${bookingId}.png`, { type: 'image/png' })
      const sigUrl = await uploadBookingFile(`handover/signatures/${bookingId}_return_sig.png`, sigFile)

      setSubmittingMsg('Processing remaining payment record...')
      const finalAmount = booking.pricing?.remaining || Math.round(booking.totalPrice * 0.75)
      await createPaymentRecord({
        bookingId,
        amount: finalAmount,
        type: 'final_settlement',
        status: 'completed',
        renterId: booking.renterId,
        renterName: booking.renterName,
        description: `Remaining 75% final payment dues settled on vehicle return.`
      })

      setSubmittingMsg('Archiving agreement & finalizing ride...')
      await completeReturnHandover(bookingId, {
        photos: urls,
        checklist: returnChecklist,
        comments: returnComments,
        signature: sigUrl,
        verified: true
      })

      // Send notifications
      await addNotification(booking.renterId, {
        title: 'Ride Completed! 🏁',
        message: `Thank you for choosing LUPU. Your booking for ${booking.vehicleName} is completed.`,
        bookingId,
        type: 'status'
      })
      await addNotification(booking.ownerId, {
        title: 'Ride Completed! 🏁',
        message: `Your vehicle ${booking.vehicleName} has been returned and final payment settled.`,
        bookingId,
        type: 'status'
      })

      toast.success('Rental ride completed successfully!')
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Failed to complete return checklist')
    } finally {
      setSubmitting(false)
      setSubmittingMsg('')
    }
  }

  function formatDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="container-main py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Synchronizing live check status...</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="container-main py-10 max-w-3xl">
        {/* Back navigation */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition"
        >
          <FiArrowLeft /> Back to Dashboard
        </button>

        {/* Booking details card */}
        <div className="card p-5 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center text-brand text-2xl shrink-0">
              {booking?.vehicleType === 'scooty' ? <ScootyIcon /> : <BikeIcon />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{booking?.vehicleName}</h1>
              <p className="text-xs text-white/40 mt-0.5">Booking Ref: {bookingId}</p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end text-xs">
            <span className="text-white/50">Dues: ₹{booking?.pricing?.remaining} / ₹{booking?.pricing?.total} Total</span>
            <span className="font-semibold text-brand mt-1 uppercase tracking-wider badge bg-brand/5 border border-brand/20">
              {booking?.bookingStatus.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* RIDE ACTIVE OR COMPLETE SWITCH */}
        {booking?.bookingStatus === 'ongoing' ? (
          /* RETURN FLOW VIEW */
          <div className="space-y-6">
            <div className="card p-6 border-l-4 border-green-500 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                <FiCheckCircle className="text-green-400" /> Return Inspection Checklist
              </h2>
              <p className="text-xs text-white/40 leading-relaxed">
                The ride is active. At vehicle return, the owner must complete this checklist to settle dues and complete the rental.
              </p>
            </div>

            {isOwner ? (
              <div className="space-y-6">
                {/* Return Checklist Checkboxes */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white/80 border-b border-white/5 pb-2">Return Condition Checklist</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {RETURN_CHECKLIST_ITEMS.map((item) => (
                      <label key={item.key} className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={returnChecklist[item.key]}
                          onChange={(e) => setReturnChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 accent-brand rounded"
                        />
                        <span className="text-xs text-white/70 leading-normal">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Return Photos */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-white/80 border-b border-white/5 pb-2">Upload Return Condition Photos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'dashboard', label: 'Return Dashboard & Fuel Odometer' },
                      { key: 'vehicle', label: 'General Return Condition (Side view)' }
                    ].map(({ key, label }) => (
                      <div key={key} className="card p-4 border border-white/5 bg-surface-1 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white/80 truncate">{label}</h4>
                          <p className="text-[10px] text-white/40 mt-0.5">JPEG format, under 5MB</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {returnPreviews[key] && (
                            <img src={returnPreviews[key]} alt={label} className="w-10 h-10 rounded-lg object-cover" />
                          )}
                          <label className="cursor-pointer text-[10px] font-bold px-3 py-2 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition">
                            Upload
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(key, e.target.files[0], 'return')}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment verify checkbox */}
                <div className="card p-5 border border-amber-500/20 bg-amber-500/5 space-y-3">
                  <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5"><FiDollarSign /> Verify Final Payment Dues</h3>
                  <p className="text-xs text-amber-300/80 leading-normal">
                    Collect the remaining 75% dues (<strong>₹{booking?.pricing?.remaining}</strong>) directly from the renter (via UPI, cash, etc.) before concluding.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={paymentSettled}
                      onChange={(e) => setPaymentSettled(e.target.checked)}
                      className="w-4 h-4 accent-brand rounded"
                    />
                    <span className="text-xs text-white/90 font-medium">I verify that I have received ₹{booking?.pricing?.remaining} from the renter.</span>
                  </label>
                </div>

                {/* Return comments & Signature */}
                <div className="card p-5 space-y-4">
                  <div>
                    <label className="label">Return Inspection Comments (Optional)</label>
                    <textarea
                      className="input-field min-h-[70px] py-2"
                      placeholder="List any comments regarding returned accessories or minor changes"
                      value={returnComments}
                      onChange={(e) => setOwnerComments(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Owner Return Signature Pad</label>
                    <div className="relative border border-white/10 bg-surface-2 rounded-xl overflow-hidden aspect-[3/1] max-w-full">
                      <canvas
                        ref={returnCanvasRef}
                        width={500}
                        height={160}
                        onMouseDown={(e) => startDraw(e, returnCanvasRef.current, setReturnDrawing)}
                        onMouseMove={(e) => draw(e, returnCanvasRef.current, returnDrawing)}
                        onMouseUp={() => endDraw(returnCanvasRef.current, setReturnDrawing, setReturnSignature)}
                        onMouseLeave={() => endDraw(returnCanvasRef.current, setReturnDrawing, setReturnSignature)}
                        onTouchStart={(e) => startDraw(e, returnCanvasRef.current, setReturnDrawing)}
                        onTouchMove={(e) => draw(e, returnCanvasRef.current, returnDrawing)}
                        onTouchEnd={() => endDraw(returnCanvasRef.current, setReturnDrawing, setReturnSignature)}
                        className="w-full h-full cursor-crosshair touch-none"
                      />
                      <button
                        onClick={() => clearCanvas(returnCanvasRef.current, setReturnSignature)}
                        className="absolute right-3 bottom-3 text-xs text-white/50 hover:text-white bg-white/5 px-2 py-1 rounded border border-white/5 transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {submitting && (
                  <div className="card p-4 bg-surface-2 flex flex-col items-center justify-center gap-3 text-center py-6">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-white">{submittingMsg}</p>
                  </div>
                )}

                <button
                  onClick={handleReturnSubmit}
                  disabled={submitting}
                  className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
                >
                  Confirm Return & Complete Ride <FiCheckCircle />
                </button>
              </div>
            ) : (
              <div className="card p-8 text-center space-y-4">
                <FiClock className="text-white/15 text-6xl mx-auto animate-pulse" />
                <h3 className="text-lg font-bold">Ride Ongoing 🟢</h3>
                <p className="text-xs text-white/40 max-w-md mx-auto leading-relaxed">
                  Enjoy your ride! At the end of your rental period, please return the vehicle to the owner's location and pay the remaining balance of <strong>₹{booking?.pricing?.remaining}</strong> directly.
                </p>
                <div className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-3 py-1 font-semibold">
                  Awaiting owner return checks
                </div>
              </div>
            )}
          </div>
        ) : (
          /* PRE-RIDE HANDOVER FLOW VIEW */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-3">
              {/* Owner card check status */}
              <div className={`card p-5 border-l-4 ${booking?.handoverDetails?.owner?.verified ? 'border-green-500' : 'border-amber-500'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Owner Checklist</h3>
                  {booking?.handoverDetails?.owner?.verified ? (
                    <span className="text-xs text-green-400 font-bold flex items-center gap-1"><FiCheck /> Complete</span>
                  ) : (
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1"><FiClock /> Awaiting</span>
                  )}
                </div>
                <p className="text-[11px] text-white/40 mt-1.5 leading-normal">
                  {booking?.handoverDetails?.owner?.verified ? 'Owner has captured pre-handover photos and signed checklist.' : 'Owner must inspect condition, log damage, and sign pre-handover forms.'}
                </p>
              </div>

              {/* Renter card check status */}
              <div className={`card p-5 border-l-4 ${booking?.handoverDetails?.renter?.verified ? 'border-green-500' : 'border-amber-500'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Renter Checklist</h3>
                  {booking?.handoverDetails?.renter?.verified ? (
                    <span className="text-xs text-green-400 font-bold flex items-center gap-1"><FiCheck /> Complete</span>
                  ) : (
                    <span className="text-xs text-amber-400 font-bold flex items-center gap-1"><FiClock /> Awaiting</span>
                  )}
                </div>
                <p className="text-[11px] text-white/40 mt-1.5 leading-normal">
                  {booking?.handoverDetails?.renter?.verified ? 'Renter has checked ID check, uploaded photos, and signed.' : 'Renter must verify original ID presentation, checklist details, and sign.'}
                </p>
              </div>
            </div>

            {/* OWNER INSTRUCTIONS */}
            {isOwner && (
              <div className="space-y-6">
                {booking?.handoverDetails?.owner?.verified ? (
                  <div className="card p-8 text-center space-y-4">
                    <FiCheckCircle className="text-green-400 text-6xl mx-auto" />
                    <h3 className="text-base font-bold text-white">Your Pre-Handover Forms Submitted!</h3>
                    <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
                      We are waiting for the renter to inspect the vehicle on their app, present their original ID, and complete their digital signature checklist. Once complete, the ride activates automatically.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Checklist */}
                    <div className="card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-white/80 border-b border-white/5 pb-2">Vehicle Pre-Handover Checklist</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {HANDOVER_CHECKLIST_ITEMS.map((item) => (
                          <label key={item.key} className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={ownerChecklist[item.key]}
                              onChange={(e) => setOwnerChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                              className="mt-0.5 w-4 h-4 accent-brand rounded"
                            />
                            <span className="text-xs text-white/70 leading-normal">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Photos */}
                    <div className="card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-white/80 border-b border-white/5 pb-2">Capture Vehicle Handover Photos</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { key: 'front', label: 'Front Side View' },
                          { key: 'back', label: 'Rear Side View' },
                          { key: 'left', label: 'Left Side (Damages/Scratches)' },
                          { key: 'right', label: 'Right Side (Damages/Scratches)' },
                          { key: 'dashboard', label: 'Dashboard & Fuel Gauge' }
                        ].map(({ key, label }) => (
                          <div key={key} className="card p-4 border border-white/5 bg-surface-1 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-white/80 truncate">{label}</h4>
                              <p className="text-[10px] text-white/40 mt-0.5">JPEG format, under 5MB</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {ownerPreviews[key] && (
                                <img src={ownerPreviews[key]} alt={label} className="w-10 h-10 rounded-lg object-cover" />
                              )}
                              <label className="cursor-pointer text-[10px] font-bold px-3 py-2 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition">
                                Upload
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handlePhotoUpload(key, e.target.files[0], 'owner')}
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GPS Capture */}
                    <div className="card p-5 space-y-3">
                      <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2"><FiMapPin className="text-brand" /> Handover Location Metadata</h3>
                      <p className="text-xs text-white/40">Log current physical location tags to record handover proof in the agreement PDF.</p>
                      <button
                        type="button"
                        onClick={captureGPS}
                        className="btn-secondary text-xs px-4 py-2 flex items-center gap-1.5 mt-2"
                      >
                        <FiMapPin /> {ownerGps ? 'GPS Captured ✓' : 'Capture Live Location'}
                      </button>
                      {ownerGps && (
                        <p className="text-[10px] text-green-400">Captured: Lat {ownerGps.lat.toFixed(5)}, Lng {ownerGps.lng.toFixed(5)}</p>
                      )}
                    </div>

                    {/* Comments & Signature */}
                    <div className="card p-5 space-y-4">
                      <div>
                        <label className="label">Damage & Handover Comments (Optional)</label>
                        <textarea
                          className="input-field min-h-[70px] py-2"
                          placeholder="Note down accessories details or custom damage notes before renter signs..."
                          value={ownerComments}
                          onChange={(e) => setOwnerComments(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Owner Pre-handover Signature Pad</label>
                        <div className="relative border border-white/10 bg-surface-2 rounded-xl overflow-hidden aspect-[3/1] max-w-full">
                          <canvas
                            ref={ownerCanvasRef}
                            width={500}
                            height={160}
                            onMouseDown={(e) => startDraw(e, ownerCanvasRef.current, setOwnerDrawing)}
                            onMouseMove={(e) => draw(e, ownerCanvasRef.current, ownerDrawing)}
                            onMouseUp={() => endDraw(ownerCanvasRef.current, setOwnerDrawing, setOwnerSignature)}
                            onMouseLeave={() => endDraw(ownerCanvasRef.current, setOwnerDrawing, setOwnerSignature)}
                            onTouchStart={(e) => startDraw(e, ownerCanvasRef.current, setOwnerDrawing)}
                            onTouchMove={(e) => draw(e, ownerCanvasRef.current, ownerDrawing)}
                            onTouchEnd={() => endDraw(ownerCanvasRef.current, setOwnerDrawing, setOwnerSignature)}
                            className="w-full h-full cursor-crosshair touch-none"
                          />
                          <button
                            onClick={() => clearCanvas(ownerCanvasRef.current, setOwnerSignature)}
                            className="absolute right-3 bottom-3 text-xs text-white/50 hover:text-white bg-white/5 px-2 py-1 rounded border border-white/5 transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Agreement Declaration */}
                    <label className="flex items-start gap-3 cursor-pointer card p-4 border border-white/5 hover:border-brand/35 transition">
                      <input
                        type="checkbox"
                        checked={ownerDeclaration}
                        onChange={(e) => setOwnerDeclaration(e.target.checked)}
                        className="mt-0.5 w-4.5 h-4.5 accent-brand rounded"
                      />
                      <span className="text-xs text-white/80 leading-relaxed">
                        I confirm that the uploaded vehicle photos accurately represent the vehicle condition before the rental begins.
                      </span>
                    </label>

                    {submitting && (
                      <div className="card p-4 bg-surface-2 flex flex-col items-center justify-center gap-3 text-center py-6">
                        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-white">{submittingMsg}</p>
                      </div>
                    )}

                    <button
                      onClick={handleOwnerSubmit}
                      disabled={submitting}
                      className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
                    >
                      Confirm Checklist & Handover <FiCheckCircle />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* RENTER PRE-RIDE INSTRUCTIONS */}
            {isRenter && (
              <div className="space-y-6">
                {booking?.handoverDetails?.renter?.verified ? (
                  <div className="card p-8 text-center space-y-4">
                    <FiCheckCircle className="text-green-400 text-6xl mx-auto" />
                    <h3 className="text-base font-bold text-white">Your Verification Submitted!</h3>
                    <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
                      Your checks are complete! We are waiting for the owner to finalize their pre-handover form. Once both are submitted, your ride transitions to ongoing instantly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Identity Verification Dialog */}
                    <div className="card p-5 border border-amber-500/20 bg-amber-500/5 space-y-4">
                      <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                        <FiInfo /> Physical Identity Verification Check
                      </h3>
                      <div className="text-xs text-white/70 leading-relaxed space-y-2">
                        <p>
                          <strong>Instruction:</strong> Renter must physically present their original Aadhaar card or valid government ID for identity verification before the ride begins.
                        </p>
                        <p className="text-[10px] text-white/40">
                          <strong>Note:</strong> Original details are inspected physically to prevent identity fraud.
                        </p>
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-white/5">
                        <input
                          type="checkbox"
                          checked={idAcknowledged}
                          onChange={(e) => setIdAcknowledged(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-brand rounded animate-pulse"
                        />
                        <span className="text-xs text-white/90 leading-relaxed">
                          I have physically presented my original Aadhaar/Government ID to the vehicle owner for verification.
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={idHoldAgreed}
                          onChange={(e) => setIdHoldAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-brand rounded"
                        />
                        <span className="text-xs text-white/60 leading-relaxed">
                          (Optional) I agree that the vehicle owner may temporarily hold the ID during the active rental period.
                        </span>
                      </label>
                    </div>

                    {/* Checklist */}
                    <div className="card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-white/80 border-b border-white/5 pb-2">Vehicle Condition Checklist</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {HANDOVER_CHECKLIST_ITEMS.map((item) => (
                          <label key={item.key} className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={renterChecklist[item.key]}
                              onChange={(e) => setRenterChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                              className="mt-0.5 w-4 h-4 accent-brand rounded"
                            />
                            <span className="text-xs text-white/70 leading-normal">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Photos */}
                    <div className="card p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-white/80 border-b border-white/5 pb-2">Upload Renter Condition Photos</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { key: 'front', label: 'Front View (Damage Inspection)' },
                          { key: 'side', label: 'Side Views (Damage Inspection)' },
                          { key: 'dashboard', label: 'Dashboard & Fuel Odometer Verification' }
                        ].map(({ key, label }) => (
                          <div key={key} className="card p-4 border border-white/5 bg-surface-1 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-white/80 truncate">{label}</h4>
                              <p className="text-[10px] text-white/40 mt-0.5">JPEG format, under 5MB</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {renterPreviews[key] && (
                                <img src={renterPreviews[key]} alt={label} className="w-10 h-10 rounded-lg object-cover" />
                              )}
                              <label className="cursor-pointer text-[10px] font-bold px-3 py-2 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition">
                                Upload
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handlePhotoUpload(key, e.target.files[0], 'renter')}
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signature */}
                    <div className="card p-5 space-y-4">
                      <label className="label">Renter Digital Signature Pad</label>
                      <div className="relative border border-white/10 bg-surface-2 rounded-xl overflow-hidden aspect-[3/1] max-w-full">
                        <canvas
                          ref={renterCanvasRef}
                          width={500}
                          height={160}
                          onMouseDown={(e) => startDraw(e, renterCanvasRef.current, setRenterDrawing)}
                          onMouseMove={(e) => draw(e, renterCanvasRef.current, renterDrawing)}
                          onMouseUp={() => endDraw(renterCanvasRef.current, setRenterDrawing, setRenterSignature)}
                          onMouseLeave={() => endDraw(renterCanvasRef.current, setRenterDrawing, setRenterSignature)}
                          onTouchStart={(e) => startDraw(e, renterCanvasRef.current, setRenterDrawing)}
                          onTouchMove={(e) => draw(e, renterCanvasRef.current, renterDrawing)}
                          onTouchEnd={() => endDraw(renterCanvasRef.current, setRenterDrawing, setRenterSignature)}
                          className="w-full h-full cursor-crosshair touch-none"
                        />
                        <button
                          onClick={() => clearCanvas(renterCanvasRef.current, setRenterSignature)}
                          className="absolute right-3 bottom-3 text-xs text-white/50 hover:text-white bg-white/5 px-2 py-1 rounded border border-white/5 transition"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Declarations */}
                    <label className="flex items-start gap-3 cursor-pointer card p-4 border border-white/5 hover:border-brand/35 transition">
                      <input
                        type="checkbox"
                        checked={renterDeclaration}
                        onChange={(e) => setRenterDeclaration(e.target.checked)}
                        className="mt-0.5 w-4.5 h-4.5 accent-brand rounded"
                      />
                      <span className="text-xs text-white/80 leading-relaxed">
                        I confirm that I have checked the vehicle condition before starting the ride and I will be responsible for any new damage caused during the rental period.
                      </span>
                    </label>

                    {submitting && (
                      <div className="card p-4 bg-surface-2 flex flex-col items-center justify-center gap-3 text-center py-6">
                        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-semibold text-white">{submittingMsg}</p>
                      </div>
                    )}

                    <button
                      onClick={handleRenterSubmit}
                      disabled={submitting}
                      className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
                    >
                      Confirm Checklist & Accept Handover <FiCheckCircle />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
