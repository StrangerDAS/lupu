import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiCalendar, FiClock, FiHeart, FiUser,
  FiX, FiCheck, FiArrowRight, FiMapPin,
  FiStar, FiPhone, FiMail, FiFileText, FiAlertCircle
} from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import useAuthStore from '../store/authStore'
import { BookingCardSkeleton } from '../components/Skeletons'
import ReviewModal from '../components/ReviewModal'
import {
  subscribeToRenterBookings,
  cancelBooking,
  subscribeToFavorites,
  toggleFavorite,
  getVehicleById,
  calculateRefund
} from '../firebase/firestoreService'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  })
}

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

const TIMELINE_STEPS = ['Requested', 'Approved', 'Ongoing', 'Completed']

function BookingTimeline({ status }) {
  const statusIndex = {
    pending_verification: 0,
    under_review: 0,
    approved: 1,
    accepted: 1,
    ongoing: 2,
    completed: 3
  }
  const current = statusIndex[status] ?? -1

  return (
    <div className="flex items-center gap-0 w-full mt-4">
      {TIMELINE_STEPS.map((step, i) => {
        const isCompleted = i < current
        const isCurrent   = i === current

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                  isCompleted
                    ? 'bg-green-400 border-green-400 shadow-[0_0_6px_rgba(74,222,128,.5)]'
                    : isCurrent
                      ? 'bg-brand border-brand shadow-[0_0_6px_rgba(255,92,0,.5)]'
                      : 'bg-transparent border-white/20'
                }`}
              />
              <span
                className={`text-[10px] mt-1.5 whitespace-nowrap font-medium ${
                  isCompleted ? 'text-green-400' : isCurrent ? 'text-brand' : 'text-white/25'
                }`}
              >
                {step}
              </span>
            </div>

            {i < TIMELINE_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1.5 rounded-full ${
                  i < current ? 'bg-green-400/60' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0 },
}

export default function CustomerDashboard() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('bookings')
  const [bookings, setBookings] = useState([])
  const [favoriteIds, setFavoriteIds] = useState([])
  const [favoriteVehicles, setFavoriteVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [favLoading, setFavLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState(null)
  
  // Refund / Cancellation dialog state
  const [cancelModalBooking, setCancelModalBooking] = useState(null)
  const [reviewBooking, setReviewBooking] = useState(null)

  const tabs = [
    { key: 'bookings',  label: 'My Bookings', icon: FiCalendar },
    { key: 'history',   label: 'History',      icon: FiClock },
    { key: 'favorites', label: 'Favorites',    icon: FiHeart },
    { key: 'profile',   label: 'Profile',      icon: FiUser },
  ]

  useEffect(() => {
    if (!user?._id) {
      setLoading(false)
      return
    }

    setLoading(true)
    const unsub = subscribeToRenterBookings(user._id, (data) => {
      setBookings(data)
      setLoading(false)
    })
    return () => unsub()
  }, [user?._id])

  useEffect(() => {
    if (!user?._id) {
      setFavoriteIds([])
      setFavLoading(false)
      return
    }

    const unsub = subscribeToFavorites(user._id, (ids) => {
      setFavoriteIds(ids)
    })

    return () => unsub()
  }, [user?._id])

  useEffect(() => {
    if (favoriteIds.length === 0) {
      setFavoriteVehicles([])
      setFavLoading(false)
      return
    }

    let cancelled = false
    setFavLoading(true)

    async function fetchVehicles() {
      try {
        const results = await Promise.all(
          favoriteIds.map((id) => getVehicleById(id))
        )
        if (!cancelled) {
          setFavoriteVehicles(results.filter(Boolean))
        }
      } catch {
        if (!cancelled) setFavoriteVehicles([])
      } finally {
        if (!cancelled) setFavLoading(false)
      }
    }

    fetchVehicles()
    return () => { cancelled = true }
  }, [favoriteIds])

  const handleCancelClick = (booking) => {
    setCancelModalBooking(booking)
  }

  const confirmCancel = async () => {
    if (!cancelModalBooking) return
    const bookingId = cancelModalBooking._id || cancelModalBooking.bookingId
    setCancellingId(bookingId)
    const bookingToCancel = cancelModalBooking
    setCancelModalBooking(null)
    try {
      await cancelBooking(bookingId, 'renter')
      toast.success('Booking cancelled successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to cancel booking')
    } finally {
      setCancellingId(null)
    }
  }

  const handleUnfavorite = async (vehicleId) => {
    if (!user?._id) return
    try {
      await toggleFavorite(user._id, vehicleId)
      toast.success('Removed from favorites')
    } catch {
      toast.error('Failed to remove favorite')
    }
  }

  const activeBookings = bookings.filter((b) => b.bookingStatus === 'ongoing')
  const upcomingBookings = bookings.filter((b) =>
    ['pending_verification', 'under_review', 'approved', 'accepted'].includes(b.bookingStatus)
  )
  const completedBookings = bookings.filter((b) => b.bookingStatus === 'completed')
  const cancelledBookings = bookings.filter((b) => b.bookingStatus === 'cancelled' || b.bookingStatus === 'rejected')
  const totalCompleted = completedBookings.length

  const VehicleIcon = ({ type }) => {
    const Icon = type === 'bike' ? RiMotorbikeLine : RiEBikeLine
    return <Icon className="text-brand text-2xl" />
  }

  return (
    <PageWrapper>
      <div className="container-main py-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-2xl md:text-3xl font-bold">My Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">
            Welcome back, {user?.name || 'Rider'} 👋
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-full sm:w-fit mb-8 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                tab === t.key
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <t.icon className="text-base" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* BOOKINGS TAB */}
        {tab === 'bookings' && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            {loading ? (
              [...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)
            ) : activeBookings.length === 0 && upcomingBookings.length === 0 ? (
              <motion.div variants={fadeUp} className="text-center py-20">
                <FiCalendar className="text-white/10 text-7xl mx-auto mb-4" />
                <p className="text-white/40 text-lg">No bookings yet</p>
                <p className="text-white/25 text-sm mt-1 mb-6">
                  Find your perfect ride and get moving!
                </p>
                <Link to="/explore" className="btn-primary inline-flex items-center gap-2">
                  Explore Vehicles <FiArrowRight />
                </Link>
              </motion.div>
            ) : (
              <>
                {/* Active Bookings (Ongoing Rides) */}
                {activeBookings.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-brand flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
                      Active Bookings (Ongoing Rides)
                    </h2>
                    {activeBookings.map((b) => (
                      <motion.div
                        key={b._id || b.bookingId}
                        variants={fadeUp}
                        className="card card-hover p-5 border-l-4 border-brand"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
                            <VehicleIcon type={b.vehicleType} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-white truncate">
                                  {b.vehicleName || 'Vehicle'}
                                </h3>
                                <p className="text-white/40 text-xs mt-0.5">
                                  Owner: {b.ownerName || 'Owner'}
                                </p>
                              </div>
                              <StatusBadge status={b.bookingStatus} />
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-white/30 text-xs">
                              <FiCalendar className="text-white/20" />
                              <span>
                                {formatDate(b.startTime)} {formatTime(b.startTime)}
                                {' → '}
                                {formatDate(b.endTime)} {formatTime(b.endTime)}
                              </span>
                            </div>

                            <p className="text-gradient text-lg font-bold mt-2">
                              ₹{(b.totalPrice || 0).toLocaleString('en-IN')}
                            </p>

                            <BookingTimeline status={b.bookingStatus} />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 flex-wrap">
                          <Link
                            to={`/handover/${b._id || b.bookingId}`}
                            className="btn-primary text-xs flex items-center gap-1.5"
                          >
                            <FiCheckCircle /> Return Vehicle
                          </Link>
                          <button className="btn-secondary text-xs flex items-center gap-1.5">
                            <FiPhone className="text-sm" />
                            Contact Owner
                          </button>
                          {b.verificationDetails?.verificationPdfUrl && (
                            <a
                              href={b.verificationDetails.verificationPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost text-xs flex items-center gap-1 text-brand border border-brand/20 rounded-xl px-3 py-1.5 hover:bg-brand/10 transition"
                            >
                              <FiFileText />
                              Agreement PDF
                            </a>
                          )}
                          {b.handoverDetails?.handoverPdfUrl && (
                            <a
                              href={b.handoverDetails.handoverPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost text-xs flex items-center gap-1 text-green-400 border border-green-500/20 rounded-xl px-3 py-1.5 hover:bg-green-500/10 transition"
                            >
                              <FiFileText />
                              Handover PDF
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Upcoming Rides */}
                {upcomingBookings.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white/90">Upcoming Rides</h2>
                    {upcomingBookings.map((b) => (
                      <motion.div
                        key={b._id || b.bookingId}
                        variants={fadeUp}
                        className="card card-hover p-5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
                            <VehicleIcon type={b.vehicleType} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-white truncate">
                                  {b.vehicleName || 'Vehicle'}
                                </h3>
                                <p className="text-white/40 text-xs mt-0.5">
                                  Owner: {b.ownerName || 'Owner'}
                                </p>
                              </div>
                              <StatusBadge status={b.bookingStatus} />
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-white/30 text-xs">
                              <FiCalendar className="text-white/20" />
                              <span>
                                {formatDate(b.startTime)} {formatTime(b.startTime)}
                                {' → '}
                                {formatDate(b.endTime)} {formatTime(b.endTime)}
                              </span>
                            </div>

                            <div className="flex justify-between items-center mt-2.5">
                              <p className="text-gradient text-lg font-bold">
                                ₹{(b.totalPrice || 0).toLocaleString('en-IN')}
                              </p>
                              {b.pricing?.advance && (
                                <span className="text-[10px] text-white/40">
                                  Paid Advance: ₹{b.pricing.advance} | Due: ₹{b.pricing.remaining}
                                </span>
                              )}
                            </div>

                            <BookingTimeline status={b.bookingStatus} />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5 flex-wrap">
                          {['approved', 'accepted', 'under_review', 'pending_verification'].includes(b.bookingStatus) && (
                            <Link
                              to={`/handover/${b._id || b.bookingId}`}
                              className="btn-primary text-xs flex items-center gap-1.5"
                            >
                              <FiCheckCircle /> Handover Verification
                            </Link>
                          )}
                          <button
                            onClick={() => handleCancelClick(b)}
                            disabled={cancellingId === (b._id || b.bookingId)}
                            className="btn-secondary text-xs flex items-center gap-1.5 text-red-400 border-red-500/20 hover:bg-red-500/10"
                          >
                            <FiX className="text-sm" />
                            {cancellingId === (b._id || b.bookingId) ? 'Cancelling…' : 'Cancel Booking'}
                          </button>
                          <button className="btn-secondary text-xs flex items-center gap-1.5">
                            <FiPhone className="text-sm" />
                            Contact Owner
                          </button>
                          {b.verificationDetails?.verificationPdfUrl && (
                            <a
                              href={b.verificationDetails.verificationPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost text-xs flex items-center gap-1 text-brand border border-brand/20 rounded-xl px-3 py-1.5 hover:bg-brand/10 transition"
                            >
                              <FiFileText />
                              Agreement PDF
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            {loading ? (
              [...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)
            ) : completedBookings.length === 0 && cancelledBookings.length === 0 ? (
              <motion.div variants={fadeUp} className="text-center py-20">
                <FiClock className="text-white/10 text-7xl mx-auto mb-4" />
                <p className="text-white/40 text-lg">No booking history</p>
                <p className="text-white/25 text-sm mt-1 mb-6">
                  Your completed and past bookings will appear here.
                </p>
                <Link to="/explore" className="btn-primary inline-flex items-center gap-2">
                  Start Riding <FiArrowRight />
                </Link>
              </motion.div>
            ) : (
              <>
                {/* Completed Rides */}
                {completedBookings.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-green-400">Completed Rides</h2>
                    {completedBookings.map((b) => (
                      <motion.div
                        key={b._id || b.bookingId}
                        variants={fadeUp}
                        className="card p-5 opacity-90 border-l-4 border-green-500/30"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
                            <VehicleIcon type={b.vehicleType} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-white truncate">
                                  {b.vehicleName || 'Vehicle'}
                                </h3>
                                <p className="text-white/40 text-xs mt-0.5">
                                  Owner: {b.ownerName || 'Owner'}
                                </p>
                              </div>
                              <StatusBadge status={b.bookingStatus} />
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-white/30 text-xs">
                              <FiCalendar className="text-white/20" />
                              <span>
                                {formatDate(b.startTime)} → {formatDate(b.endTime)}
                              </span>
                            </div>

                            <p className="text-white/50 text-lg font-bold mt-2">
                              ₹{(b.totalPrice || 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
                          <Link
                            to={`/vehicles/${b.vehicleId}`}
                            className="btn-ghost text-xs flex items-center gap-1.5 text-brand hover:text-white w-fit"
                          >
                            Book Again <FiArrowRight />
                          </Link>
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setReviewBooking(b)}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                                       bg-amber-500/10 text-amber-400 border border-amber-500/20
                                       hover:bg-amber-500/20 transition-all"
                          >
                            <FiStar size={11} />
                            Write Review
                          </motion.button>
                          {b.verificationDetails?.verificationPdfUrl && (
                            <a
                              href={b.verificationDetails.verificationPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost text-xs flex items-center gap-1 text-white/40 border border-white/10 rounded-xl px-3 py-1.5 hover:bg-white/5 transition"
                            >
                              <FiFileText />
                              Agreement PDF
                            </a>
                          )}
                          {b.handoverDetails?.handoverPdfUrl && (
                            <a
                              href={b.handoverDetails.handoverPdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost text-xs flex items-center gap-1 text-green-400 border border-green-500/20 rounded-xl px-3 py-1.5 hover:bg-green-500/10 transition"
                            >
                              <FiFileText />
                              Handover PDF
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Cancelled Bookings */}
                {cancelledBookings.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-white/40">Cancelled & Rejected Bookings</h2>
                    {cancelledBookings.map((b) => (
                      <motion.div
                        key={b._id || b.bookingId}
                        variants={fadeUp}
                        className="card p-5 opacity-70"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-14 h-14 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
                            <VehicleIcon type={b.vehicleType} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold text-white truncate">
                                  {b.vehicleName || 'Vehicle'}
                                </h3>
                                <p className="text-white/40 text-xs mt-0.5">
                                  Owner: {b.ownerName || 'Owner'}
                                </p>
                              </div>
                              <StatusBadge status={b.bookingStatus} />
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-white/30 text-xs">
                              <FiCalendar className="text-white/20" />
                              <span>
                                {formatDate(b.startTime)} → {formatDate(b.endTime)}
                              </span>
                            </div>

                            <p className="text-white/50 text-lg font-bold mt-2">
                              ₹{(b.totalPrice || 0).toLocaleString('en-IN')}
                            </p>

                            {b.refundAmount !== undefined && (
                              <p className="text-[11px] text-green-400 mt-1">
                                Refund Issued: ₹{b.refundAmount} ({b.refundPolicyApplied})
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5">
                          <Link
                            to={`/vehicles/${b.vehicleId}`}
                            className="btn-ghost text-xs flex items-center gap-1.5 text-brand hover:text-white w-fit"
                          >
                            Book Again <FiArrowRight />
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* FAVORITES TAB */}
        {tab === 'favorites' && (
          <div>
            {favLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card p-4 space-y-3">
                    <div className="skeleton h-4 w-3/4 rounded-lg" />
                    <div className="skeleton h-3 w-1/2 rounded-lg" />
                    <div className="skeleton h-3 w-1/3 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : favoriteVehicles.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <FiHeart className="text-white/10 text-7xl mx-auto mb-4" />
                <p className="text-white/40 text-lg">No favorites yet</p>
                <p className="text-white/25 text-sm mt-1 mb-6">
                  Heart the vehicles you love and find them here.
                </p>
                <Link to="/explore" className="btn-primary inline-flex items-center gap-2">
                  Explore Vehicles <FiArrowRight />
                </Link>
              </motion.div>
            ) : (
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {favoriteVehicles.map((v) => {
                  const Icon = v.type === 'bike' ? RiMotorbikeLine : RiEBikeLine
                  return (
                    <motion.div
                      key={v._id}
                      variants={fadeUp}
                      className="card card-hover p-4 relative group"
                    >
                      <button
                        onClick={() => handleUnfavorite(v._id)}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition z-10"
                        title="Remove from favorites"
                      >
                        <FiHeart className="fill-current text-sm" />
                      </button>

                      <Link to={`/vehicles/${v._id}`} className="block">
                        <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center mb-3">
                          <Icon className="text-brand text-2xl" />
                        </div>

                        <h3 className="font-semibold text-sm text-white truncate pr-8">
                          {v.name}
                        </h3>

                        <div className="flex items-center gap-1 mt-1 text-white/30 text-xs">
                          <FiMapPin className="text-[10px]" />
                          <span className="truncate">{v.location || 'Dibrugarh'}</span>
                        </div>

                        {v.rating > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs">
                            <FiStar className="text-yellow-400 text-[10px]" />
                            <span className="text-white/50">{v.rating}</span>
                          </div>
                        )}

                        <p className="text-gradient text-sm font-bold mt-2">
                          ₹{v.pricePerDay || v.pricePerHour}/
                          {v.pricePerDay ? 'day' : 'hr'}
                        </p>
                      </Link>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="card p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/20">
                <span className="text-3xl font-bold text-white">
                  {(user?.name || 'R').charAt(0).toUpperCase()}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white">
                {user?.name || 'Rider'}
              </h2>
              <div className="flex items-center justify-center gap-1.5 mt-1 text-white/40 text-sm">
                <FiMail className="text-xs" />
                <span>{user?.email || 'rider@lupu.in'}</span>
              </div>

              <p className="text-white/25 text-xs mt-2">
                Member since{' '}
                {user?.createdAt
                  ? formatDate(user.createdAt)
                  : 'Recently'}
              </p>

              <div className="divider my-6" />

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-2 rounded-xl p-3">
                  <div className="text-xl font-bold text-white">
                    {bookings.length}
                  </div>
                  <div className="text-white/30 text-[10px] uppercase tracking-wider mt-1">
                    Total
                  </div>
                </div>
                <div className="bg-surface-2 rounded-xl p-3">
                  <div className="text-xl font-bold text-green-400">
                    {totalCompleted}
                  </div>
                  <div className="text-white/30 text-[10px] uppercase tracking-wider mt-1">
                    Completed
                  </div>
                </div>
                <div className="bg-surface-2 rounded-xl p-3">
                  <div className="text-xl font-bold text-brand">
                    {activeBookings.length}
                  </div>
                  <div className="text-white/30 text-[10px] uppercase tracking-wider mt-1">
                    Active
                  </div>
                </div>
              </div>

              <Link
                to="/profile"
                className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
              >
                <FiUser />
                View Full Profile
              </Link>
            </div>
          </motion.div>
        )}
      </div>

      {/* CANCELLATION MODAL */}
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
                  <button
                    onClick={() => setCancelModalBooking(null)}
                    className="btn-secondary w-1/2 py-2.5"
                  >
                    Keep Booking
                  </button>
                  <button
                    onClick={confirmCancel}
                    className="btn-primary bg-red-600 hover:bg-red-700 w-1/2 py-2.5"
                  >
                    Confirm Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      <ReviewModal
        isOpen={!!reviewBooking}
        onClose={() => setReviewBooking(null)}
        booking={reviewBooking}
        currentUser={user}
        role="renter"
      />
    </PageWrapper>
  )
}
