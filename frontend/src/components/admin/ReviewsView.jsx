import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiTrash2, FiAlertCircle } from 'react-icons/fi'
import { moderateReview } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function ReviewsView({ reviews = [] }) {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const safeReviews = Array.isArray(reviews) ? reviews : []
  const filteredReviews = safeReviews.filter(r =>
    (r?.comment || '').toLowerCase().includes(search.toLowerCase()) ||
    (r?.reviewerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r?.vehicleName || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this review from the platform? This action recalculates vehicle ratings.')) return
    try {
      await moderateReview(id, user._id, user.name, 'Policy violation - inappropriate content')
      toast.success('Review removed.')
    } catch (err) {
      toast.error('Failed to moderate: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Review Moderation Board</h2>
          <p className="text-white/40 text-xs">Moderate feedback comments, ratings, and remove abusive or fake reviews.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReviews.length === 0 ? (
          <div className="col-span-full py-10 text-center text-white/30 text-xs">
            No reviews logged.
          </div>
        ) : (
          filteredReviews.map(r => (
            <motion.div layout key={r?._id || r?.id} className="glass p-4 rounded-xl border border-white/5 bg-surface-2/15 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-semibold text-brand">{r?.reviewerName || 'Unknown'}</span>
                  <span className="text-white/30">Target: {r?.vehicleName || 'User Listing'}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`text-xs ${i < (r?.rating || 0) ? 'text-yellow-400' : 'text-white/10'}`}>★</span>
                  ))}
                  <span className="text-[10px] text-white/40 ml-1">Rating: {r?.rating || 0}/5</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-medium mt-1">"{r?.comment}"</p>
              </div>

              <div className="flex justify-end pt-2 border-t border-white/5">
                <button
                  onClick={() => handleDelete(r._id || r.id)}
                  className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1"
                >
                  <FiTrash2 /> Remove Review
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
