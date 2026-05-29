/**
 * Centralized Firestore CRUD service for LUPU.
 * Replaces REST API calls with direct Firestore operations.
 */
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, setDoc,
  arrayUnion, arrayRemove, increment, limit,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './config'

/* ═══════════════════════════════════════════════════════════
   VEHICLES
   ═══════════════════════════════════════════════════════════ */

const vehiclesCol = collection(db, 'vehicles')

/** Add a new vehicle (owner listing) */
export async function addVehicle(ownerId, ownerName, data) {
  let ownerVerified = false
  try {
    const ownerSnap = await getDoc(doc(db, 'users', ownerId))
    if (ownerSnap.exists()) {
      const ownerData = ownerSnap.data()
      ownerVerified = !!ownerData.emailVerified || !!ownerData.phoneVerified
    }
  } catch (err) {
    console.error('Error checking owner verification status:', err)
  }

  const docRef = await addDoc(vehiclesCol, {
    ...data,
    ownerId,
    ownerName: ownerName || 'Owner',
    ownerVerified,
    isLive: true,
    status: 'approved',
    category: 'vehicle',
    rating: 0,
    totalReviews: 0,
    images: data.images || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

/** Update vehicle fields */
export async function updateVehicle(vehicleId, data) {
  const ref = doc(db, 'vehicles', vehicleId)
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() })
}

/** Delete a vehicle */
export async function deleteVehicle(vehicleId) {
  await deleteDoc(doc(db, 'vehicles', vehicleId))
}

/** Toggle vehicle LIVE/OFFLINE */
export async function toggleVehicleLive(vehicleId) {
  const ref = doc(db, 'vehicles', vehicleId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Vehicle not found')
  const current = snap.data().isLive !== false
  await updateDoc(ref, { isLive: !current, updatedAt: serverTimestamp() })
  return !current
}

/** Get single vehicle by ID */
export async function getVehicleById(vehicleId) {
  const snap = await getDoc(doc(db, 'vehicles', vehicleId))
  if (!snap.exists()) return null
  return { _id: snap.id, ...snap.data() }
}

/** Get all vehicles for a specific owner */
export async function getOwnerVehicles(ownerId) {
  const q = query(vehiclesCol, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
}

/** Subscribe to ALL vehicles (real-time) */
export function subscribeToAllVehicles(callback) {
  const q = query(vehiclesCol, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Vehicle subscription error:', err)
    callback([])
  })
}

/** Subscribe to owner's vehicles (real-time) */
export function subscribeToOwnerVehicles(ownerId, callback) {
  const q = query(vehiclesCol, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Owner vehicles subscription error:', err)
    callback([])
  })
}


/* ═══════════════════════════════════════════════════════════
   BOOKINGS
   ═══════════════════════════════════════════════════════════ */

const bookingsCol = collection(db, 'bookings')

/** Create a new booking request */
export async function createBooking(data) {
  // Check for overlapping accepted/ongoing bookings
  const q = query(
    bookingsCol,
    where('vehicleId', '==', data.vehicleId),
    where('bookingStatus', 'in', ['accepted', 'ongoing'])
  )
  const snap = await getDocs(q)
  const reqStart = new Date(data.startTime).getTime()
  const reqEnd = new Date(data.endTime).getTime()

  const overlaps = snap.docs.some(docSnap => {
    const b = docSnap.data()
    const existStart = new Date(b.startTime).getTime()
    const existEnd = new Date(b.endTime).getTime()
    return Math.max(reqStart, existStart) < Math.min(reqEnd, existEnd)
  })

  if (overlaps) {
    throw new Error('This vehicle is already booked during the selected time period.')
  }

  const docRef = await addDoc(bookingsCol, {
    renterId: data.renterId,
    renterName: data.renterName || 'Renter',
    renterEmail: data.renterEmail || '',
    ownerId: data.ownerId,
    ownerName: data.ownerName || 'Owner',
    vehicleId: data.vehicleId,
    vehicleName: data.vehicleName || 'Vehicle',
    vehicleType: data.vehicleType || 'bike',
    startTime: data.startTime,
    endTime: data.endTime,
    duration: data.duration || 0,
    totalPrice: data.totalPrice || 0,
    pricing: data.pricing || {
      total: data.totalPrice || 0,
      advance: Math.round((data.totalPrice || 0) * 0.25),
      remaining: Math.round((data.totalPrice || 0) * 0.75),
    },
    verificationDetails: data.verificationDetails || null,
    bookingStatus: data.bookingStatus || 'pending_verification',
    agreementAccepted: data.agreementAccepted || false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

/** Update booking status */
export async function updateBookingStatus(bookingId, status) {
  const ref = doc(db, 'bookings', bookingId)

  if (status === 'accepted') {
    const bookingSnap = await getDoc(ref)
    if (!bookingSnap.exists()) throw new Error('Booking not found')
    const booking = bookingSnap.data()

    // 1. Check for overlapping accepted/ongoing bookings
    const q = query(
      bookingsCol,
      where('vehicleId', '==', booking.vehicleId),
      where('bookingStatus', 'in', ['accepted', 'ongoing'])
    )
    const snap = await getDocs(q)
    const reqStart = new Date(booking.startTime).getTime()
    const reqEnd = new Date(booking.endTime).getTime()

    const overlap = snap.docs.some(docSnap => {
      if (docSnap.id === bookingId) return false
      const b = docSnap.data()
      const existStart = new Date(b.startTime).getTime()
      const existEnd = new Date(b.endTime).getTime()
      return Math.max(reqStart, existStart) < Math.min(reqEnd, existEnd)
    })

    if (overlap) {
      throw new Error('This vehicle is already booked during this time period.')
    }

    // 2. Auto-reject other pending bookings that overlap with this accepted one
    const pendingQ = query(
      bookingsCol,
      where('vehicleId', '==', booking.vehicleId),
      where('bookingStatus', '==', 'pending')
    )
    const pendingSnap = await getDocs(pendingQ)
    const rejectPromises = []
    pendingSnap.docs.forEach(docSnap => {
      if (docSnap.id === bookingId) return
      const b = docSnap.data()
      const existStart = new Date(b.startTime).getTime()
      const existEnd = new Date(b.endTime).getTime()
      if (Math.max(reqStart, existStart) < Math.min(reqEnd, existEnd)) {
        rejectPromises.push(updateDoc(doc(db, 'bookings', docSnap.id), {
          bookingStatus: 'rejected',
          updatedAt: serverTimestamp()
        }))
      }
    })
    if (rejectPromises.length > 0) {
      await Promise.all(rejectPromises)
    }
  }

  await updateDoc(ref, { bookingStatus: status, updatedAt: serverTimestamp() })

  // Send status update notifications
  try {
    const bookingSnap = await getDoc(ref)
    if (bookingSnap.exists()) {
      const booking = bookingSnap.data()
      let title = 'Booking Update'
      let msg = `Your booking for ${booking.vehicleName} status is now ${status}.`
      if (status === 'approved') {
        title = 'Booking Approved! 🎉'
        msg = `Great news! The owner has approved your booking for ${booking.vehicleName}.`
      } else if (status === 'rejected') {
        title = 'Booking Rejected'
        msg = `Unfortunately, your booking for ${booking.vehicleName} was rejected by the owner.`
      } else if (status === 'under_review') {
        title = 'More Info Requested'
        msg = `The owner has requested additional details/verification for ${booking.vehicleName}.`
      } else if (status === 'ongoing') {
        title = 'Ride Started 🚘'
        msg = `Your ride on ${booking.vehicleName} has started!`
      } else if (status === 'completed') {
        title = 'Ride Completed! Check out'
        msg = `Your ride on ${booking.vehicleName} is completed. Thank you!`
      }

      await addNotification(booking.renterId, {
        title,
        message: msg,
        bookingId,
        type: 'status'
      })

      // If owner action, also notify owner (for confirmation)
      await addNotification(booking.ownerId, {
        title: `Booking ${status.replace('_', ' ')}`,
        message: `You updated the status of booking for ${booking.vehicleName} to ${status}.`,
        bookingId,
        type: 'status'
      })
    }
  } catch (err) {
    console.error('Error sending booking update notifications:', err)
  }
}

/** Refund calculator helper */
export function calculateRefund(booking, cancelledBy) {
  if (cancelledBy === 'owner') {
    const advancePaid = booking.pricing?.advance || Math.round((booking.totalPrice || 0) * 0.25)
    return {
      refundAmount: advancePaid,
      policy: 'Owner cancelled: 100% refund of advance payment.'
    }
  }

  const startMs = new Date(booking.startTime).getTime()
  const createdMs = booking.createdAt
    ? (booking.createdAt.seconds ? booking.createdAt.seconds * 1000 : new Date(booking.createdAt).getTime())
    : new Date().getTime()
  const nowMs = Date.now()

  const hrsBeforeStart = (startMs - nowMs) / (1000 * 60 * 60)
  const advancePaid = booking.pricing?.advance || Math.round((booking.totalPrice || 0) * 0.25)
  const total = booking.totalPrice || booking.pricing?.total || 0

  // 2+ days early booked: (startMs - createdMs) >= 48 hours
  const isBookedEarly = (startMs - createdMs) >= (48 * 60 * 60 * 1000)
  // cancelled 1+ days before start: hrsBeforeStart >= 24 hours
  const isCancelledEarly = hrsBeforeStart >= 24

  if (isBookedEarly && isCancelledEarly) {
    const refund = Math.round(total * 0.15)
    return {
      refundAmount: Math.min(refund, advancePaid), // Refund cannot exceed advance paid
      policy: 'Cancelled 1+ days before start & booked 2+ days early: 15% of total price refunded.'
    }
  }

  if (hrsBeforeStart < 24) {
    return {
      refundAmount: 0,
      policy: 'Cancelled within 24 hours of start time: Advance payment is non-refundable.'
    }
  }

  return {
    refundAmount: 0,
    policy: 'Cancelled less than 1 day before start or not booked 2+ days early: Non-refundable.'
  }
}

/** Cancel a booking with refund logic */
export async function cancelBooking(bookingId, cancelledBy = 'renter') {
  const ref = doc(db, 'bookings', bookingId)
  const bookingSnap = await getDoc(ref)
  if (!bookingSnap.exists()) throw new Error('Booking not found')
  const booking = { _id: bookingSnap.id, ...bookingSnap.data() }

  const refundInfo = calculateRefund(booking, cancelledBy)

  await updateDoc(ref, {
    bookingStatus: 'cancelled',
    refundAmount: refundInfo.refundAmount,
    refundPolicyApplied: refundInfo.policy,
    cancelledBy,
    updatedAt: serverTimestamp()
  })

  // Create payment log for refund
  if (refundInfo.refundAmount > 0) {
    await createPaymentRecord({
      bookingId,
      amount: refundInfo.refundAmount,
      type: 'refund',
      status: 'completed',
      description: `Refund for cancellation by ${cancelledBy}. Policy: ${refundInfo.policy}`
    })
  }

  // Notify owner and renter
  try {
    await addNotification(booking.ownerId, {
      title: 'Booking Cancelled',
      message: `Booking for ${booking.vehicleName} has been cancelled by ${cancelledBy === 'renter' ? 'renter ' + booking.renterName : 'you'}. Refund: ₹${refundInfo.refundAmount}`,
      bookingId,
      type: 'status'
    })
    
    await addNotification(booking.renterId, {
      title: 'Booking Cancelled',
      message: `Booking for ${booking.vehicleName} has been cancelled by ${cancelledBy === 'owner' ? 'owner ' + booking.ownerName : 'you'}. Refund: ₹${refundInfo.refundAmount}`,
      bookingId,
      type: 'status'
    })
  } catch (err) {
    console.error('Error sending cancellation notifications:', err)
  }
}

/* ═══════════════════════════════════════════════════════════
   PAYMENTS, UPLOADS & NOTIFICATIONS SERVICES
   ═══════════════════════════════════════════════════════════ */

const paymentsCol = collection(db, 'bookingPayments')
const notificationsCol = collection(db, 'notifications')

/** Upload a file blob to Firebase Storage and get download URL */
export async function uploadBookingFile(filePath, file) {
  const fileRef = ref(storage, filePath)
  await uploadBytes(fileRef, file)
  return await getDownloadURL(fileRef)
}

/** Create a payment record log */
export async function createPaymentRecord(data) {
  const docRef = await addDoc(paymentsCol, {
    ...data,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

/** Get payments by booking ID */
export async function getBookingPayments(bookingId) {
  const q = query(paymentsCol, where('bookingId', '==', bookingId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
}

/** Add in-app notification */
export async function addNotification(userId, { title, message, bookingId, type }) {
  if (!userId) return
  await addDoc(notificationsCol, {
    userId,
    title,
    message,
    bookingId: bookingId || '',
    type: type || 'info', // 'info' | 'status' | 'payment'
    read: false,
    createdAt: serverTimestamp(),
  })
}

/** Subscribe to user's notifications in real time */
export function subscribeToUserNotifications(userId, callback) {
  const q = query(notificationsCol, where('userId', '==', userId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Notification subscription error:', err)
    callback([])
  })
}

/** Mark notification as read */
export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true })
}

/** Mark all user notifications as read */
export async function markAllNotificationsRead(userId) {
  const q = query(notificationsCol, where('userId', '==', userId), where('read', '==', false))
  const snap = await getDocs(q)
  const promises = snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }))
  await Promise.all(promises)
}


/** Check if user has an eligible completed booking for a vehicle that is not reviewed yet */
export async function getEligibleBookingForReview(userId, vehicleId) {
  const q = query(
    bookingsCol,
    where('renterId', '==', userId),
    where('vehicleId', '==', vehicleId),
    where('bookingStatus', '==', 'completed')
  )
  const snap = await getDocs(q)
  if (snap.empty) return null

  for (const docSnap of snap.docs) {
    const bookingId = docSnap.id
    const reviewed = await hasReviewed(bookingId, userId, 'vehicle')
    if (!reviewed) {
      return { _id: bookingId, ...docSnap.data() }
    }
  }
  return null
}

/** Get a single booking by ID */
export async function getBookingById(bookingId) {
  const snap = await getDoc(doc(db, 'bookings', bookingId))
  if (!snap.exists()) return null
  return { _id: snap.id, ...snap.data() }
}

/** Subscribe to owner's bookings (real-time) */
export function subscribeToOwnerBookings(ownerId, callback) {
  const q = query(bookingsCol, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Owner bookings subscription error:', err)
    callback([])
  })
}

/** Subscribe to renter's bookings (real-time) */
export function subscribeToRenterBookings(renterId, callback) {
  const q = query(bookingsCol, where('renterId', '==', renterId), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Renter bookings subscription error:', err)
    callback([])
  })
}


/* ═══════════════════════════════════════════════════════════
   FAVORITES
   ═══════════════════════════════════════════════════════════ */

/** Toggle a vehicle as favorite */
export async function toggleFavorite(userId, vehicleId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const favorites = userSnap.exists() ? (userSnap.data().favorites || []) : []
  const isFav = favorites.includes(vehicleId)
  if (isFav) {
    await updateDoc(userRef, { favorites: arrayRemove(vehicleId) })
  } else {
    await updateDoc(userRef, { favorites: arrayUnion(vehicleId) })
  }
  return !isFav
}

/** Get user's favorite vehicle IDs */
export async function getFavorites(userId) {
  const userSnap = await getDoc(doc(db, 'users', userId))
  if (!userSnap.exists()) return []
  return userSnap.data().favorites || []
}

/** Subscribe to user's favorites (real-time) */
export function subscribeToFavorites(userId, callback) {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    callback(snap.exists() ? (snap.data().favorites || []) : [])
  })
}


