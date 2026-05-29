import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiThumbsUp, FiMessageSquare } from 'react-icons/fi'
import StarRating from './StarRating'
import { markReviewHelpful } from '../firebase/firestoreService'

/**
 * ReviewCard — displays a single review in Airbnb/Uber style.
 *
 * Props:
 *  - review: { _id, reviewerName, rating, comment, createdAt, helpful, reviewType }
 *  - currentUserId: to prevent self-vote
 */

function timeAgo(value) {
  if (!value) return ''
  const date = value?.toDate ? value.toDate() : new Date(value)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// Pastel avatar colors from name hash
const AVATAR_COLORS = [
  'from-orange-500 to-red-500',
  'from-violet-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-yellow-500',
]
function avatarColor(name = '') {
  let hash = 0
  for (const c of name) hash += c.charCodeAt(0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function ReviewCard({ review, currentUserId }) {
  const [helpful, setHelpful] = useState(review.helpful || 0)
  const [voted, setVoted] = useState(false)

  const handleHelpful = async () => {
    if (voted || review.reviewerId === currentUserId) return
    try {
      await markReviewHelpful(review._id)
      setHelpful((n) => n + 1)
      setVoted(true)
    } catch { /* silent */ }
  }

  const badgeLabel = {
    vehicle: 'Vehicle Review',
    owner: 'Owner Review',
    customer: 'Customer Review',
  }[review.reviewType] || 'Review'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-[#111111]/60 backdrop-blur-sm border border-white/8
                 rounded-2xl p-5 hover:border-white/15 transition-all duration-300"
    >
      {/* Top row: avatar + meta */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor(review.reviewerName)}
                         flex items-center justify-center text-white text-sm font-bold shrink-0`}>
          {getInitials(review.reviewerName)}
        </div>

        {/* Name + stars + time */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm text-white">{review.reviewerName || 'Anonymous'}</span>
            <span className="text-white/20 text-xs hidden sm:inline">·</span>
            <span className="text-white/30 text-xs">{timeAgo(review.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRating value={review.rating} size={12} />
            <span className="text-xs text-amber-400 font-medium">{review.rating}.0</span>
          </div>
        </div>

        {/* Review type badge */}
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide
                         bg-white/5 text-white/30 border border-white/8 px-2 py-0.5 rounded-full">
          {badgeLabel}
        </span>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="text-white/60 text-sm leading-relaxed ml-13 pl-1">
          "{review.comment}"
        </p>
      )}

      {/* Helpful */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleHelpful}
          disabled={voted || review.reviewerId === currentUserId}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all
            ${voted
              ? 'bg-brand/10 border-brand/30 text-brand'
              : 'bg-white/5 border-white/10 text-white/30 hover:bg-white/10 hover:text-white/60'
            } disabled:cursor-not-allowed`}
        >
          <FiThumbsUp size={11} />
          Helpful {helpful > 0 && <span className="font-semibold">{helpful}</span>}
        </button>
      </div>
    </motion.div>
  )
}
