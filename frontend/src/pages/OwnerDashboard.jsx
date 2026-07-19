import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiUpload,
  FiTrendingUp, FiCalendar, FiPackage, FiX, FiCheck,
  FiGrid, FiSettings, FiCheckCircle, FiXCircle,
  FiClock, FiDollarSign, FiActivity, FiStar, FiPlay, FiAlertCircle,
  FiFileText, FiUser, FiMapPin, FiBell, FiChevronDown
} from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import { addVehicleSchema } from '../utils/schemas'
import useAuthStore from '../store/authStore'
import { StatCardSkeleton, BookingCardSkeleton } from '../components/Skeletons'
import {
  subscribeToUserNotifications, markNotificationRead, markAllNotificationsRead
} from '../firebase/firestoreService'
import { vehicleAPI, bookingAPI } from '../api/endpoints'
import ReviewModal from '../components/ReviewModal'
import EditVehicleModal from '../components/EditVehicleModal'
import DisputeModal from '../components/DisputeModal'
import { getImageUrl } from '../utils/urlUtils'

/* ═══════════════════════════════════════════════════════════
   NAVIGATION ITEMS
   ═══════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { key: 'overview',      label: 'Overview',          icon: FiGrid },
  { key: 'vehicles',      label: 'My Vehicles',       icon: FiPackage },
  { key: 'bookings',      label: 'Booking Requests',  icon: FiCalendar },
  { key: 'notifications', label: 'Notifications',     icon: FiBell },
  { key: 'earnings',      label: 'Earnings',          icon: FiDollarSign },
  { key: 'settings',      label: 'Settings',          icon: FiSettings },
]

/* ═══════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function StatusBadge({ status }) {
  const map = {
    pending_verification: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    under_review:         'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    approved:             'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    accepted:             'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    ongoing:              'bg-brand/10 text-brand border border-brand/20',
    completed:            'bg-green-500/10 text-green-400 border border-green-400/20',
    rejected:             'bg-red-500/10 text-red-400 border border-red-500/20',
    cancelled:            'bg-surface-3 text-white/30 border border-white/5',
    live:                 'bg-green-500/10 text-green-400 border border-green-400/20',
    offline:              'bg-red-500/10 text-red-400 border border-red-500/20',
    booked:               'bg-brand/10 text-brand border border-brand/20',
    deleted:              'bg-surface-3 text-white/20 border border-white/5',
    advance_paid:         'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    fully_paid:           'bg-green-500/10 text-green-400 border border-green-400/20',
  }
  const labels = {
    pending_verification: 'Pending Verify',
    under_review:         'Under Review',
    approved:             'Approved',
    accepted:             'Accepted',
    ongoing:              'Ongoing',
    completed:            'Completed',
    rejected:             'Rejected',
    cancelled:            'Cancelled',
    live:                 'Live',
    offline:              'Offline',
    booked:               'Booked',
    deleted:              'Deleted',
    advance_paid:         'Advance Paid',
    fully_paid:           'Fully Paid',
  }
  return (
    <span className={`badge capitalize text-xs ${map[status] || 'bg-surface-3 text-white/30'}`}>
      {labels[status] || status}
    </span>
  )
}
function LiveToggle({ vehicle, onToggle }) {
  const [toggling, setToggling] = useState(false)
  const isLive = vehicle.isLive !== false

  const handleToggle = async () => {
    setToggling(true)
    try {
      await vehicleAPI.toggleStatus(vehicle._id || vehicle.id)
      onToggle?.()
      toast.success(isLive ? 'Vehicle is now OFFLINE' : 'Vehicle is now LIVE')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle status')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`status-dot ${isLive ? 'status-dot--live' : 'status-dot--offline'}`} />
      <button
        onClick={handleToggle}
        disabled={toggling || (vehicle.verificationStatus || vehicle.status) !== 'approved'}
        className={`toggle-switch ${isLive ? 'toggle-switch--on' : 'toggle-switch--off'} ${
          (vehicle.verificationStatus || vehicle.status) !== 'approved' ? 'opacity-30 cursor-not-allowed' : ''
        }`}
        title={(vehicle.verificationStatus || vehicle.status) !== 'approved' ? 'Only approved vehicles can go live' : (isLive ? 'Set Offline' : 'Set Live')}
      >
        <div className="toggle-switch__knob" />
      </button>
      <span className={`text-xs font-semibold uppercase tracking-wider ${
        isLive ? 'text-green-400' : 'text-red-400'
      }`}>
        {isLive ? 'Live' : 'Offline'}
      </span>
    </div>
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

/* ═══════════════════════════════════════════════════════════
   ADD VEHICLE MODAL
   ═══════════════════════════════════════════════════════════ */