/* ═══════════════════════════════════════════════════════════
   REVIEWS — Production-grade bidirectional review system
   Schema: reviews/{reviewId}
     - bookingId, reviewerId, reviewerName, reviewerPhotoURL?
     - reviewedUserId (owner or customer being reviewed)
     - vehicleId, vehicleName
     - rating (1–5), comment
     - reviewType: 'vehicle' | 'owner' | 'customer'
     - helpful (count), createdAt
   ═══════════════════════════════════════════════════════════ */

const reviewsCol = collection(db, 'reviews')

/**
 * Submit a review. Enforces:
 * - Booking must be 'completed'
 * - No duplicate reviews (same bookingId + reviewerId + reviewType)
 */
export async function submitReview({ bookingId, reviewerId, reviewerName, reviewedUserId,
  vehicleId, vehicleName, rating, comment, reviewType }) {

  // 1. Verify booking is completed
  const bookingSnap = await getDoc(doc(db, 'bookings', bookingId))
  if (!bookingSnap.exists()) throw new Error('Booking not found')
  if (bookingSnap.data().bookingStatus !== 'completed') {
    throw new Error('Reviews can only be submitted after the ride is completed')
  }

  // 2. Check for duplicate review
  const dupQ = query(
    reviewsCol,
    where('bookingId', '==', bookingId),
    where('reviewerId', '==', reviewerId),
    where('reviewType', '==', reviewType)
  )
  const dupSnap = await getDocs(dupQ)
  if (!dupSnap.empty) throw new Error('You have already submitted a review for this booking')

  // 3. Create the review document
  const docRef = await addDoc(reviewsCol, {
    bookingId,
    reviewerId,
    reviewerName: reviewerName || 'User',
    reviewedUserId,
    vehicleId: vehicleId || '',
    vehicleName: vehicleName || '',
    rating,
    comment: comment || '',
    reviewType,
    helpful: 0,
    createdAt: serverTimestamp(),
  })

  // 4. Update aggregate ratings
  if (reviewType === 'vehicle' && vehicleId) {
    await _updateVehicleRating(vehicleId)
  }
  if (reviewType === 'owner' || reviewType === 'customer') {
    await _updateUserRating(reviewedUserId)
  }

  return docRef.id
}

