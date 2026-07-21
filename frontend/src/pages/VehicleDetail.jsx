import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FiStar, FiMapPin, FiClock, FiShield, FiArrowLeft, FiCalendar, FiHeart, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import StarRating from '../components/StarRating'
import ReviewCard from '../components/ReviewCard'
import RatingSummary from '../components/RatingSummary'
import ReportModal from '../components/ReportModal'
import { useVehicle } from '../hooks/useVehicles'
import useAuthStore from '../store/authStore'
import { getFavorites, toggleFavorite } from '../firebase/firestoreService'
import { reviewAPI, bookingAPI } from '../api/endpoints'
import { getImageUrl } from '../utils/urlUtils'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated, isKycComplete } = useAuthStore()
  const { vehicle: fetched, loading } = useVehicle(id)
  const [activeImg, setActiveImg] = useState(0)

  /* ── Favorites state ───────────────────────────────────── */
  const [isFavorited, setIsFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  /* ── Report state ──────────────────────────────────────── */
  const [showVehicleReportModal, setShowVehicleReportModal] = useState(false)
  const [showUserReportModal, setShowUserReportModal] = useState(false)

  /* ── Reviews state ─────────────────────────────────────── */
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [eligibleBooking, setEligibleBooking] = useState(null)
  const [checkingEligibility, setCheckingEligibility] = useState(true)

  // The vehicle data comes purely from the API/Store
  const vehicle = fetched

  // Determine availability: must be approved AND isLive
  const isApproved = vehicle?.status === 'approved'
  const isLive = vehicle?.isLive !== false
  const isBookable = vehicle?.currentStatus === 'Available' || (isApproved && isLive && !vehicle?.currentStatus)

  // Disable dates based on disabledDates from API
  const tileDisabled = ({ date, view }) => {
    if (view === 'month') {
      return (vehicle?.disabledDates || []).some(disabledRange => {
        const start = new Date(disabledRange.start)
        const end = new Date(disabledRange.end)
        // Set date to start of day for accurate comparison
        const checkDate = new Date(date)
        checkDate.setHours(0, 0, 0, 0)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        return checkDate >= start && checkDate <= end
      })
    }
    return false
  }

  /* ── Load favorites on mount ───────────────────────────── */
  useEffect(() => {
    if (!isAuthenticated() || !user?._id || !id) return
    getFavorites(user._id)
      .then((favs) => setIsFavorited(favs.includes(id)))
      .catch(() => {})
  }, [user?._id, id])

  useEffect(() => {
    if (!id) return
    setReviewsLoading(true)
    reviewAPI.getVehicleReviews(id)
      .then((res) => setReviews(res.data?.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false))
  }, [id])

  useEffect(() => {
    if (!isAuthenticated() || !user?._id || !id) {
      setCheckingEligibility(false)
      return
    }
    setCheckingEligibility(true)

    const check = async () => {
      try {
        const { data: bookingsData } = await bookingAPI.myBookings()
        const completedBookings = (bookingsData.bookings || []).filter(
          (b) => b.vehicleId === id && b.status === 'completed'
        )
        let foundBooking = null
        for (const b of completedBookings) {
          const { data: eligibilityData } = await reviewAPI.getEligibility(b._id)
          if (!eligibilityData.check?.vehicle) {
            foundBooking = b
            break
          }
        }
        setEligibleBooking(foundBooking)
      } catch (err) {
        console.error('Error checking review eligibility:', err)
      } finally {
        setCheckingEligibility(false)
      }
    }
    check()
  }, [user?._id, id, reviews])

  /* ── Handlers ──────────────────────────────────────────── */

  const handleBook = () => {
    if (!isAuthenticated()) {
      navigate('/auth/login', { state: { from: `/book/${id}` } })
    } else if (!isKycComplete()) {
      navigate('/complete-profile')
    } else {
      navigate(`/book/${id}`)
    }
  }

  const handleToggleFavorite = async () => {
    if (!user?._id) return
    setFavLoading(true)
    try {
      const nowFav = await toggleFavorite(user._id, vehicle._id)
      setIsFavorited(nowFav)
      toast.success(nowFav ? 'Added to favorites' : 'Removed from favorites')
    } catch {
      toast.error('Could not update favorites')
    } finally {
      setFavLoading(false)
    }
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!eligibleBooking) {
      toast.error('You must complete a ride before writing a review')
      return
    }
    if (reviewRating === 0) {
      toast.error('Please select a star rating')
      return
    }
    setSubmittingReview(true)
    try {
      await reviewAPI.submit({
        bookingId: eligibleBooking._id,
        rating: reviewRating,
        comment: reviewComment,
        reviewType: 'vehicle'
      })
      toast.success('Review submitted!')
      // Refresh reviews
      const updated = await reviewAPI.getVehicleReviews(vehicle._id)
      setReviews(updated.data?.reviews || [])
      setShowReviewForm(false)
      setReviewRating(0)
      setReviewComment('')
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  /* ── Loading skeleton ──────────────────────────────────── */

  if (loading) {
    return (
      <PageWrapper>
        <div className="container-main py-10">
          <div className="skeleton h-8 w-40 rounded-xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="skeleton h-80 rounded-2xl" />
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-5 rounded-lg" style={{ width: `${70 - i * 8}%` }} />
              ))}
            </div>
          </div>
        </div>
      </PageWrapper>
    )
  }

  if (!vehicle) return null

  const Icon = vehicle.type === 'bike' ? RiMotorbikeLine : RiEBikeLine

  return (
    <PageWrapper>
      <div className="container-main py-10">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition"
        >
          <FiArrowLeft /> Back to Explore
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left — Images */}
          <div className="lg:col-span-3 space-y-3">
            {/* Main image */}
            <div className="card h-72 md:h-96 flex items-center justify-center bg-surface-2 overflow-hidden relative">
              {vehicle.images?.[activeImg] ? (
                <img
                  src={getImageUrl(vehicle.images[activeImg])}
                  alt={vehicle.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon className="text-white/10 text-9xl" />
              )}

              {/* Favorite heart — top-left */}
              {isAuthenticated() && (
                <motion.button
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleFavorite}
                  disabled={favLoading}
                  className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-full p-2.5 transition disabled:opacity-50"
                  aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <FiHeart
                    size={20}
                    className={
                      isFavorited
                        ? 'text-red-500 fill-red-500'
                        : 'text-white/70'
                    }
                  />
                </motion.button>
              )}

              {/* Status dot overlay on image — top-right */}
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span
                  className={`status-dot ${isBookable ? 'status-dot--live' : 'status-dot--offline'}`}
                />
                <span className={`text-xs font-semibold uppercase tracking-wider ${
                  isBookable ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isBookable ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            {/* Thumbnails */}
            {vehicle.images?.length > 1 && (
              <div className="flex gap-2">
                {vehicle.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                      activeImg === i ? 'border-brand' : 'border-white/10'
                    }`}
                  >
                    <img src={getImageUrl(img)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            {vehicle.description && (
              <div className="card p-6 mt-4">
                <h2 className="font-semibold mb-3">About this vehicle</h2>
                <p className="text-white/50 text-sm leading-relaxed">{vehicle.description}</p>
              </div>
            )}

            {/* Specs */}
            {vehicle.specs && (
              <div className="card p-6">
                <h2 className="font-semibold mb-4">Specifications</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(vehicle.specs).map(([k, v]) => (
                    <div key={k} className="text-center bg-surface-2 rounded-xl p-3">
                      <div className="text-white/30 text-xs capitalize mb-1">{k}</div>
                      <div className="font-semibold text-sm">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Reviews Section ───────────────────────────── */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  Reviews
                  <span className="text-white/30 text-sm font-normal">
                    ({reviews.length})
                  </span>
                </h2>
                 {isAuthenticated() && !checkingEligibility && eligibleBooking && !showReviewForm && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowReviewForm(true)}
                    className="btn-secondary text-xs px-4 py-2"
                  >
                    Write a Review
                  </motion.button>
                )}
              </div>

              {/* Rating summary bars */}
              {reviews.length > 0 && (
                <div className="mb-6">
                  <RatingSummary reviews={reviews} />
                </div>
              )}

              {/* Review form */}
              <AnimatePresence>
                {showReviewForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSubmitReview}
                    className="bg-surface-2 rounded-xl p-5 mb-6 space-y-4 overflow-hidden"
                  >
                    <div>
                      <label className="label text-sm mb-3 block">Your Rating</label>
                      <StarRating
                        value={reviewRating}
                        onChange={setReviewRating}
                        size={28}
                        gap="gap-1.5"
                      />
                      {reviewRating > 0 && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-brand text-sm mt-2"
                        >
                          {['', 'Poor 😕', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent! 🤩'][reviewRating]}
                        </motion.p>
                      )}
                    </div>
                    <div>
                      <label className="label text-sm mb-2 block">Comment</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Share your experience…"
                        rows={3}
                        maxLength={500}
                        className="input-field w-full resize-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={submittingReview}
                        className="btn-primary text-sm px-6 py-2 disabled:opacity-50"
                      >
                        {submittingReview ? 'Submitting…' : 'Submit Review'}
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment('') }}
                        className="btn-ghost text-sm px-4 py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Reviews list */}
              {reviewsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="skeleton h-4 w-32 rounded-lg" />
                      <div className="skeleton h-3 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <FiStar className="text-white/10 text-4xl mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No reviews yet.</p>
                  <p className="text-white/20 text-xs mt-1">Be the first to share your experience!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <ReviewCard key={r._id} review={r} currentUserId={user?._id} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — Details + Book */}
          <div className="lg:col-span-2 space-y-5">
            {/* Main info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge bg-brand/10 text-brand capitalize text-xs">
                  <Icon className="mr-1" />{vehicle.type}
                </span>
                {/* Status badge with glowing dot */}
                <span className={`badge text-xs flex items-center gap-1.5 ${
                  vehicle.currentStatus === 'Available'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : vehicle.currentStatus === 'Booked' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  <span className={`status-dot ${vehicle.currentStatus === 'Available' ? 'status-dot--live' : vehicle.currentStatus === 'Booked' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`}
                    style={{ width: 8, height: 8 }}
                  />
                  {vehicle.currentStatus || (isBookable ? 'Available' : 'Unavailable')}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">{vehicle.name}</h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-white/50">
                {vehicle.rating > 0 && vehicle.totalReviews > 0 && (
                  <span className="flex items-center gap-1">
                    <FiStar className="text-brand fill-brand" />
                    {vehicle.rating} ({vehicle.totalReviews} reviews)
                  </span>
                )}
                {vehicle.location && (
                  <span className="flex items-center gap-1">
                    <FiMapPin size={13} /> {vehicle.location}
                  </span>
                )}
              </div>
            </div>

            {/* Pricing card */}
            <div className="card p-5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-gradient">₹{vehicle.pricePerHour}</span>
                <span className="text-white/40 text-sm">/hour</span>
              </div>
              {vehicle.pricePerDay && (
                <div className="text-white/40 text-sm flex items-center gap-1">
                  <FiClock size={13} />
                  ₹{vehicle.pricePerDay} / full day (24 hrs)
                </div>
              )}
              <div className="divider my-4" />
              <ul className="space-y-2 text-sm text-white/50">
                <li className="flex items-center gap-2"><FiShield size={13} className="text-green-400" /> Verified vehicle</li>
                <li className="flex items-center gap-2"><FiCalendar size={13} className="text-brand" /> Instant booking</li>
                <li className="flex items-center gap-2"><FiClock size={13} className="text-blue-400" /> Flexible hours</li>
              </ul>
              {/* Report Button */}
              {isAuthenticated() && (
                <button
                  onClick={() => setShowVehicleReportModal(true)}
                  className="w-full mt-3 py-2 text-xs text-white/40 hover:text-white/80 transition flex items-center justify-center gap-1"
                >
                  <FiAlertTriangle size={12} /> Report this vehicle
                </button>
              )}
            </div>

            {/* Owner */}
            {(vehicle.owner || vehicle.ownerName) && (
              <div className="card p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center text-xl font-bold text-brand shrink-0">
                    {(vehicle.owner?.name?.[0] || vehicle.ownerName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{vehicle.owner?.name || vehicle.ownerName}</div>
                    <div className="text-white/40 text-xs mt-0.5">Vehicle Owner</div>
                  </div>
                  {vehicle.ownerVerified ? (
                    <span className="badge bg-green-500/10 text-green-400 text-xs shrink-0 flex items-center gap-1">
                      <FiCheckCircle size={12} /> Verified
                    </span>
                  ) : (
                    <span className="badge bg-white/5 text-white/40 text-xs shrink-0">Not Verified</span>
                  )}
                </div>
                {isAuthenticated() && vehicle.ownerId !== user?._id && (
                  <button
                    onClick={() => setShowUserReportModal(true)}
                    className="w-full py-2 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition flex items-center justify-center gap-1"
                  >
                    <FiAlertTriangle size={12} /> Report User
                  </button>
                )}
              </div>
            )}

            {/* Unavailable notice */}
            {!isBookable && vehicle.currentStatus === 'Pending Approval' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 bg-yellow-500/5 border-yellow-500/20 flex items-center gap-3"
              >
                <span className="status-dot bg-yellow-500" />
                <div>
                  <p className="text-yellow-400 text-sm font-semibold">Currently Unavailable</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    This vehicle is pending admin approval or has been set offline. Check back later.
                  </p>
                </div>
              </motion.div>
            )}

            {vehicle.currentStatus === 'Booked' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 bg-red-500/5 border-red-500/20 flex items-center gap-3"
              >
                <span className="status-dot bg-red-500" />
                <div>
                  <p className="text-red-400 text-sm font-semibold">Currently Booked</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Available again on {new Date(vehicle.availableAgain).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Availability Calendar */}
            <div className="card p-5">
              <h3 className="font-semibold mb-4 text-sm flex items-center gap-2"><FiCalendar className="text-brand"/> Availability Calendar</h3>
              <div className="custom-calendar-wrapper">
                <Calendar
                  tileDisabled={tileDisabled}
                  minDate={new Date()}
                  prev2Label={null}
                  next2Label={null}
                />
              </div>
            </div>

            {/* Book button */}
            <motion.button
              whileHover={isBookable ? { scale: 1.02 } : {}}
              whileTap={isBookable ? { scale: 0.98 } : {}}
              onClick={handleBook}
              disabled={!isBookable}
              className="btn-primary w-full text-center text-base py-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBookable ? 'Book This Vehicle' : 'Currently Unavailable'}
            </motion.button>
            {isBookable && (
              <p className="text-center text-white/30 text-xs">No payment required to confirm</p>
            )}
          </div>
        </div>
      </div>
      {/* Report Modals */}
      <ReportModal
        isOpen={showVehicleReportModal}
        onClose={() => setShowVehicleReportModal(false)}
        targetType="vehicle"
        targetId={vehicle._id}
        targetName={vehicle.name}
      />
      <ReportModal
        isOpen={showUserReportModal}
        onClose={() => setShowUserReportModal(false)}
        targetType="user"
        targetId={vehicle.ownerId || vehicle.owner?._id}
        targetName={vehicle.ownerName || vehicle.owner?.name}
      />
    </PageWrapper>
  )
}
