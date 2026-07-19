import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiCalendar, FiClock, FiHeart, FiUser, FiX, FiCheck,
  FiArrowRight, FiMapPin, FiStar, FiPhone, FiMail, FiFileText,
  FiAlertCircle, FiTrendingUp, FiDollarSign, FiBell, FiShield,
  FiUpload, FiChevronRight, FiCheckCircle, FiInfo
} from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import { getImageUrl } from '../utils/urlUtils'
import PageWrapper from '../components/PageWrapper'
import useAuthStore from '../store/authStore'
import { BookingCardSkeleton, StatCardSkeleton } from '../components/Skeletons'
import ReviewModal from '../components/ReviewModal'
import {
  subscribeToFavorites,
  toggleFavorite,
  getVehicleById,
  calculateRefund,
  subscribeToUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToSimulatedEmails,
  submitUserKyc,
  updateUserKycStatus,
  sendEmailSimulation,
  updateBookingStatus,
  addNotification
} from '../firebase/firestoreService'
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { paymentAPI, bookingAPI, safetyAPI } from '../api/endpoints'
import DisputeModal from '../components/DisputeModal'

/* ═══════════════════════════════════════════════════════════
   NAVIGATION ITEMS
   ═══════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { key: 'overview',     label: 'Overview',        icon: FiTrendingUp },
  { key: 'requests',     label: 'My Requests',     icon: FiCalendar },
  { key: 'active',       label: 'Active Rentals',   icon: FiClock },
  { key: 'history',      label: 'Rental History',   icon: FiClock },
  { key: 'payments',     label: 'Payments',        icon: FiDollarSign },
  { key: 'saved',        label: 'Saved Vehicles',  icon: FiHeart },
  { key: 'notifications',label: 'Notifications',   icon: FiBell },
  { key: 'kyc',          label: 'KYC Verification',icon: FiShield },
]

/* ═══════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function StatusBadge({ status }) {
  const map = {
    pending_verification: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    under_review:         'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    approved:             'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    accepted:             'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    ongoing:              'bg-brand/10 text-brand border border-brand/20',
    completed:            'bg-green-500/10 text-green-400 border border-green-500/20',
    rejected:             'bg-red-500/10 text-red-400 border border-red-500/20',
    cancelled:            'bg-surface-3 text-white/30 border border-white/5',
    advance_paid:         'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    fully_paid:           'bg-green-500/10 text-green-400 border border-green-500/20',
  }
  const labels = {
    pending_verification: 'Pending Verify',
    under_review:         'Under Review',
    approved:             'Approved',
    accepted:             'Accepted',
    ongoing:              'Active Rental',
    completed:            'Completed',
    rejected:             'Rejected',
    cancelled:            'Cancelled',
    advance_paid:         'Advance Paid',
    fully_paid:           'Fully Paid',
  }
  return (
    <span className={`badge capitalize text-xs ${map[status] || 'bg-surface-3 text-white/30'}`}>
      {labels[status] || status}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, color, bg, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-5 hover:border-white/10 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/40 text-xs font-medium">{label}</span>
        <div className={`${bg} rounded-lg p-2`}>
          <Icon className={`${color} text-lg`} />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </motion.div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = iso.toDate ? iso.toDate() : new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(iso) {
  if (!iso) return ''
  const d = iso.toDate ? iso.toDate() : new Date(iso)
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  })
}

/* ═══════════════════════════════════════════════════════════
   MAIN RENTER DASHBOARD
   ═══════════════════════════════════════════════════════════ */

