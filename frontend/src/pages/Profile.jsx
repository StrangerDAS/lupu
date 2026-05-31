import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiUser, FiMail, FiPhone, FiEdit2, FiSave, FiX, FiCalendar, FiShield, FiCheck, FiCheckCircle, FiCamera, FiTrendingUp } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'

import useAuthStore from '../store/authStore'
import { BookingCardSkeleton } from '../components/Skeletons'
import { profileSchema } from '../utils/schemas'


// Direct Firebase/Firestore/Storage integrations
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { getOwnerVehicles, subscribeToRenterBookings, subscribeToOwnerBookings, cancelBooking, updateNotificationPreferences } from '../firebase/firestoreService'

function StatusBadge({ status }) {
  const map = {
    confirmed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    completed: 'bg-green-500/10 text-green-400 border border-green-500/20',
    cancelled: 'bg-surface-3 text-white/30',
    pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  }
  return <span className={`badge capitalize text-xs ${map[status] || 'bg-surface-3 text-white/30'}`}>{status}</span>
}

export default function Profile() {
  const { user, token, setAuth, updateUser, isKycComplete } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [activatingOwner, setActivatingOwner] = useState(false)
  const [vehiclesCount, setVehiclesCount] = useState(0)
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.displayName || user?.name || '', email: user?.email || '', phone: user?.phone || '' },
  })

  // 1. Sync user profile data from Firestore on mount/UID changes
  useEffect(() => {
    const syncProfile = async () => {
      if (!user?.uid) return
      try {
        const userRef = doc(db, 'users', user.uid)
        const snap = await getDoc(userRef)
        if (snap.exists()) {
          const freshData = snap.data()
          updateUser(freshData)
        }
      } catch (err) {
        console.error('Failed to sync profile from Firestore:', err)
      }
    }
    syncProfile()
  }, [user?.uid])

  // 2. Fetch owner's vehicle count if B user (Owner)
  useEffect(() => {
    const fetchOwnerVehicles = async () => {
      if (!user?.uid || !user?.isOwner) return
      try {
        const ownedVehicles = await getOwnerVehicles(user.uid)
        setVehiclesCount(ownedVehicles.length)
      } catch (err) {
        console.error('Failed to fetch owner vehicles:', err)
      }
    }
    fetchOwnerVehicles()
  }, [user?.uid, user?.isOwner])

  // 3. Subscribe to user bookings via Firestore (no REST calls, no 401s)
  useEffect(() => {
    if (!user?.uid) return
    setLoadingBookings(true)

    const subscribeFn = user?.isOwner ? subscribeToOwnerBookings : subscribeToRenterBookings
    const unsub = subscribeFn(user.uid, (data) => {
      setBookings(data)
      setLoadingBookings(false)
    })

    return () => unsub()
  }, [user?.uid, user?.isOwner])

  // 4. Update Profile Info directly in Firestore (no REST backend)
  const onSubmit = async (data) => {
    try {

      // Update Firestore database
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid)
        await updateDoc(userRef, {
          displayName: data.name,
          email: data.email,
          phoneNumber: data.phone || '',
        })
      }

      // Update Zustand local store state
      updateUser({
        name: data.name,
        displayName: data.name,
        email: data.email,
        phone: data.phone || '',
        phoneNumber: data.phone || '',
      })
      toast.success('Profile updated successfully!')
      setEditing(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to update profile: ' + err.message)
    }
  }

  // 5. Handle profile image file upload to Firebase Storage
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB')
      return
    }

    setUploading(true)
    const toastId = toast.loading('Uploading profile image...')
    try {
      const filePath = `profiles/${user.uid}/avatar`
      const fileRef = ref(storage, filePath)
      await uploadBytes(fileRef, file)
      const downloadURL = await getDownloadURL(fileRef)

      // Update Firestore
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { photoURL: downloadURL })

      // Update Zustand Auth Store locally
      updateUser({ photoURL: downloadURL })
      toast.success('Profile image updated successfully!', { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Failed to upload image: ' + err.message, { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  const handleActivateOwner = async () => {
    setActivatingOwner(true)
    try {
      // Write directly to Firestore — no REST backend needed
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid)
        await updateDoc(userRef, {
          isOwner: true,
          role: 'owner',
          roles: ['user', 'owner'],
        })
      }
      // Update local Zustand store
      updateUser({ isOwner: true, role: 'owner' })
      toast.success('Owner role activated! 🎉')
    } catch (err) {
      console.error(err)
      toast.error('Failed to activate owner role')
    } finally {
      setActivatingOwner(false)
    }
  }

  const handleCancel = async (bookingId) => {
    try {
      await cancelBooking(bookingId, 'renter')
      // Firestore subscription will update bookings list automatically
      toast.success('Booking cancelled')
    } catch (err) {
      console.error(err)
      toast.error('Failed to cancel booking')
    }
  }

  const handleTogglePref = async (key) => {
    const currentPrefs = user?.notificationPreferences || { booking: true, vehicle: true, payment: true, email: true }
    const newPrefs = { ...currentPrefs, [key]: !currentPrefs[key] }
    
    // Optimistic UI update
    updateUser({ notificationPreferences: newPrefs })
    
    try {
      if (user?.uid) {
        await updateNotificationPreferences(user.uid, newPrefs)
        toast.success('Preferences updated', { id: 'pref-toast' })
      }
    } catch (err) {
      toast.error('Failed to update preferences', { id: 'pref-toast' })
      updateUser({ notificationPreferences: currentPrefs }) // rollback
    }
  }

  return (
    <PageWrapper>
      <div className="container-main py-10 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-8">My Profile</h1>

        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 md:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
            <div className="relative group w-20 h-20 shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-20 h-20 rounded-2xl object-cover shadow-lg border border-white/10" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-3xl font-bold text-white shrink-0 shadow-lg shadow-brand/20">
                  {user?.displayName?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl cursor-pointer transition-opacity text-white text-[10px] font-medium">
                <FiCamera className="text-base mb-1" />
                Change
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{user?.displayName || user?.name}</h2>
                {isKycComplete() && (
                  <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs flex items-center gap-1.5 py-0.5">
                    <FiCheckCircle size={10} className="text-green-400" /> Verified
                  </span>
                )}
              </div>
              <p className="text-white/40 text-sm mt-0.5">{user?.email}</p>
              {/* Dual-role badges */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {user?.isRider && (
                  <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs flex items-center gap-1">
                    <FiCheck size={10} /> Rider
                  </span>
                )}
                {user?.isOwner && (
                  <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs flex items-center gap-1">
                    <FiCheck size={10} /> Owner
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setEditing(!editing); if (editing) reset() }}
              className={`btn-ghost flex items-center gap-2 text-sm self-start sm:self-center ${editing ? 'text-white/40' : 'text-brand'}`}
            >
              {editing ? <><FiX /> Cancel</> : <><FiEdit2 /> Edit</>}
            </button>
          </div>

          {/* Become Owner Banner */}
          {!user?.isOwner && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-white/5 pt-5 mb-5">
              <div className="card p-5 bg-gradient-to-r from-brand/5 to-purple-500/5 border border-brand/10">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-sm">Become a Vehicle Owner</h3>
                    <p className="text-white/40 text-xs mt-1">List your vehicles & accessories. Earn money when others rent.</p>
                  </div>
                  <button
                    onClick={handleActivateOwner}
                    disabled={activatingOwner}
                    className="btn-primary text-sm px-5 py-2.5 shrink-0"
                  >
                    {activatingOwner ? 'Activating...' : 'Become Owner'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Edit form */}
          {editing && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4 border-t border-white/5 pt-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="prof-name"><FiUser className="inline mr-1" />Full name</label>
                  <input id="prof-name" className="input-field" {...register('name')} />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="label" htmlFor="prof-phone"><FiPhone className="inline mr-1" />Phone</label>
                  <input id="prof-phone" className="input-field" {...register('phone')} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="prof-email"><FiMail className="inline mr-1" />Email</label>
                <input id="prof-email" type="email" className="input-field" {...register('email')} />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex items-center gap-2"><FiSave /> Save Changes</button>
                <button type="button" onClick={() => { setEditing(false); reset() }} className="btn-secondary">Cancel</button>
              </div>
            </motion.form>
          )}
        </motion.div>

        {/* Verification Status */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FiShield className="text-brand" /> Verification Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className={`card p-4 flex flex-col gap-2 border ${
              user?.phoneVerified ? 'border-green-500/20 bg-green-500/5' : 'border-white/10 bg-surface-2'
            }`}>
              <div className="flex items-center justify-between">
                <FiPhone className={user?.phoneVerified ? 'text-green-400' : 'text-white/40'} />
                {user?.phoneVerified && <FiCheck className="text-green-400 bg-green-400/20 rounded-full p-0.5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Phone Number</p>
                <p className={`text-xs ${user?.phoneVerified ? 'text-green-400' : 'text-white/40'}`}>
                  {user?.phoneVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>

            <div className={`card p-4 flex flex-col gap-2 border ${
              user?.emailVerified ? 'border-green-500/20 bg-green-500/5' : 'border-white/10 bg-surface-2'
            }`}>
              <div className="flex items-center justify-between">
                <FiMail className={user?.emailVerified ? 'text-green-400' : 'text-white/40'} />
                {user?.emailVerified && <FiCheck className="text-green-400 bg-green-400/20 rounded-full p-0.5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Email Address</p>
                <p className={`text-xs ${user?.emailVerified ? 'text-green-400' : 'text-white/40'}`}>
                  {user?.emailVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>

          </div>
          {!isKycComplete() && (
            <div className="mt-3 text-right">
               <a href="/verify" className="text-xs text-brand hover:underline">Complete verification →</a>
            </div>
          )}
        </motion.div>

        {/* User Activity Dashboard */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FiCheckCircle className="text-brand" /> My Activity Dashboard ({user?.isOwner ? 'Owner Mode' : 'Renter Mode'})
          </h2>
          
          {user?.isOwner ? (
            /* OWNER SPECIFIC METRICS */
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-3xl font-bold text-white mb-1">{vehiclesCount}</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Listed Vehicles</p>
              </div>
              <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-3xl font-bold text-white mb-1">{user?.totalTrips || '0'}</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Trips Completed</p>
              </div>
              <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-3xl font-bold text-brand mb-1">⭐ {user?.rating || '5.0'}</p>
                <p className="text-xs text-brand uppercase tracking-wider">Owner Rating</p>
              </div>
              <a href="/dashboard" className="card p-5 text-center border border-brand/20 bg-brand/5 hover:bg-brand/10 hover:border-brand/40 transition-all flex flex-col justify-center items-center">
                <FiTrendingUp className="text-brand text-2xl mb-1 animate-pulse" />
                <p className="text-[10px] text-brand font-semibold uppercase tracking-wider">Go to Owner Dashboard →</p>
              </a>
            </div>
          ) : (
            /* RENTER SPECIFIC METRICS */
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-3xl font-bold text-white mb-1">
                  {bookings.filter(b => b.status === 'completed').length}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Completed Trips</p>
              </div>
              <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-3xl font-bold text-white mb-1">
                  {bookings.filter(b => b.status === 'confirmed' || b.status === 'ongoing').length}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Active Bookings</p>
              </div>
              <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
                <p className="text-3xl font-bold text-brand mb-1">{user?.favorites?.length || 0}</p>
                <p className="text-xs text-brand uppercase tracking-wider">Favorites</p>
              </div>
              <a href="/my-bookings" className="card p-5 text-center border border-brand/20 bg-brand/5 hover:bg-brand/10 hover:border-brand/40 transition-all flex flex-col justify-center items-center">
                <FiCalendar className="text-brand text-2xl mb-1 animate-pulse" />
                <p className="text-[10px] text-brand font-semibold uppercase tracking-wider">My Rentals Dashboard →</p>
              </a>
            </div>
          )}
        </motion.div>

        {/* Booking history */}
        <div>
          <h2 className="font-semibold mb-5 flex items-center gap-2">
            <FiCalendar className="text-brand" /> My Bookings
          </h2>
          {loadingBookings ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <BookingCardSkeleton key={i} />)}</div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-14 card">
              <RiMotorbikeLine className="text-white/10 text-6xl mx-auto mb-3" />
              <p className="text-white/40">No bookings yet. <a href="/explore" className="text-brand hover:underline">Browse vehicles →</a></p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b, i) => (
                <motion.div key={b._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {b.items ? b.items.map(i => i.name).join(', ') : b.vehicleId?.name || 'Vehicle'}
                    </div>
                    <div className="text-white/40 text-xs mt-1">
                      {b.startTime ? new Date(b.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      {' → '}
                      {b.endTime ? new Date(b.endTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                    {b.totalAmount && <div className="text-brand text-xs mt-0.5 font-medium">₹{b.totalAmount}</div>}
                  </div>
                  <StatusBadge status={b.status} />
                  {b.status === 'confirmed' && (
                    <button onClick={() => handleCancel(b._id)} className="btn-ghost text-xs text-red-400 hover:text-red-300 shrink-0">
                      Cancel
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Notification Settings */}
        <div className="mt-12">
          <h2 className="font-semibold mb-5 flex items-center gap-2">
            <FiBell className="text-brand" /> Notification Settings
          </h2>
          <div className="card p-6 space-y-4">
            <p className="text-xs text-white/50 mb-2">Control what you receive notifications for across LUPU.</p>
            {[
              { key: 'booking', label: 'Booking Updates', desc: 'Alerts about your rental requests and status changes.' },
              { key: 'vehicle', label: 'Vehicle Updates', desc: 'Approvals, rejections, and live status of your vehicles.' },
              { key: 'payment', label: 'Payment Receipts', desc: 'Confirmation of advances and final payments.' },
              { key: 'email', label: 'Email Notifications', desc: 'Receive a copy of important alerts via email.' },
            ].map(({ key, label, desc }) => {
              const prefs = user?.notificationPreferences || { booking: true, vehicle: true, payment: true, email: true }
              const isOn = prefs[key] !== false
              return (
                <div key={key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="pr-4">
                    <h4 className="text-sm font-semibold text-white/90">{label}</h4>
                    <p className="text-[11px] text-white/40 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => handleTogglePref(key)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${isOn ? 'bg-brand' : 'bg-surface-3'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </PageWrapper>
  )
}

