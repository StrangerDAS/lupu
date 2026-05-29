import { motion } from 'framer-motion'
import { FiStar } from 'react-icons/fi'

/**
 * RatingSummary — Airbnb-style rating overview with distribution bars.
 *
 * Props:
 *  - reviews: array of review objects with `rating` field
 *  - compact: if true, only shows overall number (no bars)
 */
export default function RatingSummary({ reviews = [], compact = false }) {
  if (!reviews.length) return null

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  const rounded = Math.round(avg * 10) / 10

  // Distribution: count for each star 1–5
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <FiStar className="text-amber-400 fill-amber-400" size={14} />
        <span className="font-bold text-white">{rounded}</span>
        <span className="text-white/40 text-sm">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center
                    bg-[#111111]/60 border border-white/8 rounded-2xl p-5">
      {/* Left: big number */}
      <div className="text-center shrink-0">
        <div className="text-5xl font-black text-white leading-none mb-1">{rounded}</div>
        <div className="flex justify-center mb-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <FiStar
              key={s}
              size={14}
              className={s <= Math.round(rounded)
                ? 'text-amber-400 fill-amber-400'
                : 'text-white/20'}
            />
          ))}
        </div>
        <div className="text-white/40 text-xs">
          {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px self-stretch bg-white/10" />

      {/* Right: distribution bars */}
      <div className="flex-1 w-full space-y-1.5">
        {dist.map(({ star, count }) => {
          const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-white/40 w-4 shrink-0">{star}</span>
              <FiStar size={10} className="text-amber-400 fill-amber-400 shrink-0" />
              <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: (5 - star) * 0.07, ease: 'easeOut' }}
                  className="h-full bg-amber-400 rounded-full"
                />
              </div>
              <span className="text-xs text-white/30 w-4 shrink-0 text-right">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
