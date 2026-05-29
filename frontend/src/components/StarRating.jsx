import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiStar } from 'react-icons/fi'

/**
 * StarRating — reusable component for displaying and selecting star ratings.
 *
 * Props:
 *  - value: current rating (number 0–5)
 *  - onChange: if provided, renders in interactive mode
 *  - size: pixel size of each star (default 16)
 *  - gap: gap class (default 'gap-0.5')
 *  - glowColor: tailwind class for glow (default 'brand')
 */
export default function StarRating({ value = 0, onChange, size = 16, gap = 'gap-0.5' }) {
  const [hover, setHover] = useState(0)
  const interactive = typeof onChange === 'function'
  const display = hover || value

  return (
    <span className={`inline-flex ${gap}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display
        return (
          <motion.button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange(star)}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            whileHover={interactive ? { scale: 1.25 } : {}}
            whileTap={interactive ? { scale: 0.9 } : {}}
            className={`transition-colors ${interactive ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
            style={{ lineHeight: 1 }}
            aria-label={interactive ? `Rate ${star} star${star > 1 ? 's' : ''}` : undefined}
          >
            <FiStar
              size={size}
              className={
                filled
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]'
                  : 'text-white/20'
              }
            />
          </motion.button>
        )
      })}
    </span>
  )
}

/** Compact display-only stars for cards */
export function StarsBadge({ rating, totalReviews, size = 13 }) {
  if (!rating || !totalReviews) return null
  return (
    <span className="inline-flex items-center gap-1">
      <FiStar size={size} className="text-amber-400 fill-amber-400" />
      <span className="text-sm font-semibold">{rating}</span>
      <span className="text-xs text-white/30">({totalReviews})</span>
    </span>
  )
}
