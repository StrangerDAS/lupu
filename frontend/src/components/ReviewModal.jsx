import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import StarRating from './StarRating'
import { reviewAPI } from '../api/endpoints'

/**
 * ReviewModal — Uber/Airbnb-style post-booking review flow.
 *
 * Opens after a ride is completed. Supports two separate reviews in one modal:
 *   Step 1: Rate the vehicle (reviewType: 'vehicle')
 *   Step 2: Rate the owner  (reviewType: 'owner')
 * OR if opened as owner:
 *   Step 1: Rate the customer (reviewType: 'customer')
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - booking: { _id, vehicleId, vehicleName, ownerId, ownerName, renterId, renterName }
 *  - currentUser: { _id, name, email }
 *  - role: 'renter' | 'owner'
 */

const PROMPTS = {
  vehicle: [
    'How was the vehicle condition?',
    'Was the bike clean and well-maintained?',
    'Would you ride this vehicle again?',
  ],
  owner: [
    'Was the owner helpful and responsive?',
    'Did the handover go smoothly?',
    'Would you book from this owner again?',
  ],
  customer: [
    'Did the customer return the vehicle on time?',
    'Was the vehicle returned in good condition?',
    'Would you rent to this customer again?',
  ],
}

function getSteps(role) {
  if (role === 'owner') {
    return [{ type: 'customer', label: 'Rate the Renter', target: 'renter' }]
  }
  return [
    { type: 'vehicle', label: 'Rate the Vehicle', target: 'vehicle' },
    { type: 'owner', label: 'Rate the Owner', target: 'owner' },
  ]
}

export default function ReviewModal({ isOpen, onClose, booking, currentUser, role = 'renter' }) {
  const steps = getSteps(role)
  const [stepIndex, setStepIndex] = useState(0)
  const [ratings, setRatings] = useState({})   // { vehicle: 0, owner: 0, customer: 0 }
  const [comments, setComments] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState([]) // steps already submitted

  const currentStep = steps[stepIndex]

  // Check which steps have already been reviewed
  useEffect(() => {
    if (!isOpen || !booking?._id || !currentUser?._id) return
    reviewAPI.getEligibility(booking._id)
      .then((res) => {
        const check = res.data?.check || {}
        const done = steps.filter((s) => check[s.type]).map((s) => s.type)
        setAlreadyReviewed(done)
        // Advance to first unreviewed step
        const firstPending = steps.findIndex((s) => !check[s.type])
        if (firstPending === -1) {
          setDone(true)
        } else {
          setStepIndex(firstPending)
        }
      }).catch(() => {})
  }, [isOpen, booking?._id, currentUser?._id])

  const handleClose = () => {
    setStepIndex(0)
    setRatings({})
    setComments({})
    setDone(false)
    onClose()
  }

  const handleSubmitStep = async () => {
    const rating = ratings[currentStep.type] || 0
    if (rating === 0) {
      toast.error('Please select a star rating')
      return
    }

    setSubmitting(true)
    try {
      await reviewAPI.submit({
        bookingId: booking._id,
        rating,
        comment: comments[currentStep.type] || '',
        reviewType: currentStep.type,
      })
      toast.success(`${currentStep.label} submitted!`)

      // Advance to next step or finish
      if (stepIndex < steps.length - 1) {
        setStepIndex((i) => i + 1)
      } else {
        setDone(true)
      }
    } catch (err) {
      if (err.message?.includes('already')) {
        // Move past already-reviewed step
        if (stepIndex < steps.length - 1) {
          setStepIndex((i) => i + 1)
        } else {
          setDone(true)
        }
      } else {
        toast.error(err.message || 'Failed to submit review')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1)
    } else {
      setDone(true)
    }
  }

  if (!booking) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-md bg-[#0f0f0f] border border-white/10
                            rounded-3xl shadow-2xl shadow-black/60 overflow-hidden">

              {/* Orange glow accent */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r
                              from-transparent via-brand to-transparent" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-brand/10
                              blur-2xl rounded-full" />

              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/5
                           hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <FiX size={16} className="text-white/60" />
              </button>

              <div className="p-7">
                {/* ── Done state ───────────────────────────────── */}
                {done ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-6"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.1 }}
                      className="w-16 h-16 bg-green-500/10 rounded-full flex items-center
                                 justify-center mx-auto mb-4 border border-green-500/20"
                    >
                      <FiCheckCircle size={32} className="text-green-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-white mb-2">Thank you! 🙏</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Your review helps build trust on the LUPU platform.
                      Other users will benefit from your feedback.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleClose}
                      className="mt-6 btn-primary w-full py-3 text-base font-semibold"
                    >
                      Done
                    </motion.button>
                  </motion.div>
                ) : (
                  <>
                    {/* ── Header ───────────────────────────────── */}
                    <div className="mb-6">
                      {/* Step indicator */}
                      {steps.length > 1 && (
                        <div className="flex gap-1.5 mb-4">
                          {steps.map((s, i) => (
                            <div
                              key={s.type}
                              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                                i <= stepIndex ? 'bg-brand' : 'bg-white/10'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand/10 border border-brand/20
                                        flex items-center justify-center">
                          <RiMotorbikeLine size={20} className="text-brand" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{currentStep.label}</h3>
                          <p className="text-white/40 text-xs">{booking.vehicleName}</p>
                        </div>
                      </div>
                    </div>

                    {/* ── Star selector ─────────────────────────── */}
                    <div className="text-center mb-6">
                      <p className="text-white/50 text-sm mb-4">
                        {PROMPTS[currentStep.type][0]}
                      </p>
                      <StarRating
                        value={ratings[currentStep.type] || 0}
                        onChange={(v) => setRatings((prev) => ({ ...prev, [currentStep.type]: v }))}
                        size={40}
                        gap="gap-2"
                      />
                      {(ratings[currentStep.type] || 0) > 0 && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-brand text-sm font-medium mt-2"
                        >
                          {['', 'Poor 😕', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent! 🤩'][ratings[currentStep.type]]}
                        </motion.p>
                      )}
                    </div>

                    {/* ── Comment textarea ──────────────────────── */}
                    <div className="mb-6">
                      <label className="text-white/40 text-xs font-medium mb-2 block">
                        Add a comment (optional)
                      </label>
                      <textarea
                        value={comments[currentStep.type] || ''}
                        onChange={(e) => setComments((prev) => ({ ...prev, [currentStep.type]: e.target.value }))}
                        placeholder={`Share your experience…`}
                        rows={3}
                        maxLength={500}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                                   text-sm text-white placeholder-white/20 resize-none outline-none
                                   focus:border-brand/50 focus:bg-white/8 transition-all"
                      />
                      <div className="text-right text-white/20 text-xs mt-1">
                        {(comments[currentStep.type] || '').length}/500
                      </div>
                    </div>

                    {/* ── Actions ───────────────────────────────── */}
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmitStep}
                        disabled={submitting || !(ratings[currentStep.type] > 0)}
                        className="flex-1 btn-primary py-3 text-base font-semibold
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Submitting…
                          </span>
                        ) : stepIndex < steps.length - 1 ? 'Submit & Continue' : 'Submit Review'}
                      </motion.button>
                      <button
                        onClick={handleSkip}
                        className="px-4 py-3 text-sm text-white/30 hover:text-white/60
                                   transition-colors rounded-xl hover:bg-white/5"
                      >
                        Skip
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