/** Internal: recalculate and store vehicle aggregate rating */
async function _updateVehicleRating(vehicleId) {
  const q = query(reviewsCol, where('vehicleId', '==', vehicleId), where('reviewType', '==', 'vehicle'))
  const snap = await getDocs(q)
  const ratings = snap.docs.map((d) => d.data().rating)
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  await updateDoc(doc(db, 'vehicles', vehicleId), {
    rating: Math.round(avg * 10) / 10,
    totalReviews: ratings.length,
  })
}

/** Internal: recalculate and store user aggregate rating */
async function _updateUserRating(userId) {
  const q = query(reviewsCol, where('reviewedUserId', '==', userId))
  const snap = await getDocs(q)
  const ratings = snap.docs.map((d) => d.data().rating)
  const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const userRef = doc(db, 'users', userId)
  // setDoc with merge in case user doc doesn't exist yet
  await setDoc(userRef, {
    rating: Math.round(avg * 10) / 10,
    totalReviews: ratings.length,
  }, { merge: true })
}

/** Get all reviews for a vehicle (type: 'vehicle') */
export async function getVehicleReviews(vehicleId) {
  const q = query(
    reviewsCol,
    where('vehicleId', '==', vehicleId),
    where('reviewType', '==', 'vehicle'),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
}

/** Get reviews written about a user (as owner or customer) */
export async function getUserReviews(userId) {
  const q = query(
    reviewsCol,
    where('reviewedUserId', '==', userId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }))
}

