import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiUser, FiMail, FiPhone, FiEdit2, FiSave, FiX, FiCalendar, FiShield, FiCheck } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import { userAPI, bookingAPI, roleAPI } from '../api/endpoints'
import useAuthStore from '../store/authStore'
import { BookingCardSkeleton } from '../components/Skeletons'
import { profileSchema } from '../utils/schemas'
import { MOCK_BOOKINGS } from '../utils/mockData'

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

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name, email: user?.email, phone: user?.phone || '' },
  })

  useEffect(() => {
    const fetch = async () => {
      setLoadingBookings(true)
      try {
        const { data } = await bookingAPI.myBookings()
        setBookings(data?.bookings || data)
      } catch {
        setBookings(MOCK_BOOKINGS)
      } finally {
        setLoadingBookings(false)
      }
    }
    fetch()
  }, [])

  const onSubmit = async (data) => {
    try {
      const res = await userAPI.updateProfile(data)
      setAuth(res.data?.user || { ...user, ...data }, token)
    } catch {
      setAuth({ ...user, ...data }, token)
    }
    toast.success('Profile updated')
    setEditing(false)
  }

  const handleActivateOwner = async () => {
    setActivatingOwner(true)
    try {
      const { data } = await roleAPI.activateOwner()
      updateUser(data.user || { isOwner: true, role: 'owner' })
      toast.success('Owner role activated! 🎉')
    } catch {
      updateUser({ isOwner: true, role: 'owner' })
      toast.success('Owner role activated!')
    }
    setActivatingOwner(false)
  }

  const handleCancel = async (bookingId) => {
    try { await bookingAPI.cancel(bookingId) } catch { /* offline */ }
    setBookings((b) => b.map((x) => x._id === bookingId ? { ...x, status: 'cancelled' } : x))
    toast.success('Booking cancelled')
  }

  return (
    <PageWrapper>
      <div className="container-main py-10 max-w-3xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-8">My Profile</h1>

        {/* Profile card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6 md:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand to-brand-light flex items-center justify-center text-3xl font-bold shrink-0 shadow-lg shadow-brand/20">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{user?.name}</h2>
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

          {/* Become Owner */}
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

        {/* User Activity */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FiCheckCircle className="text-brand" /> My Activity
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
              <p className="text-3xl font-bold text-white mb-1">0</p>
              <p className="text-xs text-white/50 uppercase tracking-wider">Vehicles</p>
            </div>
            <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
              <p className="text-3xl font-bold text-white mb-1">{bookings.filter(b => b.status === 'completed').length}</p>
              <p className="text-xs text-white/50 uppercase tracking-wider">Rentals</p>
            </div>
            <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
              <p className="text-3xl font-bold text-white mb-1">0</p>
              <p className="text-xs text-white/50 uppercase tracking-wider">Reviews</p>
            </div>
            <div className="card p-5 text-center border border-white/5 hover:border-white/10 transition-colors">
              <p className="text-3xl font-bold text-brand mb-1">{bookings.filter(b => b.status === 'confirmed').length}</p>
              <p className="text-xs text-brand uppercase tracking-wider">Active</p>
            </div>
          </div>
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
      </div>
    </PageWrapper>
  )
}
