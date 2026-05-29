import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  FiPlus, FiEdit2, FiTrash2, FiEye, FiUpload,
  FiTrendingUp, FiCalendar, FiPackage, FiX, FiCheck,
  FiGrid, FiSettings, FiCheckCircle, FiXCircle,
  FiClock, FiDollarSign, FiActivity, FiStar, FiPlay, FiAlertCircle,
  FiFileText, FiUser, FiMapPin, FiMail, FiPhone
} from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import { addVehicleSchema } from '../utils/schemas'
import useAuthStore from '../store/authStore'
import { StatCardSkeleton, BookingCardSkeleton } from '../components/Skeletons'
import {
  subscribeToOwnerVehicles, subscribeToOwnerBookings,
  addVehicle, deleteVehicle, toggleVehicleLive,
  updateBookingStatus, cancelBooking, addNotification
} from '../firebase/firestoreService'
import ReviewModal from '../components/ReviewModal'

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: FiGrid },
  { key: 'vehicles', label: 'My Vehicles', icon: FiPackage },
  { key: 'bookings', label: 'Bookings', icon: FiCalendar },
  { key: 'settings', label: 'Settings', icon: FiSettings },
]

function StatusBadge({ status }) {
  const map = {
    pending_verification: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    under_review: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    approved: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    accepted: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    ongoing: 'bg-brand/10 text-brand border border-brand/20',
    completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
    cancelled: 'bg-surface-3 text-white/30 border border-white/5',
  }
  const labels = {
    pending_verification: 'Pending Verify',
    under_review: 'Under Review',
    approved: 'Approved',
    accepted: 'Accepted',
    ongoing: 'Ongoing',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled'
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
      await toggleVehicleLive(vehicle._id)
      onToggle(vehicle._id)
      toast.success(isLive ? 'Vehicle is now OFFLINE' : 'Vehicle is now LIVE')
    } catch {
      toast.error('Failed to toggle status')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`status-dot ${isLive ? 'status-dot--live' : 'status-dot--offline'}`} />
      <button
        onClick={handleToggle}
        disabled={toggling || vehicle.status !== 'approved'}
        className={`toggle-switch ${isLive ? 'toggle-switch--on' : 'toggle-switch--off'} ${
          vehicle.status !== 'approved' ? 'opacity-30 cursor-not-allowed' : ''
        }`}
        title={vehicle.status !== 'approved' ? 'Only approved vehicles can go live' : (isLive ? 'Set Offline' : 'Set Live')}
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

function AddVehicleModal({ onClose, onSuccess, userId, userName }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(addVehicleSchema),
    defaultValues: { type: 'bike' },
  })
  const [submitting, setSubmitting] = useState(false)
  const [images, setImages] = useState([])

  const onSubmit = async (data) => {
    setSubmitting(true)
    try {
      await addVehicle(userId, userName, {
        ...data,
        images: images.map((img) => img.name),
      })
      toast.success('Vehicle listed successfully!')
      onSuccess()
      onClose()
    } catch {
      toast.error('Failed to list vehicle. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">List a Vehicle</h2>
          <button onClick={onClose} className="btn-ghost p-2"><FiX /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label" htmlFor="veh-name">Vehicle name</label>
            <input id="veh-name" className="input-field" placeholder="e.g. Honda Activa 6G" {...register('name')} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="veh-type">Type</label>
              <select id="veh-type" className="input-field" {...register('type')}>
                <option value="bike">Bike</option>
                <option value="scooty">Scooty</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="veh-year">Year</label>
              <input id="veh-year" type="number" className="input-field" placeholder="2022" {...register('year')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="veh-pph">Price/hour (₹)</label>
              <input id="veh-pph" type="number" className="input-field" placeholder="80" {...register('pricePerHour')} />
              {errors.pricePerHour && <p className="text-red-400 text-xs mt-1">{errors.pricePerHour.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="veh-ppd">Price/day (₹)</label>
              <input id="veh-ppd" type="number" className="input-field" placeholder="500" {...register('pricePerDay')} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="veh-location">Pickup location</label>
            <input id="veh-location" className="input-field" placeholder="AT Road, Dibrugarh" {...register('location')} />
            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="veh-desc">Description</label>
            <textarea id="veh-desc" rows={3} className="input-field resize-none" placeholder="Describe your vehicle…" {...register('description')} />
          </div>

          <div>
            <label className="label">Photos</label>
            <label
              htmlFor="veh-images"
              className="flex flex-col items-center gap-2 border-2 border-dashed border-white/10 rounded-xl p-6 cursor-pointer hover:border-white/20 bg-surface-2 transition text-center"
            >
              <FiUpload className="text-white/30 text-2xl" />
              <span className="text-sm text-white/40">
                {images.length > 0 ? `${images.length} file(s) selected` : 'Upload vehicle photos'}
              </span>
              <input id="veh-images" type="file" accept="image/*" multiple className="hidden" onChange={(e) => setImages(Array.from(e.target.files))} />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

export default function OwnerDashboard() {
  const { user, isKycComplete } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [bookingFilter, setBookingFilter] = useState('all')
  const [reviewBooking, setReviewBooking] = useState(null)

  // Document Inspection modal state
  const [inspectBooking, setInspectBooking] = useState(null)
  // Request info text state
  const [requestInfoText, setRequestInfoText] = useState('')
  const [showingRequestInput, setShowingRequestInput] = useState(false)

  useEffect(() => {
    if (!user?._id) {
      setLoading(false)
      return
    }

    let vehiclesLoaded = false
    let bookingsLoaded = false

    const checkReady = () => {
      if (vehiclesLoaded && bookingsLoaded) setLoading(false)
    }

    const unsubVehicles = subscribeToOwnerVehicles(user._id, (data) => {
      setVehicles(data)
      vehiclesLoaded = true
      checkReady()
    })

    const unsubBookings = subscribeToOwnerBookings(user._id, (data) => {
      setBookings(data)
      bookingsLoaded = true
      checkReady()
    })

    return () => {
      unsubVehicles()
      unsubBookings()
    }
  }, [user?._id])

  const handleDelete = async (vid) => {
    if (!confirm('Remove this vehicle permanently?')) return
    try {
      await deleteVehicle(vid)
      toast.success('Vehicle removed')
    } catch {
      toast.error('Failed to remove vehicle')
    }
  }

  const handleToggleLive = () => {
    // Real-time subscription auto-updates
  }

  const handleBookingAction = async (bookingId, action) => {
    try {
      await updateBookingStatus(bookingId, action)
      toast.success(`Booking ${action} successfully`)
    } catch (err) {
      toast.error(err.message || `Failed to ${action} booking`)
    }
  }

  const handleInspectApprove = async () => {
    if (!inspectBooking) return
    const bid = inspectBooking._id || inspectBooking.bookingId
    setInspectBooking(null)
    try {
      await updateBookingStatus(bid, 'approved')
      toast.success('Booking verification approved and accepted! 🎉')
    } catch (err) {
      toast.error('Failed to approve booking')
    }
  }

  const handleInspectReject = async () => {
    if (!inspectBooking) return
    const bid = inspectBooking._id || inspectBooking.bookingId
    if (!confirm('Are you sure you want to reject this booking? This will issue a 100% refund of the renter advance payment.')) return
    setInspectBooking(null)
    try {
      await cancelBooking(bid, 'owner')
      toast.success('Booking verification rejected. Refund has been initiated.')
    } catch (err) {
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
      await updateBookingStatus(bid, 'under_review')
      await addNotification(renterId, {
        title: 'Action Required: Update Verification Docs ⚠️',
        message: `Owner of ${inspectBooking.vehicleName} requested details: "${msg}"`,
        bookingId: bid,
        type: 'status'
      })
      toast.success('Information request sent to renter.')
    } catch (err) {
      toast.error('Failed to request additional info')
    }
  }

  const liveCount = vehicles.filter((v) => v.isLive !== false && v.status === 'approved').length
  const offlineCount = vehicles.length - liveCount
  const activeBookings = bookings.filter((b) =>
    ['pending_verification', 'under_review', 'approved', 'accepted', 'ongoing'].includes(b.bookingStatus)
  ).length
  const estEarnings = bookings
    .filter((b) => b.bookingStatus === 'completed')
    .reduce((sum, b) => sum + (b.totalPrice || 0), 0)

  const stats = [
    { label: 'Total Vehicles', value: vehicles.length, icon: FiPackage, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Live Now', value: liveCount, icon: FiCheck, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Offline', value: offlineCount, icon: FiXCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Active Bookings', value: activeBookings, icon: FiCalendar, color: 'text-brand', bg: 'bg-brand/10' },
    { label: 'Est. Earnings', value: `₹${estEarnings.toLocaleString()}`, icon: FiTrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ]

  const filteredBookings = bookingFilter === 'all'
    ? bookings
    : bookings.filter((b) => b.bookingStatus === bookingFilter)

  const recentBookings = bookings.slice(0, 5)

  return (
    <PageWrapper>
      <div className="container-main py-6 md:py-10">
        {/* Page header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Owner Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Welcome back, {user?.name || 'Owner'}</p>
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
                onClick={() => setActiveTab(item.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  activeTab === item.key
                    ? 'bg-brand text-white'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                <item.icon className="text-base" />
                {item.label}
              </button>
            ))}
          </div>

          {/* Desktop sidebar */}
          <aside className="hidden md:block w-60 shrink-0">
            <nav className="bg-surface rounded-2xl border border-white/5 overflow-hidden sticky top-24">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-all ${
                    activeTab === item.key
                      ? 'bg-brand/10 text-brand border-l-2 border-brand'
                      : 'text-white/50 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <item.icon className="text-lg" />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {loading
                      ? [...Array(5)].map((_, i) => <StatCardSkeleton key={i} />)
                      : stats.map((s, i) => (
                          <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="card p-5"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-white/40 text-xs font-medium">{s.label}</span>
                              <div className={`${s.bg} rounded-lg p-2`}>
                                <s.icon className={`${s.color} text-lg`} />
                              </div>
                            </div>
                            <div className="text-2xl font-bold">{s.value}</div>
                          </motion.div>
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
                                {b.renterName || 'Renter'} · {b.startTime ? new Date(b.startTime).toLocaleDateString('en-IN') : '—'}
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

              {/* VEHICLES TAB */}
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
                      <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
                        <FiPlus /> List a Vehicle
                      </button>
                    ) : (
                      <Link to="/verify" className="btn-secondary text-xs text-yellow-400 border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 flex items-center gap-2">
                        <FiAlertCircle /> Get Verified to List Vehicles
                      </Link>
                    )}
                  </div>

                  <div className="space-y-4">
                    {loading ? (
                      [...Array(2)].map((_, i) => <BookingCardSkeleton key={i} />)
                    ) : vehicles.length === 0 ? (
                      <div className="text-center py-16">
                        <RiMotorbikeLine className="text-white/10 text-7xl mx-auto mb-3" />
                        <p className="text-white/40">No vehicles listed yet.</p>
                        {isKycComplete() ? (
                          <button onClick={() => setShowModal(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
                            <FiPlus /> List your first vehicle
                          </button>
                        ) : (
                          <Link to="/verify" className="btn-primary mt-4 inline-flex items-center gap-2">
                            <FiAlertCircle /> Verify to List Vehicle
                          </Link>
                        )}
                      </div>
                    ) : (
                      vehicles.map((v, i) => {
                        const Icon = v.type === 'bike' ? RiMotorbikeLine : RiEBikeLine
                        return (
                          <motion.div
                            key={v._id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                          >
                            <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center shrink-0 relative">
                              <Icon className="text-brand text-2xl" />
                              <span
                                className={`absolute -top-1 -right-1 status-dot ${
                                  v.isLive !== false && v.status === 'approved' ? 'status-dot--live' : 'status-dot--offline'
                                }`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{v.name}</div>
                              <div className="text-white/40 text-sm mt-0.5">
                                ₹{v.pricePerHour}/hr · ₹{v.pricePerDay}/day
                              </div>
                            </div>

                            <StatusBadge status={v.status} />

                            <LiveToggle vehicle={v} onToggle={handleToggleLive} />

                            <div className="flex items-center gap-2">
                              <Link to={`/vehicles/${v._id}`} className="btn-ghost p-2 text-white/40 hover:text-white" title="View">
                                <FiEye />
                              </Link>
                              <button className="btn-ghost p-2 text-white/40 hover:text-white" title="Edit">
                                <FiEdit2 />
                              </button>
                              <button onClick={() => handleDelete(v._id)} className="btn-ghost p-2 text-white/40 hover:text-red-400" title="Delete">
                                <FiTrash2 />
                              </button>
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* BOOKINGS TAB */}
              {activeTab === 'bookings' && (
                <motion.div
                  key="bookings"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="text-lg font-semibold mb-4">Bookings</h2>

                  {/* Filter tabs */}
                  <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit mb-6 overflow-x-auto no-scrollbar">
                    {['all', 'pending_verification', 'under_review', 'approved', 'ongoing', 'completed', 'cancelled', 'rejected'].map((f) => {
                      const labels = {
                        all: 'All',
                        pending_verification: 'Pending Verify',
                        under_review: 'Under Review',
                        approved: 'Approved',
                        ongoing: 'Ongoing',
                        completed: 'Completed',
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
                          {bookingFilter === 'all' ? 'No bookings yet.' : `No bookings found.`}
                        </p>
                      </div>
                    ) : (
                      filteredBookings.map((b, i) => (
                        <motion.div
                          key={b._id || b.bookingId}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="card p-5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
                              {b.vehicleType === 'scooty' ? (
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
                              <p className="text-white/50 text-xs mt-1.5">
                                <span className="text-white/30">Renter:</span> {b.renterName || 'User'}
                                {b.renterEmail && (
                                  <span className="text-white/30"> · {b.renterEmail}</span>
                                )}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-white/30 text-xs">
                                <span className="flex items-center gap-1">
                                  <FiClock className="text-white/20" />
                                  {b.startTime ? new Date(b.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                  {' → '}
                                  {b.endTime ? new Date(b.endTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                </span>
                                <span className="flex items-center gap-1 text-white/50 font-medium">
                                  <FiDollarSign className="text-white/30" />
                                  ₹{b.totalPrice || 0}
                                </span>
                              </div>
                            </div>

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
                              {b.bookingStatus === 'approved' && (
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
                                    <FiXCircle /> Cancel Booking
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
                                    <FiXCircle /> Cancel Booking
                                  </button>
                                </>
                              )}
                              {b.bookingStatus === 'completed' && (
                                <div className="flex gap-2">
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => setReviewBooking(b)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg
                                               bg-amber-500/10 text-amber-400 border border-amber-500/20
                                               hover:bg-amber-500/20 text-sm font-medium transition"
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
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* SETTINGS TAB */}
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

      {/* DOCUMENT INSPECTION MODAL */}
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
                  onClick={() => {
                    setInspectBooking(null)
                    setShowingRequestInput(false)
                  }}
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

              {/* Documents Carousel/List */}
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
                        <a href={url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg aspect-video w-full bg-surface-3">
                          <img
                            src={url}
                            alt={label}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
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
                      <button
                        onClick={() => setShowingRequestInput(false)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleInspectRequestInfo}
                        disabled={!requestInfoText}
                        className="btn-primary text-xs px-4 py-1.5"
                      >
                        Send Request
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleInspectApprove}
                      className="btn-primary bg-green-600 hover:bg-green-700 flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold"
                    >
                      <FiCheckCircle /> Approve & Accept Booking
                    </button>
                    <button
                      onClick={() => setShowingRequestInput(true)}
                      className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold"
                    >
                      <FiAlertCircle /> Request Corrections
                    </button>
                    <button
                      onClick={handleInspectReject}
                      className="btn-secondary border-red-500/20 text-red-400 hover:bg-red-500/10 flex-1 py-3 flex items-center justify-center gap-2 text-sm font-semibold"
                    >
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
        {showModal && (
          <AddVehicleModal
            onClose={() => setShowModal(false)}
            onSuccess={() => {}}
            userId={user?._id}
            userName={user?.name}
          />
        )}
      </AnimatePresence>

      {/* Rate customer modal */}
      <ReviewModal
        isOpen={!!reviewBooking}
        onClose={() => setReviewBooking(null)}
        booking={reviewBooking}
        currentUser={user}
        role="owner"
      />
    </PageWrapper>
  )
}