/** Check if a user has already reviewed a specific booking with a given reviewType */
export async function hasReviewed(bookingId, reviewerId, reviewType) {
  const q = query(
    reviewsCol,
    where('bookingId', '==', bookingId),
    where('reviewerId', '==', reviewerId),
    where('reviewType', '==', reviewType)
  )
  const snap = await getDocs(q)
  return !snap.empty
}

/** Mark a review as helpful (+1) */
export async function markReviewHelpful(reviewId) {
  await updateDoc(doc(db, 'reviews', reviewId), { helpful: increment(1) })
}

/** Subscribe to vehicle reviews in real-time */
export function subscribeToVehicleReviews(vehicleId, callback) {
  const q = query(
    reviewsCol,
    where('vehicleId', '==', vehicleId),
    where('reviewType', '==', 'vehicle'),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ _id: d.id, ...d.data() })))
  }, () => callback([]))
}

// ── Legacy compat shim (used by old VehicleDetail) ────────

/** @deprecated Use getVehicleReviews instead */
export async function getReviews(vehicleId) {
  return getVehicleReviews(vehicleId)
}

/** @deprecated Use submitReview instead */
export async function addReview(vehicleId, data) {
  // Old subcollection approach — now writes to global reviews collection
  const q = query(
    reviewsCol,
    where('vehicleId', '==', vehicleId),
    where('reviewerId', '==', data.userId),
    where('reviewType', '==', 'vehicle')
  )
  const dup = await getDocs(q)
  if (!dup.empty) throw new Error('Already reviewed')

  await addDoc(reviewsCol, {
    bookingId: data.bookingId || 'legacy',
    reviewerId: data.userId,
    reviewerName: data.userName || 'User',
    reviewedUserId: '',
    vehicleId,
    vehicleName: '',
    rating: data.rating,
    comment: data.comment || '',
    reviewType: 'vehicle',
    helpful: 0,
    createdAt: serverTimestamp(),
  })
  await _updateVehicleRating(vehicleId)
}