function AddVehicleModal({ onClose, onSuccess, userId, userName }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(addVehicleSchema),
    defaultValues: { type: 'bike', helmetAvailable: false },
  })
  const [submitting, setSubmitting] = useState(false)
  const [rcFile, setRcFile] = useState(null)
  const [insFile, setInsFile] = useState(null)
  const [pucFile, setPucFile] = useState(null)
  const [photoFiles, setPhotoFiles] = useState([])

  const onSubmit = async (data) => {
    if (!rcFile) {
      toast.error('Registration Certificate (RC) document file is required')
      return
    }
    if (!insFile) {
      toast.error('Insurance document file is required')
      return
    }
    if (!pucFile) {
      toast.error('Pollution Certificate (PUC) document file is required')
      return
    }
    if (photoFiles.length < 3) {
      toast.error('At least 3 vehicle photos are required')
      return
    }

    setSubmitting(true)
    const toastId = toast.loading('Listing vehicle for verification...')
    try {
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('brand', data.brand)
      formData.append('model', data.model)
      formData.append('type', data.type)
      formData.append('registrationNumber', data.registrationNumber)
      formData.append('pricePerHour', data.pricePerHour)
      formData.append('pricePerDay', data.pricePerDay || 0)
      formData.append('securityDeposit', data.securityDeposit || 0)
      formData.append('location', data.location)
      formData.append('description', data.description)
      formData.append('year', data.year || new Date().getFullYear())
      formData.append('fuel', data.fuel || 'Petrol')
      formData.append('transmission', data.transmission || (data.type === 'scooty' ? 'Automatic' : 'Manual'))
      formData.append('helmetAvailable', data.helmetAvailable ? 'true' : 'false')
      formData.append('verificationStatus', 'submitted')

      formData.append('RC', rcFile)
      formData.append('Insurance', insFile)
      formData.append('PUC', pucFile)

      photoFiles.forEach(file => {
        formData.append('photos', file)
      })

      await vehicleAPI.create(formData)
      toast.success(
        <div>
          <p className="font-bold">Vehicle Submitted Successfully</p>
          <p className="text-xs opacity-90">Status: Pending Verification</p>
        </div>,
        { id: toastId, duration: 5000 }
      )
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to list vehicle. Please try again.', { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm text-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10 bg-[#111111] border border-white/10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">List a Vehicle</h2>
          <button onClick={onClose} className="btn-ghost p-2"><FiX /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vehicle Name</label>
              <input className="input-field text-xs" placeholder="e.g. Classic Cruiser" {...register('name')} />
              {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Brand</label>
              <input className="input-field text-xs" placeholder="e.g. Royal Enfield" {...register('brand')} />
              {errors.brand && <p className="text-red-400 text-[10px] mt-1">{errors.brand.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Model</label>
              <input className="input-field text-xs" placeholder="e.g. Classic 350" {...register('model')} />
              {errors.model && <p className="text-red-400 text-[10px] mt-1">{errors.model.message}</p>}
            </div>
            <div>
              <label className="label">Registration Number</label>
              <input className="input-field text-xs" placeholder="AS-06-K-1234" {...register('registrationNumber')} />
              {errors.registrationNumber && <p className="text-red-400 text-[10px] mt-1">{errors.registrationNumber.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input-field text-xs" {...register('type')}>
                <option value="bike">Bike</option>
                <option value="scooty">Scooty</option>
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input-field text-xs" placeholder="2022" {...register('year')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price/Hour (₹)</label>
              <input type="number" className="input-field text-xs" placeholder="80" {...register('pricePerHour')} />
              {errors.pricePerHour && <p className="text-red-400 text-[10px] mt-1">{errors.pricePerHour.message}</p>}
            </div>
            <div>
              <label className="label">Price/Day (₹)</label>
              <input type="number" className="input-field text-xs" placeholder="500" {...register('pricePerDay')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Security Deposit (₹)</label>
              <input type="number" className="input-field text-xs" placeholder="1000" {...register('securityDeposit')} />
            </div>
            <div>
              <label className="label">Pickup Location</label>
              <input className="input-field text-xs" placeholder="AT Road, Dibrugarh" {...register('location')} />
              {errors.location && <p className="text-red-400 text-[10px] mt-1">{errors.location.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fuel Type</label>
              <input className="input-field text-xs" placeholder="Petrol" {...register('fuel')} />
            </div>
            <div>
              <label className="label">Transmission</label>
              <select className="input-field text-xs" {...register('transmission')}>
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea rows={3} className="input-field resize-none text-xs p-2" placeholder="Condition, specifications, helmet policy..." {...register('description')} />
            {errors.description && <p className="text-red-400 text-[10px] mt-1">{errors.description.message}</p>}
          </div>

          <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/5 rounded-xl">
            <input type="checkbox" id="helmet" className="w-4 h-4 rounded accent-brand" {...register('helmetAvailable')} />
            <label htmlFor="helmet" className="text-white/80 font-medium">Helmet Available with ride</label>
          </div>

          {/* Upload compliance files */}
          <div className="space-y-2.5 bg-white/5 p-3 rounded-xl border border-white/5">
            <h4 className="font-semibold text-white/70">Upload Verification Documents (PDF / Image)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Registration (RC) *</label>
                <input type="file" accept="image/*,.pdf" required className="input-field p-1 text-[10px]" onChange={(e) => setRcFile(e.target.files[0])} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Insurance Policy *</label>
                <input type="file" accept="image/*,.pdf" required className="input-field p-1 text-[10px]" onChange={(e) => setInsFile(e.target.files[0])} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Pollution (PUC) *</label>
                <input type="file" accept="image/*,.pdf" required className="input-field p-1 text-[10px]" onChange={(e) => setPucFile(e.target.files[0])} />
              </div>
            </div>
          </div>

          {/* Upload Photos */}
          <div>
            <label className="label">Photos (Minimum 3) *</label>
            <label
              htmlFor="veh-images"
              className="flex flex-col items-center gap-1.5 border-2 border-dashed border-white/10 rounded-xl p-4 cursor-pointer hover:border-white/20 bg-surface-2 transition text-center"
            >
              <FiUpload className="text-white/30 text-lg" />
              <span className="text-xs text-white/40">
                {photoFiles.length > 0 ? `${photoFiles.length} file(s) selected` : 'Select vehicle photos'}
              </span>
              <input id="veh-images" type="file" accept="image/*" multiple required className="hidden" onChange={(e) => setPhotoFiles(Array.from(e.target.files))} />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 font-semibold">
              {submitting ? 'Submitting…' : 'Submit for Verification'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   DELETE CONFIRMATION MODAL
   ═══════════════════════════════════════════════════════════ */

function DeleteConfirmModal({ vehicleName, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card max-w-md w-full p-6 text-center"
      >
        <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FiTrash2 className="text-red-400 text-2xl" />
        </div>
        <h3 className="text-lg font-bold mb-2">Remove Vehicle?</h3>
        <p className="text-white/40 text-sm mb-6">
          Are you sure you want to remove <span className="text-white font-medium">{vehicleName}</span>? It will be hidden from Explore Rentals.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={deleting}>Cancel</button>
          <button
            onClick={async () => {
              setDeleting(true)
              await onConfirm()
              setDeleting(false)
            }}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 active:scale-95 flex-1"
          >
            {deleting ? 'Removing…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function OwnerDashboard() {
  const { user, isKycComplete } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [completedBookings, setCompletedBookings] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editVehicle, setEditVehicle] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bookingFilter, setBookingFilter] = useState('all')
  const [reviewBooking, setReviewBooking] = useState(null)
  const [disputeBookingId, setDisputeBookingId] = useState(null)
  const [vehicleFilter, setVehicleFilter] = useState(null) // filter bookings by vehicle

  // Document Inspection modal state
  const [inspectBooking, setInspectBooking] = useState(null)
  const [requestInfoText, setRequestInfoText] = useState('')
  const [showingRequestInput, setShowingRequestInput] = useState(false)

  // Fetch owner's vehicles from Express API
  const loadOwnerVehicles = async () => {
    try {
      const res = await vehicleAPI.myVehicles()
      setVehicles(res.data.vehicles || [])
    } catch (err) {
      console.error('Failed to load owner vehicles:', err)
    }
  }

  useEffect(() => {
    if (!user?._id) {
      setLoading(false)
      return
    }

    let bookingsLoaded = false

    loadOwnerVehicles().then(() => {
      if (bookingsLoaded) setLoading(false)
    })

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
        const { data } = await bookingAPI.getAll()
        const ownerBookings = (data.bookings || []).filter(b => b.ownerId === user._id)
        const adapted = ownerBookings.map(adaptBooking)
        setBookings(adapted)
        setCompletedBookings(adapted.filter(b => ['completed', 'fully_paid'].includes(b.bookingStatus)))
      } catch (err) {
        console.error('Error fetching owner bookings:', err)
      } finally {
        bookingsLoaded = true
        setLoading(false)
      }
    }

    fetchBookings()
    const intervalBookings = setInterval(fetchBookings, 5000)

    const unsubNotifs = subscribeToUserNotifications(user._id, (data) => {
      setNotifications(data)
    })

    return () => {
      clearInterval(intervalBookings)
      unsubNotifs()
    }
  }, [user?._id])

  const liveCount = vehicles.filter(v => v.isLive !== false && v.status === 'approved').length
  const pendingVerifyCount = vehicles.filter(v => v.status === 'pending_verification' || v.status === 'under_review').length
  const currentlyRentedCount = bookings.filter(b => b.bookingStatus === 'ongoing').length
  const offlineCount = vehicles.filter(v => v.isLive === false || v.status !== 'approved').length
  const totalBookingRequests = bookings.length
  const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0)
  const pendingEarnings = bookings
    .filter(b => ['ongoing', 'approved', 'accepted', 'advance_paid'].includes(b.bookingStatus))
    .reduce((sum, b) => sum + (b.totalPrice || 0), 0)
  const unreadCount = notifications.filter(n => !n.read).length

  // This month earnings
  const now = new Date()
  const thisMonthEarnings = completedBookings
    .filter(b => {
      const d = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, b) => sum + (b.totalPrice || 0), 0)

  const overviewStats = [
    { label: 'Total Vehicles',      value: vehicles.length,         icon: FiPackage,     color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { label: 'Live Vehicles',       value: liveCount,               icon: FiCheck,        color: 'text-green-400',  bg: 'bg-green-500/10' },
    { label: 'Pending Verification',value: pendingVerifyCount,      icon: FiClock,        color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Currently Rented',    value: currentlyRentedCount,    icon: FiPlay,         color: 'text-brand',      bg: 'bg-brand/10' },
    { label: 'Offline Vehicles',    value: offlineCount,            icon: FiXCircle,      color: 'text-red-400',    bg: 'bg-red-500/10' },
    { label: 'Total Requests',      value: totalBookingRequests,    icon: FiCalendar,     color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Total Earnings',      value: `₹${totalEarnings.toLocaleString()}`,   icon: FiTrendingUp,  color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Pending Earnings',    value: `₹${pendingEarnings.toLocaleString()}`, icon: FiDollarSign,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ]

  /* ── Handlers ────────────────────────────────────────── */

  const handleDelete = async (vid) => {
    try {
      await vehicleAPI.delete(vid)
      setDeleteTarget(null)
      toast.success('Vehicle removed')
      loadOwnerVehicles()
    } catch {
      toast.error('Failed to remove vehicle')
    }
  }

  const handleBookingAction = async (bookingId, action) => {
    try {
      await bookingAPI.updateStatus(bookingId, action)
      toast.success(`Booking status updated to ${action}`)
    } catch (err) {
      toast.error(err.message || `Failed to update status`)
    }
  }

  const handleInspectApprove = async () => {
    if (!inspectBooking) return
    const bid = inspectBooking._id || inspectBooking.bookingId
    setInspectBooking(null)
    try {
      await bookingAPI.updateStatus(bid, 'accepted')
      toast.success('Booking verification approved and accepted! 🎉')
    } catch {
      toast.error('Failed to approve booking')
    }
  }

  const handleInspectReject = async () => {
    if (!inspectBooking) return
    const bid = inspectBooking._id || inspectBooking.bookingId
    if (!confirm('Are you sure you want to reject this booking? This will issue a 100% refund of the renter advance payment.')) return
    setInspectBooking(null)
    try {
      await bookingAPI.updateStatus(bid, 'rejected')
      toast.success('Booking verification rejected.')
    } catch {
      toast.error('Failed to reject booking')
    }
  }

  const handleInspectRequestInfo = async () => {
    if (!inspectBooking || !requestInfoText) return
    const bid = inspectBooking._id || inspectBooking.bookingId
    const renterId = inspectBooking.renterId
    const msg = requestInfoText
    setInspectBooking(null)
    setRequestInfoText('')
    setShowingRequestInput(false)
    try {
      await bookingAPI.updateStatus(bid, 'requested')
      toast.success('Information request sent to renter.')
    } catch {
      toast.error('Failed to request additional info')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(user._id)
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark notifications as read')
    }
  }

  const handleMarkRead = async (notifId) => {
    try {
      await markNotificationRead(notifId)
    } catch {
      // silent fail
    }
  }

  /* ── Filtered booking list ──────────────────────────── */

  const filteredBookings = useMemo(() => {
    let result = bookings
    if (vehicleFilter) {
      result = result.filter(b => b.vehicleId === vehicleFilter)
    }
    if (bookingFilter !== 'all') {
      result = result.filter(b => b.bookingStatus === bookingFilter)
    }
    return result
  }, [bookings, bookingFilter, vehicleFilter])

  const recentBookings = bookings.slice(0, 5)

  /* ── Compute vehicle display status ─────────────────── */

  const getVehicleDisplayStatus = (v) => {
    if (v.deleted) return 'deleted'
    if (v.status === 'rejected') return 'rejected'
    if (v.status === 'pending_verification' || v.status === 'under_review') return 'pending_verification'
    // Check if currently booked
    const hasOngoing = bookings.some(b => b.vehicleId === v._id && b.bookingStatus === 'ongoing')
    if (hasOngoing) return 'booked'
    if (v.status === 'approved' && v.isLive !== false) return 'live'
    if (v.status === 'approved' && v.isLive === false) return 'offline'
    return v.status
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */

  return (
    <PageWrapper>
      <div className="container-main py-6 md:py-10">
        {/* Page header */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Owner Dashboard</h1>
            <p className="text-white/40 text-sm mt-1">Welcome back, {user?.name || user?.displayName || 'Owner'}</p>
          </div>
          {isKycComplete() ? (
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center justify-center gap-2 text-sm sm:w-auto w-full py-3 sm:py-2.5 shadow-lg shadow-brand/20">
              <FiPlus className="text-lg" /> List Your Vehicle
            </button>
          ) : (
            <Link to="/verify" className="btn-primary flex items-center justify-center gap-2 text-sm sm:w-auto w-full py-3 sm:py-2.5 shadow-lg shadow-brand/20">
              <FiAlertCircle className="text-lg" /> Verify to List Vehicle
            </Link>
          )}
        </div>

        {/* Verification banner */}
        {!isKycComplete() && (
          <div className="mb-6 card p-4 bg-yellow-500/5 border-yellow-500/20 text-yellow-400 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <FiAlertCircle size={18} className="shrink-0" />
              <span>Verify your email or phone number to list vehicles and unlock all features.</span>
            </div>
            <Link to="/verify" className="btn-primary text-xs px-4 py-2 shrink-0 w-fit">
              Verify Now
            </Link>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Mobile horizontal tabs */}
          <div className="md:hidden flex gap-1 bg-surface-2 rounded-xl p-1 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => { setActiveTab(item.key); setVehicleFilter(null) }}
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
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden md:block w-60 shrink-0">
            <nav className="bg-surface rounded-2xl border border-white/5 overflow-hidden sticky top-24">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setActiveTab(item.key); setVehicleFilter(null) }}
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
          </aside>

          {/* ═══ MAIN CONTENT ═══ */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

              {/* ═══════════════════════════════════════════════
                  OVERVIEW TAB
                  ═══════════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {loading
                      ? [...Array(8)].map((_, i) => <StatCardSkeleton key={i} />)
                      : overviewStats.map((s, i) => (
                          <StatCard key={s.label} {...s} delay={i * 0.04} />
                        ))}
                  </div>

                  {/* Recent activity */}
                  <div>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FiActivity className="text-brand" />
                      Recent Activity
                    </h2>
                    {loading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)}
                      </div>
                    ) : recentBookings.length === 0 ? (
                      <div className="card p-8 text-center">
                        <FiClock className="text-white/10 text-5xl mx-auto mb-3" />
                        <p className="text-white/40 text-sm">No recent activity</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentBookings.map((b, i) => (
                          <motion.div
                            key={b._id || b.bookingId}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="card p-4 flex items-center gap-4"
                          >
                            <div className="w-10 h-10 bg-surface-2 rounded-lg flex items-center justify-center shrink-0">
                              {b.vehicleType === 'scooty' ? (
                                <RiEBikeLine className="text-brand text-lg" />
                              ) : (
                                <RiMotorbikeLine className="text-brand text-lg" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{b.vehicleName || 'Vehicle'}</p>
                              <p className="text-white/40 text-xs mt-0.5">
                                {b.renterName || 'Renter'} · {formatDate(b.startTime)}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <StatusBadge status={b.bookingStatus} />
                              <p className="text-white/40 text-xs mt-1">₹{b.totalPrice || 0}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}


              {/* ═══════════════════════════════════════════════
                  MY VEHICLES TAB
                  ═══════════════════════════════════════════════ */}
              {activeTab === 'vehicles' && (
                <motion.div
                  key="vehicles"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">My Vehicles</h2>
                    {isKycComplete() ? (
                      <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-sm">
                        <FiPlus /> List a Vehicle
                      </button>
                    ) : (
                      <Link to="/verify" className="btn-secondary text-xs text-yellow-400 border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 flex items-center gap-2">
                        <FiAlertCircle /> Get Verified to List Vehicles
                      </Link>
                    )}
                  </div>

                  <div className="space-y-5">
                    {loading ? (
                      [...Array(2)].map((_, i) => <BookingCardSkeleton key={i} />)
                    ) : vehicles.length === 0 ? (
                      <div className="card p-10 flex flex-col items-center justify-center text-center border-brand/20 bg-brand/5">
                        <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mb-4 border border-brand/20 shadow-inner">
                          <span className="text-3xl">🚗</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">You haven't listed any vehicles yet.</h3>
                        <p className="text-white/60 mb-6 max-w-sm">Start earning by renting out your bike or car.</p>
                        {isKycComplete() ? (
                          <button onClick={() => setShowAddModal(true)} className="btn-primary text-base px-6 py-3.5 font-bold shadow-lg shadow-brand/20 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <FiPlus size={20} /> List Your First Vehicle
                          </button>
                        ) : (
                          <Link to="/verify" className="btn-primary text-base px-6 py-3.5 font-bold shadow-lg shadow-brand/20 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <FiAlertCircle size={20} /> Verify to List Vehicle
                          </Link>
                        )}
                      </div>
                    ) : (
                      vehicles.map((v, i) => {
                        const Icon = v.type === 'bike' ? RiMotorbikeLine : RiEBikeLine
                        const displayStatus = getVehicleDisplayStatus(v)
                        const vehicleBookings = bookings.filter(b => b.vehicleId === v._id)
                        const vehicleRevenue = vehicleBookings
                          .filter(b => b.bookingStatus === 'completed')
                          .reduce((sum, b) => sum + (b.totalPrice || 0), 0)

                        return (
                          <motion.div
                            key={v._id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="card overflow-hidden"
                          >
                            <div className="flex flex-col sm:flex-row">
                              {/* Vehicle Photo */}
                              <div className="sm:w-48 h-40 sm:h-auto bg-surface-2 relative shrink-0">
                                {v.images?.[0] ? (
                                  <img src={getImageUrl(v.images[0])} alt={v.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Icon className="text-white/10 text-6xl" />
                                  </div>
                                )}
                                <div className="absolute top-2 left-2">
                                  <StatusBadge status={displayStatus} />
                                </div>
                              </div>

                              {/* Vehicle Details */}
                              <div className="flex-1 p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div>
                                    <h3 className="font-bold text-base">{v.name}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-white/40 text-xs flex-wrap">
                                      <span className="capitalize flex items-center gap-1"><Icon size={12} /> {v.type}</span>
                                      {(v.registrationNumber || v.vehicleNumber) && <span className="font-mono bg-surface-2 px-1.5 py-0.5 rounded">{v.registrationNumber || v.vehicleNumber}</span>}
                                      {v.location && <span className="flex items-center gap-1"><FiMapPin size={10} /> {v.location}</span>}
                                    </div>
                                  </div>
                                  <LiveToggle vehicle={v} onToggle={loadOwnerVehicles} />
                                </div>

                                {/* Pricing + Date */}
                                <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
                                  <span className="text-brand font-bold">₹{v.pricePerHour}/hr</span>
                                  {v.pricePerDay && <span className="text-white/50">₹{v.pricePerDay}/day</span>}
                                  <span className="text-white/30 text-xs">Listed {formatDate(v.createdAt)}</span>
                                </div>

                                {/* Vehicle mini-stats */}
                                <div className="flex items-center gap-4 text-xs text-white/40 mb-4 flex-wrap">
                                  <span>{vehicleBookings.length} requests</span>
                                  <span>{vehicleBookings.filter(b => b.bookingStatus === 'completed').length} bookings</span>
                                  <span className="text-green-400 font-medium">₹{vehicleRevenue.toLocaleString()} earned</span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => setEditVehicle(v)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 text-white/60 hover:text-white hover:bg-surface-3 text-xs font-medium transition"
                                  >
                                    <FiEdit2 size={13} /> Edit
                                  </button>
                                  <button
                                    onClick={() => { setVehicleFilter(v._id); setActiveTab('bookings'); setBookingFilter('all') }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 text-white/60 hover:text-white hover:bg-surface-3 text-xs font-medium transition"
                                  >
                                    <FiEye size={13} /> View Requests
                                  </button>
                                  <Link
                                    to={`/vehicles/${v._id}`}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-2 text-white/60 hover:text-white hover:bg-surface-3 text-xs font-medium transition"
                                  >
                                    <FiEye size={13} /> Preview
                                  </Link>
                                  <button
                                    onClick={() => setDeleteTarget(v)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition"
                                  >
                                    <FiTrash2 size={13} /> Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </div>
                </motion.div>
              )}


              {/* ═══════════════════════════════════════════════
                  BOOKING REQUESTS TAB
                  ═══════════════════════════════════════════════ */}
              {activeTab === 'bookings' && (
                <motion.div
                  key="bookings"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-lg font-semibold">Booking Requests</h2>
                    {vehicleFilter && (
                      <button
                        onClick={() => setVehicleFilter(null)}
                        className="text-xs text-brand hover:underline flex items-center gap-1"
                      >
                        <FiX size={12} /> Clear vehicle filter
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit mb-6 overflow-x-auto no-scrollbar">
                    {['all', 'pending_verification', 'under_review', 'approved', 'advance_paid', 'ongoing', 'completed', 'fully_paid', 'cancelled', 'rejected'].map((f) => {
                      const labels = {
                        all: 'All',
                        pending_verification: 'Pending Verify',
                        under_review: 'Under Review',
                        approved: 'Approved',
                        advance_paid: 'Advance Paid',
                        ongoing: 'Ongoing',
                        completed: 'Completed',
                        fully_paid: 'Fully Paid',
                        cancelled: 'Cancelled',
                        rejected: 'Rejected'
                      }
                      return (
                        <button
                          key={f}
                          onClick={() => setBookingFilter(f)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition ${
                            bookingFilter === f
                              ? 'bg-brand text-white'
                              : 'text-white/40 hover:text-white'
                          }`}
                        >
                          {labels[f] || f}
                        </button>
                      )
                    })}
                  </div>

                  {/* Booking cards */}
                  <div className="space-y-4">
                    {loading ? (
                      [...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)
                    ) : filteredBookings.length === 0 ? (
                      <div className="text-center py-16">
                        <FiCalendar className="text-white/10 text-7xl mx-auto mb-3" />
                        <p className="text-white/40">
                          {bookingFilter === 'all' ? 'No bookings yet.' : 'No bookings found.'}
                        </p>
                      </div>
                    ) : (
                      filteredBookings.map((b, i) => {
                        const veh = vehicles.find(v => v._id === b.vehicleId)
                        return (
                          <motion.div
                            key={b._id || b.bookingId}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="card p-5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                              {/* Vehicle thumbnail */}
                              <div className="w-16 h-16 bg-surface-2 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                                {veh?.images?.[0] ? (
                                  <img src={getImageUrl(veh.images[0])} alt="" className="w-full h-full object-cover" />
                                ) : b.vehicleType === 'scooty' ? (
                                  <RiEBikeLine className="text-brand text-xl" />
                                ) : (
                                  <RiMotorbikeLine className="text-brand text-xl" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-sm">{b.vehicleName || 'Vehicle'}</h3>
                                  <StatusBadge status={b.bookingStatus} />
                                </div>
                                <div className="mt-2 space-y-1">
                                  <p className="text-white/50 text-xs">
                                    <span className="text-white/30">Renter:</span> {b.renterName || 'User'}
                                    {b.renterEmail && <span className="text-white/30"> · {b.renterEmail}</span>}
                                  </p>
                                  {b.verificationDetails?.collegeName && (
                                    <p className="text-white/50 text-xs">
                                      <span className="text-white/30">College:</span> {b.verificationDetails.collegeName}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-white/30 text-xs flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <FiClock className="text-white/20" />
                                    {formatDate(b.startTime)} → {formatDate(b.endTime)}
                                  </span>
                                  <span className="flex items-center gap-1 text-white/50 font-medium">
                                    <FiDollarSign className="text-white/30" />
                                    ₹{b.totalPrice || 0}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {b.bookingStatus === 'under_review' && (
                                  <button
                                    onClick={() => setInspectBooking(b)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25 text-sm font-medium transition"
                                  >
                                    <FiEye /> Review Identity Docs
                                  </button>
                                )}
                                {b.bookingStatus === 'pending_verification' && (
                                  <span className="text-xs text-white/35 italic flex items-center gap-1">
                                    <FiClock /> Awaiting renter verification uploads
                                  </span>
                                )}
                                {['approved', 'accepted'].includes(b.bookingStatus) && (
                                  <span className="text-xs text-amber-400/85 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10 italic flex items-center gap-1.5">
                                    <FiClock /> Awaiting renter 25% advance payment
                                  </span>
                                )}
                                {b.bookingStatus === 'advance_paid' && (
                                  <>
                                    <Link
                                      to={`/handover/${b._id || b.bookingId}`}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 text-sm font-medium transition"
                                    >
                                      <FiCheckCircle /> Vehicle Handover
                                    </Link>
                                    <button
                                      onClick={() => handleBookingAction(b._id, 'cancelled')}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-sm font-medium transition"
                                    >
                                      <FiXCircle /> Cancel
                                    </button>
                                  </>
                                )}
                                {b.bookingStatus === 'ongoing' && (
                                  <>
                                    <Link
                                      to={`/handover/${b._id || b.bookingId}`}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-sm font-medium transition"
                                    >
                                      <FiCheckCircle /> Return Check & Complete
                                    </Link>
                                    <button
                                      onClick={() => handleBookingAction(b._id, 'cancelled')}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-sm font-medium transition"
                                    >
                                      <FiXCircle /> Cancel
                                    </button>
                                  </>
                                )}
                                {b.bookingStatus === 'completed' && (
                                  <div className="flex gap-2">
                                    <motion.button
                                      whileHover={{ scale: 1.03 }}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => setReviewBooking(b)}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 text-sm font-medium transition"
                                    >
                                      <FiStar size={14} /> Rate Customer
                                    </motion.button>
                                    {b.handoverDetails?.handoverPdfUrl && (
                                      <a
                                        href={b.handoverDetails.handoverPdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-sm font-medium transition"
                                      >
                                        <FiFileText /> Handover PDF
                                      </a>
                                    )}
                                    <button
                                      onClick={() => setDisputeBookingId(b._id || b.bookingId)}
                                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-400/80 border border-white/5 hover:bg-red-500/10 hover:text-red-400 text-sm font-medium transition"
                                    >
                                      Dispute
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </div>
                </motion.div>
              )}


              {/* ═══════════════════════════════════════════════
                  NOTIFICATIONS TAB
                  ═══════════════════════════════════════════════ */}
              {activeTab === 'notifications' && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FiBell className="text-brand" />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </h2>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-brand hover:underline">
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="card p-12 text-center">
                      <FiBell className="text-white/10 text-5xl mx-auto mb-3" />
                      <p className="text-white/40 text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((n, i) => {
                        const notifIcons = {
                          status:  FiAlertCircle,
                          payment: FiDollarSign,
                          info:    FiBell,
                        }
                        const NIcon = notifIcons[n.type] || FiBell
                        return (
                          <motion.div
                            key={n._id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => !n.read && handleMarkRead(n._id)}
                            className={`card p-4 flex items-start gap-3 cursor-pointer transition-all ${
                              !n.read ? 'border-brand/20 bg-brand/5' : 'hover:bg-surface-2'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              !n.read ? 'bg-brand/20' : 'bg-surface-2'
                            }`}>
                              <NIcon className={!n.read ? 'text-brand' : 'text-white/30'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${!n.read ? 'text-white' : 'text-white/60'}`}>
                                {n.title}
                              </p>
                              <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-white/20 text-[10px] mt-1">{formatDate(n.createdAt)}</p>
                            </div>
                            {!n.read && <span className="w-2 h-2 bg-brand rounded-full shrink-0 mt-2" />}
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}


              {/* ═══════════════════════════════════════════════
                  EARNINGS TAB
                  ═══════════════════════════════════════════════ */}
              {activeTab === 'earnings' && (
                <motion.div
                  key="earnings"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <FiTrendingUp className="text-brand" />
                    Earnings Overview
                  </h2>

                  {/* Earnings summary cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard label="Total Earnings" value={`₹${totalEarnings.toLocaleString()}`} icon={FiTrendingUp} color="text-green-400" bg="bg-green-500/10" delay={0} />
                    <StatCard label="This Month" value={`₹${thisMonthEarnings.toLocaleString()}`} icon={FiCalendar} color="text-blue-400" bg="bg-blue-500/10" delay={0.05} />
                    <StatCard label="Pending Earnings" value={`₹${pendingEarnings.toLocaleString()}`} icon={FiClock} color="text-yellow-400" bg="bg-yellow-500/10" delay={0.1} />
                    <StatCard label="Completed Txns" value={completedBookings.length} icon={FiCheckCircle} color="text-green-400" bg="bg-green-500/10" delay={0.15} />
                  </div>

                  {/* Earnings history table */}
                  <h3 className="text-sm font-semibold text-white/60 mb-3">Transaction History</h3>
                  {completedBookings.length === 0 ? (
                    <div className="card p-10 text-center">
                      <FiDollarSign className="text-white/10 text-5xl mx-auto mb-3" />
                      <p className="text-white/40 text-sm">No earnings yet. Complete bookings to start earning!</p>
                    </div>
                  ) : (
                    <div className="card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5">
                              <th className="text-left text-white/40 text-xs font-medium px-4 py-3">Date</th>
                              <th className="text-left text-white/40 text-xs font-medium px-4 py-3">Vehicle</th>
                              <th className="text-left text-white/40 text-xs font-medium px-4 py-3">Renter</th>
                              <th className="text-right text-white/40 text-xs font-medium px-4 py-3">Amount</th>
                              <th className="text-right text-white/40 text-xs font-medium px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completedBookings.map((b) => (
                              <tr key={b._id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                                <td className="px-4 py-3 text-white/60 text-xs whitespace-nowrap">{formatDate(b.createdAt)}</td>
                                <td className="px-4 py-3 text-white font-medium text-xs">{b.vehicleName || 'Vehicle'}</td>
                                <td className="px-4 py-3 text-white/60 text-xs">{b.renterName || 'Renter'}</td>
                                <td className="px-4 py-3 text-green-400 font-bold text-xs text-right">₹{(b.totalPrice || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right"><StatusBadge status="completed" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}


              {/* ═══════════════════════════════════════════════
                  SETTINGS TAB
                  ═══════════════════════════════════════════════ */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <div className="card p-10 text-center max-w-md w-full">
                    <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FiSettings className="text-white/20 text-3xl" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Settings</h2>
                    <p className="text-white/40 text-sm">
                      Account settings, notification preferences, and payout configuration are coming soon.
                    </p>
                    <div className="mt-6 inline-block badge bg-brand/10 text-brand border border-brand/20 text-xs font-medium">
                      Coming Soon
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </main>
        </div>
      </div>


      {/* ═══════════════════════════════════════════════════════
         MODALS
         ═══════════════════════════════════════════════════════ */}

      {/* Document Inspection Modal */}
      <AnimatePresence>
        {inspectBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card max-w-3xl w-full p-6 space-y-6 border border-white/10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FiUser className="text-brand" /> Renter Document Verification
                  </h3>
                  <p className="text-xs text-white/40 mt-1">Review renter credentials before accepting the booking.</p>
                </div>
                <button
                  onClick={() => { setInspectBooking(null); setShowingRequestInput(false) }}
                  className="btn-ghost p-2 text-white/60 hover:text-white"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Renter details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div className="space-y-3">
                  <h4 className="font-semibold text-white/80 border-b border-white/5 pb-1">Personal Details</h4>
                  <p className="text-xs text-white/60"><span className="text-white/35">Name:</span> {inspectBooking.renterName}</p>
                  <p className="text-xs text-white/60"><span className="text-white/35">Email:</span> {inspectBooking.renterEmail || '—'}</p>
                  <p className="text-xs text-white/60">
                    <span className="text-white/35">College:</span> {inspectBooking.verificationDetails?.collegeName || '—'}
                  </p>
                  <div className="space-y-1 mt-2">
                    <p className="text-xs font-semibold text-white/50">Residential Addresses</p>
                    <p className="text-[11px] text-white/60 leading-normal flex items-start gap-1">
                      <FiMapPin size={12} className="shrink-0 mt-0.5 text-brand" />
                      <span>Current: {inspectBooking.verificationDetails?.currentAddress || '—'}</span>
                    </p>
                    <p className="text-[11px] text-white/60 leading-normal flex items-start gap-1">
                      <FiMapPin size={12} className="shrink-0 mt-0.5 text-white/30" />
                      <span>Permanent: {inspectBooking.verificationDetails?.permanentAddress || '—'}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-white/80 border-b border-white/5 pb-1">Guardian Contact Details</h4>
                  <p className="text-xs text-white/60"><span className="text-white/35">Name:</span> {inspectBooking.verificationDetails?.guardianName || '—'}</p>
                  <p className="text-xs text-white/60"><span className="text-white/35">Phone:</span> {inspectBooking.verificationDetails?.guardianPhone || '—'}</p>
                  <p className="text-xs text-white/60"><span className="text-white/35">Email:</span> {inspectBooking.verificationDetails?.guardianEmail || '—'}</p>

                  {inspectBooking.verificationDetails?.verificationPdfUrl && (
                    <div className="pt-3">
                      <a
                        href={inspectBooking.verificationDetails.verificationPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary w-full py-2 flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <FiFileText size={14} /> Open Compiled Agreement PDF
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
              <div className="space-y-3 border-t border-white/5 pt-4">
                <h4 className="font-semibold text-white/80">Uploaded Legal Documents</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'selfieUrl', label: 'Selfie Photo' },
                    { key: 'aadhaarFrontUrl', label: 'Aadhaar Card Front' },
                    { key: 'aadhaarBackUrl', label: 'Aadhaar Card Back' },
                    { key: 'collegeIdUrl', label: 'College Student ID' },
                    { key: 'guardianAadhaarUrl', label: 'Guardian Aadhaar' },
                    { key: 'signatureUrl', label: 'Digital Signature' }
                  ].map(({ key, label }) => {
                    const url = inspectBooking.verificationDetails?.[key]
                    if (!url) return null
                    return (
                      <div key={key} className="bg-surface-2 rounded-xl p-2.5 border border-white/5 flex flex-col items-center gap-2">
                        <span className="text-[10px] text-white/50 truncate w-full text-center">{label}</span>
                        <a href={getImageUrl(url)} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg aspect-video w-full bg-surface-3">
                          <img src={getImageUrl(url)} alt={label} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <span className="text-[10px] bg-brand text-white px-2 py-1 rounded-md font-bold">Zoom</span>
                          </div>
                        </a>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action area */}
              <div className="border-t border-white/5 pt-4 space-y-4">
                {showingRequestInput ? (
                  <div className="space-y-2">
                    <label className="text-xs text-white/70">What details or corrections are required from the renter?</label>
                    <textarea
                      className="input-field min-h-[80px]"
                      placeholder="e.g. Please upload a clearer photo of your college student ID card."
                      value={requestInfoText}
                      onChange={(e) => setRequestInfoText(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowingRequestInput(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                      <button onClick={handleInspectRequestInfo} disabled={!requestInfoText} className="btn-primary text-xs px-4 py-1.5">Send Request</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={handleInspectApprove} className="btn-primary bg-green-600 hover:bg-green-700 flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold">
                      <FiCheckCircle /> Approve & Accept Booking
                    </button>
                    <button onClick={() => setShowingRequestInput(true)} className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold">
                      <FiAlertCircle /> Request Corrections
                    </button>
                    <button onClick={handleInspectReject} className="btn-secondary border-red-500/20 text-red-400 hover:bg-red-500/10 flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold">
                      <FiXCircle /> Reject & Refund 100%
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add vehicle modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddVehicleModal
            onClose={() => setShowAddModal(false)}
            onSuccess={loadOwnerVehicles}
            userId={user?._id}
            userName={user?.name}
          />
        )}
      </AnimatePresence>

      {/* Edit vehicle modal */}
      <AnimatePresence>
        {editVehicle && (
          <EditVehicleModal
            vehicle={editVehicle}
            onClose={() => setEditVehicle(null)}
            onSuccess={loadOwnerVehicles}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmModal
            vehicleName={deleteTarget.name}
            onConfirm={() => handleDelete(deleteTarget._id)}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <ReviewModal
        isOpen={!!reviewBooking}
        onClose={() => setReviewBooking(null)}
        booking={reviewBooking}
        currentUser={user}
        role="owner"
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