export default function CustomerDashboard() {
  const { user, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')

  // Real-time lists from Firestore
  const [bookings, setBookings] = useState([])
  const [payments, setPayments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [simulatedEmails, setSimulatedEmails] = useState([])
  const [favoriteIds, setFavoriteIds] = useState([])
  const [favoriteVehicles, setFavoriteVehicles] = useState([])

  // Loaders
  const [loading, setLoading] = useState(true)
  const [favLoading, setFavLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  // Dialog / Modal Selection
  const [inspectBooking, setInspectBooking] = useState(null)
  const [cancelModalBooking, setCancelModalBooking] = useState(null)
  const [reviewBooking, setReviewBooking] = useState(null)
  const [disputeBookingId, setDisputeBookingId] = useState(null)
  const [contactOwnerBooking, setContactOwnerBooking] = useState(null)
  const [simulatedPaymentOrder, setSimulatedPaymentOrder] = useState(null)

  // KYC Submission States
  const [kycType, setKycType] = useState('college_id') // 'college_id' | 'aadhaar'
  const [collegeName, setCollegeName] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [kycFiles, setKycFiles] = useState({ selfie: null, collegeId: null, aadhaarFront: null, aadhaarBack: null })
  const [kycPreviews, setKycPreviews] = useState({ selfie: '', collegeId: '', aadhaarFront: '', aadhaarBack: '' })
  const [kycSubmitting, setKycSubmitting] = useState(false)

  // Developer mode simulation widget
  const [showSimulator, setShowSimulator] = useState(false)

  /* ── REST API Fetch & Short-polling ──────────────────── */

  useEffect(() => {
    if (!user?._id) {
      setLoading(false)
      return
    }

    setLoading(true)
    let bookingsReady = false
    let notificationsReady = false

    const checkReady = () => {
      if (bookingsReady && notificationsReady) setLoading(false)
    }

    const adaptBooking = (b) => {
      const statusMap = {
        requested: 'under_review',
        accepted: 'accepted',
        confirmed: 'advance_paid',
        ready_for_pickup: 'ready_for_pickup',
        ongoing: 'ongoing',
        completed: 'completed',
        cancelled: 'cancelled',
        rejected: 'rejected'
      }
      return {
        ...b,
        bookingStatus: statusMap[b.status] || b.status
      }
    }

    const fetchBookings = async () => {
      try {
        const { data } = await bookingAPI.myBookings()
        setBookings((data.bookings || []).map(adaptBooking))
      } catch (err) {
        console.error('Error loading renter bookings:', err)
      } finally {
        bookingsReady = true
        checkReady()
      }
    }

    const fetchPayments = async () => {
      try {
        const { data } = await paymentAPI.getHistory()
        setPayments(data.history || [])
      } catch (err) {
        console.error('Error fetching payments history:', err)
      }
    }

    fetchBookings()
    fetchPayments()
    const intervalBookings = setInterval(() => {
      fetchBookings()
      fetchPayments()
    }, 5000)

    // Subscribe Favorites
    const unsubFavs = subscribeToFavorites(user._id, (ids) => {
      setFavoriteIds(ids)
    })

    // Subscribe Notifications
    const unsubNotifs = subscribeToUserNotifications(user._id, (data) => {
      setNotifications(data)
      notificationsReady = true
      checkReady()
    })

    return () => {
      clearInterval(intervalBookings)
      unsubFavs()
      unsubNotifs()
    }
  }, [user?._id])

  // Resolve Favorite Vehicles detailed records
  useEffect(() => {
    if (favoriteIds.length === 0) {
      setFavoriteVehicles([])
      setFavLoading(false)
      return
    }

    let cancelled = false
    setFavLoading(true)

    async function fetchFavorites() {
      try {
        const results = await Promise.all(favoriteIds.map(id => getVehicleById(id)))
        if (!cancelled) {
          setFavoriteVehicles(results.filter(Boolean))
        }
      } catch (err) {
        console.error('Error fetching favorites:', err)
      } finally {
        if (!cancelled) setFavLoading(false)
      }
    }

    fetchFavorites()
    return () => { cancelled = true }
  }, [favoriteIds])

  /* ── Automated 24h Reminders checker (Client Side trigger) ───────────────── */

  useEffect(() => {
    if (bookings.length === 0) return

    const now = Date.now()
    const checkReminders = async () => {
      for (const b of bookings) {
        const startMs = new Date(b.startTime).getTime()
        const endMs = new Date(b.endTime).getTime()

        // 1. Pickup Reminder (starts within 24h)
        const diffStartHours = (startMs - now) / (1000 * 60 * 60)
        if (
          diffStartHours > 0 && 
          diffStartHours <= 24 && 
          !b.pickupReminderSent && 
          ['approved', 'accepted'].includes(b.bookingStatus)
        ) {
          console.log(`⏰ [Auto Reminder] Triggering pickup reminder for booking: ${b._id || b.bookingId}`)
          try {
            // Update doc flag first to prevent duplicate trigger loops
            const bRef = doc(db, 'bookings', b._id || b.bookingId)
            await updateDoc(bRef, { pickupReminderSent: true })

            // Send notification
            const title = 'Rental Starts Tomorrow! 🚘'
            const msg = `Get ready! Your rental ride for ${b.vehicleName} starts in less than 24 hours.`
            await sendEmailSimulation(
              b.renterEmail || user?.email || 'renter@lupu.in',
              'Rental Reminder: Pickup Tomorrow - LUPU',
              `<h1>Rental Starts Tomorrow 🚘</h1>
               <p>Hi ${b.renterName},</p>
               <p>This is a reminder that your rental booking for <strong>${b.vehicleName}</strong> starts tomorrow at ${new Date(b.startTime).toLocaleString('en-IN')}.</p>
               <p><strong>Pickup Location:</strong> ${b.pickupInstructions || 'AT Road, Dibrugarh'}</p>
               <p>Please carry your Aadhaar/College ID for owner verification at handover.</p>
               <p>Team LUPU</p>`
            )
          } catch (err) {
            console.error('Reminder trigger error:', err)
          }
        }

        // 2. Return Reminder (ends within 24h)
        const diffEndHours = (endMs - now) / (1000 * 60 * 60)
        if (
          diffEndHours > 0 && 
          diffEndHours <= 24 && 
          !b.returnReminderSent && 
          b.bookingStatus === 'ongoing'
        ) {
          console.log(`⏰ [Auto Reminder] Triggering return reminder for booking: ${b._id || b.bookingId}`)
          try {
            const bRef = doc(db, 'bookings', b._id || b.bookingId)
            await updateDoc(bRef, { returnReminderSent: true })

            await sendEmailSimulation(
              b.renterEmail || user?.email || 'renter@lupu.in',
              'Rental Reminder: Return Tomorrow - LUPU',
              `<h1>Rental Ends Tomorrow ⏰</h1>
               <p>Hi ${b.renterName},</p>
               <p>This is a reminder that your rental for <strong>${b.vehicleName}</strong> is scheduled to end tomorrow at ${new Date(b.endTime).toLocaleString('en-IN')}.</p>
               <p>Please return the vehicle in clean and fueled condition as per terms. Contact the owner ${b.ownerName} at the listed details if you expect delays.</p>
               <p>Team LUPU</p>`
            )
          } catch (err) {
            console.error('Return reminder trigger error:', err)
          }
        }
      }
    }

    checkReminders()
  }, [bookings, user?.email])

  /* ── Derived Metrics & Tabs ─────────────────────────── */

  const activeRentals = useMemo(() => bookings.filter(b => b.bookingStatus === 'ongoing'), [bookings])
  const pendingRequests = useMemo(() => bookings.filter(b => ['pending_verification', 'under_review'].includes(b.bookingStatus)), [bookings])
  const approvedRequests = useMemo(() => bookings.filter(b => ['approved', 'accepted', 'advance_paid'].includes(b.bookingStatus)), [bookings])
  const completedRentals = useMemo(() => bookings.filter(b => ['completed', 'fully_paid'].includes(b.bookingStatus)), [bookings])
  const cancelledRentals = useMemo(() => bookings.filter(b => ['cancelled', 'rejected'].includes(b.bookingStatus)), [bookings])

  /* ── Razorpay Payment Integration ───────────────────── */
  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const saveSuccessfulPayment = async (response, booking, type, amount) => {
    const isAdvance = type === 'advance'
    const verifyToastId = toast.loading('Confirming transaction...')
    try {
      // Call the MongoDB verification backend endpoint
      await paymentAPI.verify({
        bookingId: booking._id || booking.bookingId,
        type,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature
      })

      toast.success('Payment completed successfully!', { id: verifyToastId })

      // Send notifications for payment success
      try {
        const renterId = booking.renterId || user._id
        const renterName = booking.renterName || user.name || 'Renter'
        const ownerId = booking.ownerId
        const vehicleName = booking.vehicleName || 'Vehicle'

        if (isAdvance) {
          // 1. Notify Renter
          await addNotification(renterId, {
            title: 'Advance Payment Successful',
            message: `Your advance payment of ₹${amount} for booking ${vehicleName} was successful!`,
            bookingId: booking._id || booking.bookingId,
            type: 'payment'
          })

          // 2. Notify Owner
          if (ownerId) {
            await addNotification(ownerId, {
              title: 'Advance Payment Received',
              message: `Renter ${renterName} paid the 25% advance of ₹${amount} for ${vehicleName}.`,
              bookingId: booking._id || booking.bookingId,
              type: 'payment'
            })
          }

          // 3. Notify Admin
          await addNotification('admin', {
            title: 'Payment Received',
            message: `Payment of ₹${amount} (Advance) received for booking ${booking._id || booking.bookingId}.`,
            bookingId: booking._id || booking.bookingId,
            type: 'payment'
          })
        } else {
          // 1. Notify Renter
          await addNotification(renterId, {
            title: 'Final Payment Successful',
            message: `Your final payment of ₹${amount} for booking ${vehicleName} was successful!`,
            bookingId: booking._id || booking.bookingId,
            type: 'payment'
          })

          // 2. Notify Owner
          if (ownerId) {
            await addNotification(ownerId, {
              title: 'Final Payment Received',
              message: `Renter ${renterName} paid the 75% final balance of ₹${amount} for ${vehicleName}.`,
              bookingId: booking._id || booking.bookingId,
              type: 'payment'
            })
          }

          // 3. Notify Admin
          await addNotification('admin', {
            title: 'Payment Received',
            message: `Payment of ₹${amount} (Final) received for booking ${booking._id || booking.bookingId}.`,
            bookingId: booking._id || booking.bookingId,
            type: 'payment'
          })
        }
      } catch (notifErr) {
        console.error('Failed to trigger payment notifications:', notifErr)
      }
    } catch (err) {
      console.error('Error handling payment success:', err)
      toast.error('Payment succeeded but failed to update status in database. Contact support.', { id: verifyToastId })
    }
  }

  const handleRazorpayPayment = async (booking, type) => {
    const isAdvance = type === 'advance'
    const amount = isAdvance 
      ? (booking.pricing?.advance || Math.round(booking.totalPrice * 0.25))
      : (booking.pricing?.remaining || Math.round(booking.totalPrice * 0.75))

    const toastId = toast.loading('Initializing secure gateway...')
    try {
      const orderRes = await paymentAPI.createOrder(
        booking._id || booking.bookingId,
        type
      )
      const order = orderRes.data

      toast.dismiss(toastId)

      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID'
      const isMockPayment = order.isMock || !keyId || keyId.startsWith('YOUR_') || keyId === ''

      if (isMockPayment) {
        setSimulatedPaymentOrder({
          order,
          booking,
          type,
          amount
        })
        return
      }

      const loaded = await loadRazorpay()
      if (!loaded) {
        toast.error('Razorpay SDK failed to load. Please check your internet connection.', { id: toastId })
        return
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'LUPU Rentals',
        description: isAdvance ? '25% Booking Advance Payment' : '75% Final Settlement Dues',
        order_id: order.id,
        handler: async function (response) {
          await saveSuccessfulPayment(response, booking, type, amount)
        },
        prefill: {
          name: user.name || '',
          email: user.email || '',
          contact: user.phone || ''
        },
        theme: {
          color: '#ff6b00'
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error('Payment initialization error:', err)
      toast.error(err.response?.data?.message || err.message || 'Failed to initiate payment. Please try again.', { id: toastId })
    }
  }
  
  const totalSpent = useMemo(() => {
    return completedRentals.reduce((sum, b) => sum + (b.totalPrice || 0), 0)
  }, [completedRentals])

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications])

  const overviewStats = [
    { label: 'Active Rentals',   value: activeRentals.length,   icon: FiClock,        color: 'text-brand',      bg: 'bg-brand/10' },
    { label: 'Pending Requests', value: pendingRequests.length, icon: FiCalendar,     color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Approved Requests',value: approvedRequests.length,icon: FiCheck,        color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: 'Completed Rentals',value: completedRentals.length,icon: FiCheckCircle,  color: 'text-green-400',  bg: 'bg-green-500/10' },
    { label: 'Cancelled/Rejected',value: cancelledRentals.length,icon: FiX,           color: 'text-red-400',    bg: 'bg-red-500/10' },
    { label: 'Saved Vehicles',   value: favoriteIds.length,     icon: FiHeart,        color: 'text-red-400',    bg: 'bg-red-500/10' },
    { label: 'Total Spent',      value: `₹${totalSpent.toLocaleString('en-IN')}`, icon: FiDollarSign, color: 'text-green-400', bg: 'bg-green-500/10' }
  ]

  /* ── Action Handlers ───────────────────────────────────── */

  const handleCancelClick = (booking) => {
    setCancelModalBooking(booking)
  }

  const confirmCancel = async () => {
    if (!cancelModalBooking) return
    const bookingId = cancelModalBooking._id || cancelModalBooking.bookingId
    setCancellingId(bookingId)
    setCancelModalBooking(null)
    try {
      await bookingAPI.updateStatus(bookingId, 'cancelled')
      toast.success('Booking cancelled successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to cancel request')
    } finally {
      setCancellingId(null)
    }
  }

  const handleUnfavorite = async (vehicleId) => {
    if (!user?._id) return
    try {
      await toggleFavorite(user._id, vehicleId)
      toast.success('Removed from saved vehicles')
    } catch {
      toast.error('Failed to remove from saved')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(user._id)
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark notifications')
    }
  }

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id)
    } catch {
      // silent fail
    }
  }

  /* ── KYC File Change handler ──────────────────────────── */

  const handleKycFileChange = (key, file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File size must be under 5MB')
    }
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setKycFiles(prev => ({ ...prev, [key]: file }))
      setKycPreviews(prev => ({ ...prev, [key]: reader.result }))
    }
  }

  const handleKycSubmit = async (e) => {
    e.preventDefault()
    if (kycSubmitting) return

    if (!kycFiles.selfie) {
      return toast.error('Please upload a selfie photo')
    }
    if (kycType === 'college_id') {
      if (!collegeName) return toast.error('Please enter your college name')
      if (!kycFiles.collegeId) return toast.error('Please upload your college ID card')
    } else {
      if (!aadhaarNumber || aadhaarNumber.length !== 12) return toast.error('Please enter a 12-digit Aadhaar number')
      if (!kycFiles.aadhaarFront || !kycFiles.aadhaarBack) return toast.error('Please upload Aadhaar front & back images')
    }

    setKycSubmitting(true)
    const toastId = toast.loading('Submitting verification documents...')
    try {
      const kycDetails = kycType === 'college_id' 
        ? { collegeName } 
        : { aadhaarNumber }

      const updatePayload = await submitUserKyc(user._id, {
        kycType,
        kycDetails,
        files: kycFiles
      })

      updateUser(updatePayload)
      toast.success('KYC documents submitted for review! 🎉', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit KYC documents: ' + err.message, { id: toastId })
    } finally {
      setKycSubmitting(false)
    }
  }

  const handleSimulateKycApproval = async (status) => {
    try {
      await updateUserKycStatus(user._id, status)
      updateUser({ kycStatus: status })
      toast.success(`KYC status simulated as ${status.toUpperCase()}!`)
    } catch {
      toast.error('Failed to simulate KYC status change')
    }
  }

  // Active status helper
  const isActiveReturnToday = (endTime) => {
    if (!endTime) return false
    const returnDate = endTime.toDate ? endTime.toDate() : new Date(endTime)
    const today = new Date()
    return (
      returnDate.getDate() === today.getDate() &&
      returnDate.getMonth() === today.getMonth() &&
      returnDate.getFullYear() === today.getFullYear()
    )
  }

  const VehicleIcon = ({ type }) => {
    const Icon = type === 'bike' ? RiMotorbikeLine : RiEBikeLine
    return <Icon className="text-brand text-2xl" />
  }

  return (
    <PageWrapper>
      <div className="container-main py-6 md:py-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Renter Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">
              Welcome back, {user?.name || 'Rider'} 👋
            </p>
          </div>
          
          {/* Developer Simulator Toggle */}
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="btn-secondary text-xs px-4 py-2 border-brand/20 bg-brand/5 text-brand hover:bg-brand/10 w-fit shrink-0"
          >
            {showSimulator ? 'Hide Dev Tools' : 'Show Dev Simulator'}
          </button>
        </div>

        {/* Developer Simulation widget */}
        <AnimatePresence>
          {showSimulator && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 p-5 bg-surface-2 border border-brand/20 rounded-2xl space-y-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 text-brand font-semibold text-sm">
                <FiInfo /> 🛠️ Developer Simulator (Testing on Localhost Only)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-surface border border-white/5 rounded-xl space-y-2">
                  <span className="font-semibold text-white/60">Simulate KYC Approvals:</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleSimulateKycApproval('Verified')} className="px-2 py-1.5 bg-green-500/25 border border-green-500/30 text-green-400 rounded-md font-semibold hover:bg-green-500/35 transition flex-1">Approve KYC</button>
                    <button onClick={() => handleSimulateKycApproval('Rejected')} className="px-2 py-1.5 bg-red-500/25 border border-red-500/30 text-red-400 rounded-md font-semibold hover:bg-red-500/35 transition flex-1">Reject KYC</button>
                  </div>
                </div>

                <div className="p-3 bg-surface border border-white/5 rounded-xl space-y-2">
                  <span className="font-semibold text-white/60">Test Simulated Email reminder:</span>
                  <button
                    onClick={async () => {
                      await sendEmailSimulation(
                        user?.email || 'renter@lupu.in',
                        'Simulated Custom Notification - LUPU',
                        `<h3>Localhost Email Test</h3><p>Dear ${user?.name || 'Rider'}, this is a manually triggered developer email simulation.</p>`
                      )
                      toast.success('Simulation email queued!')
                    }}
                    className="w-full py-1.5 bg-brand/20 border border-brand/30 text-brand rounded-md font-semibold hover:bg-brand/30 transition"
                  >
                    Queue Test Email
                  </button>
                </div>
                
                <div className="p-3 bg-surface border border-white/5 rounded-xl space-y-2">
                  <span className="font-semibold text-white/60">Verification Info:</span>
                  <div className="text-[11px] text-white/40 leading-normal">
                    KYC Status: <strong className="text-white">{user?.kycStatus || 'Not Submitted'}</strong><br/>
                    Email: <strong className="text-white">{user?.email || 'None'}</strong><br/>
                    Phone Verified: <strong className="text-white">{user?.phoneVerified ? 'Yes' : 'No'}</strong>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Navigation Sidebar (Vertical on Desktop, Horizontal Scroll on Mobile) */}
          <aside className="lg:w-64 shrink-0">
            {/* Desktop Navigation */}
            <nav className="hidden lg:block bg-surface rounded-2xl border border-white/5 overflow-hidden sticky top-24">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-all relative ${
                    activeTab === item.key
                      ? 'bg-brand/10 text-brand border-l-2 border-brand'
                      : 'text-white/50 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <item.icon className="text-lg" />
                  {item.label}
                  {item.key === 'notifications' && unreadCount > 0 && (
                    <span className="ml-auto w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Mobile Navigation */}
            <div className="lg:hidden flex gap-1 bg-surface-2 rounded-xl p-1 overflow-x-auto no-scrollbar">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition relative ${
                    activeTab === item.key
                      ? 'bg-brand text-white'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  <item.icon className="text-base" />
                  {item.label}
                  {item.key === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* ═══ MAIN TAB PANEL ═══ */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

              {/* 1. OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {loading 
                      ? [...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)
                      : overviewStats.map((s, i) => (
                          <StatCard key={s.label} {...s} delay={i * 0.04} />
                        ))}
                  </div>

                  {/* KYC Status Reminder Box */}
                  {user?.kycStatus !== 'Verified' && (
                    <div className="card p-5 bg-surface-2 border border-white/5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                          <FiShield className="text-brand" /> Document KYC Verification Required
                        </h4>
                        <p className="text-white/40 text-xs leading-relaxed max-w-lg">
                          Verify your identity using either a College Student ID or Aadhaar Card to bypass file validation at checkout and list or rent vehicles immediately. Status: <strong className="text-brand capitalize">{user?.kycStatus || 'Not Submitted'}</strong>.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('kyc')}
                        className="btn-primary py-2 px-5 text-xs font-semibold w-fit"
                      >
                        Verify KYC Now
                      </button>
                    </div>
                  )}

                  {/* Active Rentals Quick Look */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white/70">Recent Rental Activities</h3>
                    {loading ? (
                      [...Array(2)].map((_, i) => <BookingCardSkeleton key={i} />)
                    ) : bookings.length === 0 ? (
                      <div className="card p-10 text-center text-white/40 text-xs">
                        No recent rentals found. <Link to="/explore" className="text-brand hover:underline">Explore vehicles</Link> to make your first booking!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {bookings.slice(0, 3).map((b) => (
                          <div key={b._id || b.bookingId} className="card p-4 flex items-center justify-between gap-4 bg-surface hover:border-white/10 transition">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center">
                                <VehicleIcon type={b.vehicleType} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm">{b.vehicleName}</h4>
                                <p className="text-[11px] text-white/40">{formatDate(b.startTime)} · {b.ownerName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <StatusBadge status={b.bookingStatus} />
                              <p className="text-white font-bold text-xs mt-1">₹{b.totalPrice}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 2. MY REQUESTS TAB */}
              {activeTab === 'requests' && (
                <motion.div
                  key="requests"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold">My Rental Requests</h2>
                  {loading ? (
                    [...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)
                  ) : bookings.length === 0 ? (
                    <div className="card p-16 text-center text-white/40 text-sm">
                      You have not made any booking requests yet. <Link to="/explore" className="text-brand hover:underline">Browse rides</Link> to start.
                    </div>
                  ) : (
                    bookings.map((b) => {
                      const isPending = ['pending_verification', 'under_review'].includes(b.bookingStatus)
                      return (
                        <div key={b._id || b.bookingId} className="card p-5 space-y-4 hover:border-white/10 transition">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="w-16 h-16 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                                <VehicleIcon type={b.vehicleType} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-base text-white">{b.vehicleName}</h3>
                                  <StatusBadge status={b.bookingStatus} />
                                </div>
                                <p className="text-xs text-white/50">Owner: {b.ownerName} | Location: {b.pickupInstructions || 'AT Road, Dibrugarh'}</p>
                                <p className="text-[11px] text-white/30">
                                  Requested Dates: {formatDate(b.startTime)} ({formatTime(b.startTime)}) → {formatDate(b.endTime)} ({formatTime(b.endTime)})
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-brand font-bold text-lg">₹{b.totalPrice}</p>
                              <p className="text-[10px] text-white/30 mt-1">Requested {formatDate(b.createdAt)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-3 border-t border-white/5 flex-wrap">
                             <button
                               onClick={() => setInspectBooking(b)}
                               className="btn-secondary text-xs py-2 px-4 hover:bg-surface-3 transition"
                             >
                               View Details
                             </button>
                             <button
                               onClick={() => setContactOwnerBooking(b)}
                               className="btn-secondary text-xs py-2 px-4 hover:bg-surface-3 transition"
                             >
                               Contact Owner
                             </button>
                             {isPending && (
                               <button
                                 onClick={() => handleCancelClick(b)}
                                 disabled={cancellingId === (b._id || b.bookingId)}
                                 className="btn-secondary text-xs py-2 px-4 text-red-400 border-red-500/20 hover:bg-red-500/10"
                               >
                                 {cancellingId === (b._id || b.bookingId) ? 'Cancelling…' : 'Cancel Request'}
                               </button>
                             )}
                             {['approved', 'accepted'].includes(b.bookingStatus) && (
                               <button
                                 onClick={() => handleRazorpayPayment(b, 'advance')}
                                 className="btn-primary text-xs py-2 px-4 bg-brand text-white hover:bg-brand-dark transition font-semibold"
                               >
                                 Pay 25% Advance (₹{b.pricing?.advance || Math.round(b.totalPrice * 0.25)})
                               </button>
                             )}
                             {b.bookingStatus === 'completed' && (
                               <button
                                 onClick={() => handleRazorpayPayment(b, 'final')}
                                 className="btn-primary text-xs py-2 px-4 bg-brand text-white hover:bg-brand-dark transition font-semibold"
                               >
                                 Pay Remaining 75% (₹{b.pricing?.remaining || Math.round(b.totalPrice * 0.75)})
                               </button>
                             )}
                             <button
                               onClick={() => setDisputeBookingId(b._id || b.bookingId)}
                               className="btn-secondary text-xs py-2 px-4 text-red-400/80 border-white/5 hover:bg-red-500/10 hover:text-red-400 transition"
                             >
                               Dispute
                             </button>
                           </div>
                        </div>
                      )
                    })
                  )}
                </motion.div>
              )}

              {/* 3. ACTIVE RENTALS TAB */}
              {activeTab === 'active' && (
                <motion.div
                  key="active"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand animate-pulse" /> Active Rentals
                  </h2>

                  {loading ? (
                    [...Array(2)].map((_, i) => <BookingCardSkeleton key={i} />)
                  ) : activeRentals.length === 0 ? (
                    <div className="card p-16 text-center text-white/40 text-sm">
                      No active rentals running at the moment.
                    </div>
                  ) : (
                    activeRentals.map((b) => {
                      const isReturnToday = isActiveReturnToday(b.endTime)
                      return (
                        <div key={b._id || b.bookingId} className="card p-5 border-l-4 border-brand space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="w-14 h-14 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                                <VehicleIcon type={b.vehicleType} />
                              </div>
                              <div className="space-y-1">
                                <h3 className="font-bold text-base">{b.vehicleName}</h3>
                                <p className="text-xs text-white/45">Owner: {b.ownerName}</p>
                                <p className="text-xs text-white/30">
                                  Period: {formatDate(b.startTime)} → {formatDate(b.endTime)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`badge text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isReturnToday 
                                  ? 'bg-red-500/25 text-red-400 border border-red-500/30 animate-pulse' 
                                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
                              }`}>
                                {isReturnToday ? 'Return Today ⚠️' : 'Active'}
                              </span>
                              <p className="text-brand font-bold text-base mt-2">₹{b.totalPrice}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                            <Link
                              to={`/handover/${b._id || b.bookingId}`}
                              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                            >
                              <FiCheckCircle /> Handover & Return Checklist
                            </Link>
                            <button
                              onClick={() => setContactOwnerBooking(b)}
                              className="btn-secondary text-xs py-2 px-4"
                            >
                              Contact Owner
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </motion.div>
              )}

              {/* 4. RENTAL HISTORY TAB */}
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold">Rental History</h2>
                  {loading ? (
                    [...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)
                  ) : completedRentals.length === 0 && cancelledRentals.length === 0 ? (
                    <div className="card p-16 text-center text-white/40 text-sm">
                      No past rental history found.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {completedRentals.map((b) => (
                        <div key={b._id || b.bookingId} className="card p-5 hover:border-white/10 transition border-l-4 border-green-500/30 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                                <VehicleIcon type={b.vehicleType} />
                              </div>
                              <div className="space-y-0.5">
                                <h3 className="font-semibold text-white">{b.vehicleName}</h3>
                                <p className="text-xs text-white/40">Owner: {b.ownerName}</p>
                                <p className="text-[11px] text-white/30">Rental Period: {formatDate(b.startTime)} → {formatDate(b.endTime)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <StatusBadge status={b.bookingStatus} />
                              <p className="text-white font-bold text-xs mt-1.5">Amount Paid: ₹{b.totalPrice}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                            <Link to={`/vehicles/${b.vehicleId}`} className="btn-secondary text-xs py-2 px-4 text-brand">Book Again</Link>
                            <button
                              onClick={() => setReviewBooking(b)}
                              className="btn-secondary text-xs py-2 px-4 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10 flex items-center gap-1.5"
                            >
                              <FiStar /> Write Review
                            </button>
                            {b.bookingStatus === 'completed' && (
                              <button
                                onClick={() => handleRazorpayPayment(b, 'final')}
                                className="btn-primary text-xs py-2 px-4 bg-brand text-white hover:bg-brand-dark transition font-semibold"
                              >
                                Pay Remaining 75% (₹{b.pricing?.remaining || Math.round(b.totalPrice * 0.75)})
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {cancelledRentals.map((b) => (
                        <div key={b._id || b.bookingId} className="card p-5 hover:border-white/10 transition opacity-60 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                                <VehicleIcon type={b.vehicleType} />
                              </div>
                              <div className="space-y-0.5">
                                <h3 className="font-semibold text-white/60">{b.vehicleName}</h3>
                                <p className="text-xs text-white/40">Owner: {b.ownerName}</p>
                                <p className="text-[11px] text-white/30">Period: {formatDate(b.startTime)} → {formatDate(b.endTime)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <StatusBadge status={b.bookingStatus} />
                              <p className="text-white/40 font-semibold text-xs mt-1.5">Value: ₹{b.totalPrice}</p>
                            </div>
                          </div>
                          {b.refundAmount !== undefined && (
                            <p className="text-[11px] text-green-400/80 bg-green-500/5 px-2 py-1 rounded w-fit border border-green-500/10">
                              Refund Status: ₹{b.refundAmount} ({b.refundPolicyApplied})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 5. PAYMENTS TAB */}
              {activeTab === 'payments' && (
                <motion.div
                  key="payments"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <h2 className="text-lg font-semibold">Payment Operations & Receipts</h2>

                  {/* Summary row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card p-4 space-y-1">
                      <span className="text-white/30 text-xs">Completed Payments</span>
                      <p className="text-xl font-bold text-green-400">₹{totalSpent.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="card p-4 space-y-1">
                      <span className="text-white/30 text-xs">Pending (Pay at Pickup)</span>
                      <p className="text-xl font-bold text-yellow-400">
                        ₹{bookings
                          .filter(b => ['approved', 'accepted', 'ongoing'].includes(b.bookingStatus))
                          .reduce((sum, b) => sum + (b.pricing?.remaining || Math.round(b.totalPrice * 0.75)), 0)
                          .toLocaleString('en-IN')
                        }
                      </p>
                    </div>
                    <div className="card p-4 space-y-1">
                      <span className="text-white/30 text-xs">Total Refunded</span>
                      <p className="text-xl font-bold text-blue-400">
                        ₹{bookings
                          .filter(b => b.bookingStatus === 'cancelled' && b.refundAmount > 0)
                          .reduce((sum, b) => sum + (b.refundAmount || 0), 0)
                          .toLocaleString('en-IN')
                        }
                      </p>
                    </div>
                  </div>

                  {/* Transaction log */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white/75">Transaction History Log</h3>
                    {payments.length === 0 ? (
                      <div className="card p-10 text-center text-white/40 text-xs">
                        No payment transaction history records located.
                      </div>
                    ) : (
                      <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="p-3 text-white/40">Txn Date</th>
                                <th className="p-3 text-white/40">Booking Ref</th>
                                <th className="p-3 text-white/40">Description</th>
                                <th className="p-3 text-white/40 text-right">Amount</th>
                                <th className="p-3 text-white/40 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map((p) => (
                                <tr key={p._id} className="border-b border-white/5 hover:bg-white/[0.01] transition last:border-0">
                                  <td className="p-3 text-white/60 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                                  <td className="p-3 font-mono text-[10px] text-white/40 whitespace-nowrap">{p.bookingId?.substring(0, 15)}...</td>
                                  <td className="p-3 text-white font-medium">{p.description}</td>
                                  <td className={`p-3 text-right font-bold ${p.type === 'refund' ? 'text-blue-400' : 'text-green-400'}`}>
                                    {p.type === 'refund' ? '-' : ''}₹{p.amount}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] capitalize">{p.status}</span>
                                      {p.status === 'success' && (
                                        <a
                                          href={`${import.meta.env.VITE_API_URL || '/api'}/payments/${p._id || p.transactionId}/invoice`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-brand hover:underline font-semibold text-[10px]"
                                        >
                                          Invoice
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 6. SAVED VEHICLES TAB */}
              {activeTab === 'saved' && (
                <motion.div
                  key="saved"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FiHeart className="text-red-400 fill-current" /> Saved Vehicles
                  </h2>

                  {favLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="card p-4 space-y-3">
                          <div className="skeleton h-28 rounded-xl" />
                          <div className="skeleton h-4 w-3/4" />
                          <div className="skeleton h-3 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : favoriteVehicles.length === 0 ? (
                    <div className="card p-16 text-center text-white/40 text-sm">
                      No vehicles saved yet. Click the heart icon on vehicle detail pages to bookmark listings.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {favoriteVehicles.map((v) => {
                        const Icon = v.type === 'bike' ? RiMotorbikeLine : RiEBikeLine
                        return (
                          <div key={v._id} className="card p-4 relative group hover:border-white/10 transition">
                            <button
                              onClick={() => handleUnfavorite(v._id)}
                              className="absolute top-3 right-3 p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition z-10"
                            >
                              <FiHeart className="fill-current text-sm" />
                            </button>

                            <Link to={`/vehicles/${v._id}`} className="block space-y-3">
                              <div className="w-full aspect-video rounded-xl bg-surface-2 overflow-hidden relative">
                                {v.images?.[0] ? (
                                  <img src={getImageUrl(v.images[0])} alt={v.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Icon className="text-white/10 text-4xl" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm truncate pr-6">{v.name}</h4>
                                <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5"><FiMapPin size={10} /> {v.location}</p>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                <span className="text-brand font-bold text-xs">₹{v.pricePerHour}/hr</span>
                                <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-md font-semibold">Rent Now</span>
                              </div>
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 7. NOTIFICATIONS TAB */}
              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FiBell className="text-brand" /> Notifications
                      {unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{unreadCount} new</span>}
                    </h2>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-brand hover:underline">Mark all read</button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="card p-12 text-center text-white/40 text-sm">
                      No notifications received.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => !n.read && handleMarkRead(n._id)}
                          className={`card p-4 flex gap-3 cursor-pointer transition ${
                            !n.read ? 'border-brand/20 bg-brand/5' : 'hover:bg-surface-2'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!n.read ? 'bg-brand/20' : 'bg-surface-2'}`}>
                            <FiBell className={!n.read ? 'text-brand' : 'text-white/30'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-xs font-semibold ${!n.read ? 'text-white' : 'text-white/60'}`}>{n.title}</h4>
                            <p className="text-[11px] text-white/40 mt-0.5">{n.message}</p>
                            <span className="text-[9px] text-white/20 mt-1 block">{formatDate(n.createdAt)}</span>
                          </div>
                          {!n.read && <span className="w-1.5 h-1.5 bg-brand rounded-full mt-2 self-start shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 8. KYC VERIFICATION TAB */}
              {activeTab === 'kyc' && (
                <motion.div
                  key="kyc"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <h2 className="text-lg font-semibold flex items-center gap-2"><FiShield className="text-brand" /> Identity Document Verification</h2>

                  {/* Current Status Banner */}
                  <div className="card p-5 bg-surface-2 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/40">Current KYC Verification Status:</span>
                      <span className={`badge font-semibold text-xs border ${
                        user?.kycStatus === 'Verified' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        user?.kycStatus === 'Under Review' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse' :
                        user?.kycStatus === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-surface-3 text-white/40 border-white/10'
                      }`}>
                        {user?.kycStatus || 'Not Submitted'}
                      </span>
                    </div>
                    {user?.kycStatus === 'Verified' && (
                      <p className="text-xs text-white/40 pt-2 border-t border-white/5 text-green-400/80">
                        ✅ Your profile is fully verified! You can proceed to book any vehicle on the platform instantly without uploading document attachments.
                      </p>
                    )}
                  </div>

                  {/* Form Submission */}
                  {user?.kycStatus !== 'Verified' && (
                    <form onSubmit={handleKycSubmit} className="space-y-5">
                      <div className="pt-2">
                        <label className="label">Verification Type Choice</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setKycType('college_id')}
                            className={`py-3 rounded-xl border text-sm font-semibold transition ${
                              kycType === 'college_id'
                                ? 'border-brand bg-brand/10 text-white'
                                : 'border-white/10 bg-surface-2 text-white/40 hover:text-white'
                            }`}
                          >
                            College ID Card
                          </button>
                          <button
                            type="button"
                            onClick={() => setKycType('aadhaar')}
                            className={`py-3 rounded-xl border text-sm font-semibold transition ${
                              kycType === 'aadhaar'
                                ? 'border-brand bg-brand/10 text-white'
                                : 'border-white/10 bg-surface-2 text-white/40 hover:text-white'
                            }`}
                          >
                            Aadhaar Card
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Inputs */}
                      {kycType === 'college_id' ? (
                        <div>
                          <label className="label">College/University Name</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Dibrugarh University, IIT Guwahati"
                            value={collegeName}
                            onChange={(e) => setCollegeName(e.target.value)}
                            required
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="label">12-Digit Aadhaar Card Number</label>
                          <input
                            type="text"
                            maxLength={12}
                            className="input-field font-mono tracking-widest text-center"
                            placeholder="e.g. 123456789012"
                            value={aadhaarNumber}
                            onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                            required
                          />
                        </div>
                      )}

                      {/* File uploads */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white/70">Required Documents Upload</h4>
                        
                        {[
                          { key: 'selfie', label: 'Selfie Photo Portrait', show: true },
                          { key: 'collegeId', label: 'College Student ID Card', show: kycType === 'college_id' },
                          { key: 'aadhaarFront', label: 'Aadhaar Card Front Side', show: kycType === 'aadhaar' },
                          { key: 'aadhaarBack', label: 'Aadhaar Card Back Side', show: kycType === 'aadhaar' }
                        ].map(({ key, label, show }) => {
                          if (!show) return null
                          return (
                            <div key={key} className="card p-4 border border-white/5 bg-surface-1 flex items-center justify-between gap-4">
                              <div>
                                <h5 className="text-xs font-semibold text-white/80">{label}</h5>
                                <p className="text-[10px] text-white/40 mt-0.5">Under 5MB. JPEG/PNG format preferred.</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {kycPreviews[key] && (
                                  <img src={kycPreviews[key]} alt="Preview" className="w-10 h-10 rounded object-cover border border-white/10" />
                                )}
                                <label className={`cursor-pointer text-[11px] font-semibold px-4 py-2 rounded-xl transition ${
                                  kycFiles[key] ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20'
                                }`}>
                                  {kycFiles[key] ? 'Replace' : 'Upload'}
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleKycFileChange(key, e.target.files[0])} />
                                </label>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <button
                        type="submit"
                        disabled={kycSubmitting}
                        className="btn-primary w-full py-3 mt-4"
                      >
                        {kycSubmitting ? 'Submitting details…' : 'Submit for Verification'}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}



            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════ */}

      {/* Booking Details Inspector Modal */}
      <AnimatePresence>
        {inspectBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card max-w-lg w-full p-6 space-y-5 border border-white/10"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FiInfo className="text-brand" /> Rental Booking Specification
                </h3>
                <button onClick={() => setInspectBooking(null)} className="btn-ghost p-2 text-white/50 hover:text-white"><FiX size={18} /></button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div>
                  <span className="text-white/40 block">Vehicle Information:</span>
                  <span className="text-white font-semibold">{inspectBooking.vehicleName} ({inspectBooking.vehicleType})</span>
                </div>
                <div>
                  <span className="text-white/40 block">Owner Contact Details:</span>
                  <span className="text-white font-semibold">{inspectBooking.ownerName}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Rental Timeframe:</span>
                  <span className="text-white font-semibold">
                    {formatDate(inspectBooking.startTime)} → {formatDate(inspectBooking.endTime)}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Pickup & Return Instructions:</span>
                  <span className="text-white font-medium">{inspectBooking.pickupInstructions || 'AT Road, Dibrugarh. Please contact the owner at pickup to verify ID cards.'}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Advance Payment Details:</span>
                  <span className="text-white font-semibold">
                    Total: ₹{inspectBooking.totalPrice} | Paid: ₹{inspectBooking.pricing?.advance || Math.round(inspectBooking.totalPrice * 0.25)} | Balance Due: ₹{inspectBooking.pricing?.remaining || Math.round(inspectBooking.totalPrice * 0.75)}
                  </span>
                </div>
                {inspectBooking.verificationDetails?.verificationPdfUrl && (
                  <div className="pt-2">
                    <a
                      href={inspectBooking.verificationDetails.verificationPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary w-full py-2 flex items-center justify-center gap-1.5 text-xs text-brand border-brand/20 bg-brand/5"
                    >
                      <FiFileText /> View Rental Agreement (PDF)
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancellation Confirmation Modal */}
      <AnimatePresence>
        {cancelModalBooking && (() => {
          const refundResult = calculateRefund(cancelModalBooking, 'renter')
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card max-w-md w-full p-6 space-y-4 border border-white/10"
              >
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiAlertCircle className="text-red-400" /> Confirm Cancellation
                </h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Are you sure you want to cancel your booking for <strong>{cancelModalBooking.vehicleName}</strong>?
                </p>

                <div className="p-4 rounded-xl bg-surface-2 border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Total Booking Price:</span>
                    <span className="font-semibold text-white">₹{cancelModalBooking.totalPrice}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/60">
                    <span>Advance Payment Paid:</span>
                    <span className="font-semibold text-white">₹{cancelModalBooking.pricing?.advance || Math.round(cancelModalBooking.totalPrice * 0.25)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                    <span className="text-green-400 font-medium">Refund Amount:</span>
                    <span className="font-bold text-green-400">₹{refundResult.refundAmount}</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-[11px] text-red-300">
                  ⚠️ <strong>Refund Policy applied:</strong> {refundResult.policy}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCancelModalBooking(null)} className="btn-secondary w-1/2 py-2.5">Keep Booking</button>
                  <button onClick={confirmCancel} className="btn-primary bg-red-600 hover:bg-red-700 w-1/2 py-2.5">Confirm Cancel</button>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      {/* Owner Contact details Modal */}
      <AnimatePresence>
        {contactOwnerBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card max-w-sm w-full p-6 text-center space-y-4 border border-white/10"
            >
              <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <FiUser className="text-brand text-2xl" />
              </div>
              <h3 className="text-base font-bold text-white">Owner Contact Details</h3>
              
              <div className="p-4 rounded-xl bg-surface-2 border border-white/5 space-y-3 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Owner Name:</span>
                  <span className="font-semibold text-white">{contactOwnerBooking.ownerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Phone Number:</span>
                  <a href="tel:+919876543211" className="font-semibold text-brand hover:underline">+91 98765 43211</a>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Email:</span>
                  <span className="font-semibold text-white">owner@lupu.in</span>
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg text-[10px] text-white/35">
                💬 Direct Chat messaging is coming soon to the LUPU mobile experience.
              </div>

              <button onClick={() => setContactOwnerBooking(null)} className="btn-secondary w-full py-2.5">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Razorpay Simulated Checkout Modal */}
      <AnimatePresence>
        {simulatedPaymentOrder && (() => {
          const { order, booking, type, amount } = simulatedPaymentOrder
          const isAdvance = type === 'advance'
          
          const handleSimulatedSuccess = async () => {
            const mockResponse = {
              razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
              razorpay_order_id: order.id,
              razorpay_signature: `sig_mock_${Math.random().toString(36).substring(2, 11)}`
            }
            setSimulatedPaymentOrder(null)
            await saveSuccessfulPayment(mockResponse, booking, type, amount)
          }

          const handleSimulatedFailure = () => {
            setSimulatedPaymentOrder(null)
            toast.error('Payment cancelled or failed by user')
          }

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-md bg-[#121214] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
              >
                {/* Header */}
                <div className="bg-[#1a1a1e] px-6 py-5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center font-bold text-white text-base">
                      L
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide">Razorpay Checkout</h3>
                      <p className="text-[10px] text-green-400 font-semibold tracking-wider uppercase">Sandbox / Test Mode</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-white/5 text-[10px] text-white/50 font-mono">
                    {order.id}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-white text-base">
                        {isAdvance ? 'Booking Advance Payment (25%)' : 'Remaining Ride Balance (75%)'}
                      </h4>
                      <p className="text-xs text-white/40 mt-1">LUPU Rental Services</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-brand">₹{amount}</div>
                      <div className="text-[10px] text-white/30 font-medium mt-0.5">INR</div>
                    </div>
                  </div>

                  {/* Customer Prefill Info */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Customer Name</span>
                      <span className="font-medium text-white">{user.name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Email Address</span>
                      <span className="font-medium text-white">{user.email}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Contact Phone</span>
                      <span className="font-medium text-white">{user.phone || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-brand/5 border border-brand/20 rounded-xl text-[11px] text-brand/90 leading-relaxed">
                    💡 <strong>Local Test Sandbox:</strong> Real credentials were not detected in your `.env`. You can securely test the booking state transition and Firestore logs by simulating this payment.
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-[#1a1a1e] border-t border-white/5 flex gap-3">
                  <button
                    onClick={handleSimulatedFailure}
                    className="w-1/3 py-3 rounded-xl border border-white/10 text-xs font-semibold text-white/70 hover:bg-white/5 transition"
                  >
                    Cancel / Fail
                  </button>
                  <button
                    onClick={handleSimulatedSuccess}
                    className="w-2/3 py-3 rounded-xl bg-brand hover:bg-brand-hover text-xs font-bold text-white shadow-lg shadow-brand/20 transition flex items-center justify-center gap-1.5"
                  >
                    Simulate Success (Pay ₹{amount})
                  </button>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      {/* Review & Star Rating Modal */}
      <ReviewModal
        isOpen={!!reviewBooking}
        onClose={() => setReviewBooking(null)}
        booking={reviewBooking}
        currentUser={user}
        role="renter"
      />

      {/* Dispute Modal */}
      <DisputeModal
        isOpen={!!disputeBookingId}
        onClose={() => setDisputeBookingId(null)}
        bookingId={disputeBookingId}
      />

    </PageWrapper>
  )
}