/* ═══════════════════════════════════════════════════════════
   VEHICLE HANDOVER & RETURN SERVICES
   ═══════════════════════════════════════════════════════════ */

/** Update handover details for owner/renter role */
export async function updateHandoverDetails(bookingId, role, details) {
  const ref = doc(db, 'bookings', bookingId)
  await updateDoc(ref, {
    [`handoverDetails.${role}`]: {
      ...details,
      timestamp: new Date().toISOString()
    },
    updatedAt: serverTimestamp()
  })
}

/** Save identity verification acknowledgment */
export async function saveIdVerificationAcknowledgement(bookingId, holdAgreed) {
  const ref = doc(db, 'bookings', bookingId)
  await updateDoc(ref, {
    'handoverDetails.idVerified': {
      acknowledged: true,
      holdAgreed,
      timestamp: new Date().toISOString()
    },
    updatedAt: serverTimestamp()
  })
}

/** Finalize handover: set status to ongoing and store agreement PDF URL */
export async function activateBookingRide(bookingId, pdfUrl) {
  const ref = doc(db, 'bookings', bookingId)
  await updateDoc(ref, {
    bookingStatus: 'ongoing',
    'handoverDetails.handoverPdfUrl': pdfUrl,
    updatedAt: serverTimestamp()
  })
}

/** Complete Return checklist and finalize booking as completed */
export async function completeReturnHandover(bookingId, returnData) {
  const ref = doc(db, 'bookings', bookingId)
  await updateDoc(ref, {
    bookingStatus: 'completed',
    returnDetails: {
      ...returnData,
      timestamp: new Date().toISOString()
    },
    updatedAt: serverTimestamp()
  })
}


/* ═══════════════════════════════════════════════════════════
   ADMIN & FOUNDER SERVICES
   ═══════════════════════════════════════════════════════════ */

/** Log an admin action to the audit logs collection */
export async function logAdminAction(adminId, adminName, actionType, affectedRecord, previousState = null, newState = null, notes = '') {
  try {
    await addDoc(collection(db, 'adminActions'), {
      adminId,
      adminName: adminName || 'Admin',
      actionType,
      affectedRecord,
      previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
      newState: newState ? JSON.parse(JSON.stringify(newState)) : null,
      notes,
      timestamp: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error logging admin action:', err)
  }
}

/** Subscribe to all users (real-time) */
export function subscribeToAllUsers(callback) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Users subscription error:', err)
    callback([])
  })
}

/** Suspend a user account */
export async function suspendUser(userId, adminId, adminName, reason) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const previousState = userSnap.exists() ? userSnap.data() : null
  
  await updateDoc(userRef, {
    status: 'suspended',
    suspendedAt: serverTimestamp(),
    suspensionReason: reason,
    updatedAt: serverTimestamp()
  })
  
  await logAdminAction(
    adminId,
    adminName,
    'USER_SUSPENDED',
    { collection: 'users', docId: userId, name: previousState?.displayName || 'Unknown' },
    { status: previousState?.status || 'active' },
    { status: 'suspended', suspensionReason: reason },
    reason
  )
}

/** Restore a user account */
export async function restoreUser(userId, adminId, adminName) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const previousState = userSnap.exists() ? userSnap.data() : null

  await updateDoc(userRef, {
    status: 'active',
    suspendedAt: null,
    suspensionReason: null,
    updatedAt: serverTimestamp()
  })

  await logAdminAction(
    adminId,
    adminName,
    'USER_RESTORED',
    { collection: 'users', docId: userId, name: previousState?.displayName || 'Unknown' },
    { status: 'suspended' },
    { status: 'active' },
    'Account restored to active'
  )
}

/** Update vehicle verification status */
export async function verifyVehicleStatus(vehicleId, status, adminId, adminName, notes = '', rejectionReason = '') {
  const vehicleRef = doc(db, 'vehicles', vehicleId)
  const vehicleSnap = await getDoc(vehicleRef)
  const previousState = vehicleSnap.exists() ? vehicleSnap.data() : null

  const updateData = {
    status, // 'approved', 'rejected', 'under_review', 'needs_update'
    verifiedBy: adminId,
    verifiedByName: adminName,
    verificationNotes: notes,
    updatedAt: serverTimestamp()
  }

  if (rejectionReason) {
    updateData.rejectionReason = rejectionReason
  }

  await updateDoc(vehicleRef, updateData)

  // Log admin action
  await logAdminAction(
    adminId,
    adminName,
    status === 'approved' ? 'VEHICLE_APPROVED' : 'VEHICLE_REJECTED',
    { collection: 'vehicles', docId: vehicleId, name: previousState?.name || 'Unknown' },
    { status: previousState?.status || 'pending' },
    { status, verificationNotes: notes, rejectionReason },
    notes || rejectionReason
  )

  // Notify Owner
  if (previousState?.ownerId) {
    let title = 'Vehicle Listing Update'
    let message = `Your vehicle ${previousState.name} status is now: ${status.toUpperCase().replace('_', ' ')}.`
    if (status === 'approved') {
      title = 'Vehicle Approved! 🟢'
      message = `Congratulations! Your vehicle listing ${previousState.name} has been approved and is now live on LUPU.`
    } else if (status === 'rejected') {
      title = 'Vehicle Rejected 🔴'
      message = `Unfortunately, your vehicle listing ${previousState.name} was rejected. Reason: ${rejectionReason}`
    } else if (status === 'needs_update') {
      title = 'Action Required: Vehicle Listing ⚠️'
      message = `Your vehicle listing ${previousState.name} requires update. Please check notes: ${notes}`
    }

    await addNotification(previousState.ownerId, {
      title,
      message,
      type: 'status'
    })
  }
}

/** Subscribe to all bookings (real-time) */
export function subscribeToAllBookings(callback) {
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('All bookings subscription error:', err)
    callback([])
  })
}

/** Subscribe to all payments (real-time) */
export function subscribeToAllPayments(callback) {
  const q = query(collection(db, 'bookingPayments'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('All payments subscription error:', err)
    callback([])
  })
}

/** Get Platform Settings / Commission Config */
export async function getPlatformSettings() {
  const settingsRef = doc(db, 'platformSettings', 'config')
  const snap = await getDoc(settingsRef)
  if (!snap.exists()) {
    // Default system settings
    return {
      commissionPercentage: 15,
      serviceFee: 50,
      cancellationFee: 100,
      lateFee: 200,
      gstPercentage: 18,
      refundRules: 'Standard Lupu Refund Policy Applied.',
      updatedAt: new Date().toISOString()
    }
  }
  return snap.data()
}

/** Update Platform Settings / Commission Config (Founder only) */
export async function updatePlatformSettings(settings, adminId, adminName) {
  const settingsRef = doc(db, 'platformSettings', 'config')
  const previousSnap = await getDoc(settingsRef)
  const previousState = previousSnap.exists() ? previousSnap.data() : null

  await setDoc(settingsRef, {
    ...settings,
    updatedAt: serverTimestamp(),
    updatedBy: adminId,
    updatedByName: adminName
  }, { merge: true })

  // Log audit trail
  await logAdminAction(
    adminId,
    adminName,
    'COMMISSION_UPDATED',
    { collection: 'platformSettings', docId: 'config', name: 'Platform Parameters' },
    previousState,
    settings,
    'Commission configuration updated'
  )
}

/** Subscribe to all support tickets (real-time) */
export function subscribeToSupportTickets(callback) {
  const q = query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Support tickets subscription error:', err)
    callback([])
  })
}

/** Create support ticket */
export async function createSupportTicket(userId, userName, category, subject, description) {
  const ticketRef = await addDoc(collection(db, 'supportTickets'), {
    userId,
    userName,
    category,
    subject,
    status: 'open',
    messages: [
      {
        senderId: userId,
        senderName: userName,
        message: description,
        timestamp: new Date().toISOString()
      }
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ticketRef.id
}

/** Reply to support ticket (by user or admin) */
export async function replyToSupportTicket(ticketId, senderId, senderName, message, isAdminReply = false) {
  const ticketRef = doc(db, 'supportTickets', ticketId)
  const ticketSnap = await getDoc(ticketRef)
  if (!ticketSnap.exists()) throw new Error('Ticket not found')
  const data = ticketSnap.data()

  const newMsg = {
    senderId,
    senderName,
    message,
    timestamp: new Date().toISOString(),
    isAdmin: isAdminReply
  }

  await updateDoc(ticketRef, {
    messages: arrayUnion(newMsg),
    status: isAdminReply ? 'in_review' : 'open',
    updatedAt: serverTimestamp()
  })
}

/** Close/Resolve support ticket */
export async function updateSupportTicketStatus(ticketId, status, adminId, adminName) {
  const ticketRef = doc(db, 'supportTickets', ticketId)
  await updateDoc(ticketRef, {
    status, // 'in_review', 'resolved', 'closed'
    updatedAt: serverTimestamp()
  })

  await logAdminAction(
    adminId,
    adminName,
    'TICKET_CLOSED',
    { collection: 'supportTickets', docId: ticketId, name: 'Support Case' },
    null,
    { status },
    `Support ticket updated to status: ${status}`
  )
}

/** Subscribe to disputes (real-time) */
export function subscribeToDisputes(callback) {
  const q = query(collection(db, 'disputes'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Disputes subscription error:', err)
    callback([])
  })
}

/** Create a dispute ticket */
export async function createDispute(bookingId, reporterId, reporterName, category, description) {
  const ref = await addDoc(collection(db, 'disputes'), {
    bookingId,
    reporterId,
    reporterName,
    category,
    description,
    status: 'open',
    timeline: [
      {
        action: 'created',
        notes: `Dispute created under category: ${category}. Description: ${description}`,
        timestamp: new Date().toISOString()
      }
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

/** Update dispute status/add timeline entry */
export async function updateDisputeStatus(disputeId, status, adminId, adminName, notes = '') {
  const disputeRef = doc(db, 'disputes', disputeId)
  const disputeSnap = await getDoc(disputeRef)
  if (!disputeSnap.exists()) throw new Error('Dispute not found')

  const timelineEntry = {
    action: status,
    notes,
    adminId,
    adminName,
    timestamp: new Date().toISOString()
  }

  await updateDoc(disputeRef, {
    status, // 'in_review', 'resolved', 'closed'
    timeline: arrayUnion(timelineEntry),
    updatedAt: serverTimestamp()
  })

  await logAdminAction(
    adminId,
    adminName,
    'DISPUTE_RESOLVED',
    { collection: 'disputes', docId: disputeId, name: 'Dispute Case' },
    null,
    { status, notes },
    `Dispute status updated to ${status}. Details: ${notes}`
  )
}

/** Subscribe to reports (real-time) */
export function subscribeToReports(callback) {
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Reports subscription error:', err)
    callback([])
  })
}

/** Create a content/user report */
export async function createReport(reporterId, reporterName, targetId, targetType, category, reason) {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    reporterName,
    targetId,
    targetType, // 'user' | 'vehicle' | 'review'
    category,
    reason,
    status: 'open',
    createdAt: serverTimestamp(),
  })
}

/** Resolve or close content/user report */
export async function resolveReport(reportId, status, adminId, adminName) {
  const reportRef = doc(db, 'reports', reportId)
  await updateDoc(reportRef, {
    status, // 'resolved' | 'closed'
    resolvedAt: serverTimestamp(),
    resolvedBy: adminId,
    resolvedByName: adminName
  })
}

/** Subscribe to audit logs (real-time) */
export function subscribeToAuditLogs(callback) {
  const q = query(collection(db, 'adminActions'), orderBy('timestamp', 'desc'), limit(150))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Audit logs subscription error:', err)
    callback([])
  })
}

/** Subscribe to all reviews (real-time, admin moderation) */
export function subscribeToAllReviews(callback) {
  const q = query(reviewsCol, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Reviews moderation subscription error:', err)
    callback([])
  })
}

/** Remove/Moderate review (abusive review deletion) */
export async function moderateReview(reviewId, adminId, adminName, reason) {
  const reviewRef = doc(db, 'reviews', reviewId)
  const reviewSnap = await getDoc(reviewRef)
  const previousState = reviewSnap.exists() ? reviewSnap.data() : null

  await deleteDoc(reviewRef)

  // Recalculate rating aggregates
  if (previousState?.vehicleId) {
    await _updateVehicleRating(previousState.vehicleId)
  }
  if (previousState?.reviewedUserId) {
    await _updateUserRating(previousState.reviewedUserId)
  }

  // Audit Log
  await logAdminAction(
    adminId,
    adminName,
    'REVIEW_MODERATED',
    { collection: 'reviews', docId: reviewId, name: `Review by ${previousState?.reviewerName || 'Unknown'}` },
    previousState,
    null,
    `Deleted review for reason: ${reason}`
  )
}

/** Add/Create Admin Account User doc (Founder/Super Admin only) */
export async function addAdminAccount(email, name, role, adminId, adminName) {
  // Try to find if user doc already exists under users to change role, otherwise create a mock/placeholder user doc or let them signup.
  // We'll write to db users collection or admins list
  const adminRef = doc(collection(db, 'admins'))
  await setDoc(adminRef, {
    email,
    name,
    role, // 'admin' | 'super_admin' | 'founder'
    createdAt: serverTimestamp()
  })

  await logAdminAction(
    adminId,
    adminName,
    'ADMIN_ADDED',
    { collection: 'admins', docId: adminRef.id, name },
    null,
    { email, name, role },
    `Created administrative role mapping: ${role}`
  )
}

/** Update Admin role (Founder/Super Admin only) */
export async function updateAdminAccountRole(id, role, adminId, adminName) {
  const adminRef = doc(db, 'admins', id)
  const snap = await getDoc(adminRef)
  const previousState = snap.exists() ? snap.data() : null

  await updateDoc(adminRef, { role, updatedAt: serverTimestamp() })

  await logAdminAction(
    adminId,
    adminName,
    'ADMIN_ROLE_UPDATED',
    { collection: 'admins', docId: id, name: previousState?.name || 'Unknown' },
    { role: previousState?.role },
    { role },
    `Updated admin account role to ${role}`
  )
}

/** Remove Admin role mapping (Founder/Super Admin only) */
export async function deleteAdminAccount(id, adminId, adminName) {
  const adminRef = doc(db, 'admins', id)
  const snap = await getDoc(adminRef)
  const previousState = snap.exists() ? snap.data() : null

  await deleteDoc(adminRef)

  await logAdminAction(
    adminId,
    adminName,
    'ADMIN_REMOVED',
    { collection: 'admins', docId: id, name: previousState?.name || 'Unknown' },
    previousState,
    null,
    'Removed administrative account role mapping'
  )
}

/** Subscribe to system admin list (real-time) */
export function subscribeToAdmins(callback) {
  const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
  }, (err) => {
    console.error('Admins list subscription error:', err)
    callback([])
  })
}


