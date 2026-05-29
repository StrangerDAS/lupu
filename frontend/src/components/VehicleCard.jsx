import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiClock, FiMapPin, FiStar, FiCheckCircle } from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'

/**
 * Vehicle card shown in explore grid and related listings.
 * Shows a glowing LIVE/OFFLINE status indicator in top-right corner.
 */
export default function VehicleCard({ vehicle, index = 0 }) {
  const {
    _id,
    name,
    type,
    pricePerDay,
    pricePerHour,
    images,
    location,
    rating,
    totalReviews,
    status,
    isLive,
  } = vehicle

  // Only show rating if there are real reviews
  const hasRating = rating > 0 && totalReviews > 0

  const isApproved = status === 'approved'
  const isAvailable = isApproved && isLive !== false
  const Icon = type === 'bike' ? RiMotorbikeLine : RiEBikeLine

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={`/vehicles/${_id}`} className="block group">
        <div className="card card-hover">
          {/* Image */}
          <div className="relative h-48 bg-surface-2 overflow-hidden">
            {images?.[0] ? (
              <img
                src={images[0]}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon className="text-white/10 text-8xl" />
              </div>
            )}
            {/* Type badge */}
            <span className="absolute top-3 left-3 badge bg-black/60 text-white/80 backdrop-blur-sm capitalize">
              <Icon className="mr-1 text-brand" />
              {type}
            </span>
            {/* Owner verified badge */}
            {vehicle.ownerVerified && (
              <span className="absolute bottom-3 left-3 badge bg-green-500/80 text-white backdrop-blur-sm text-[10px] flex items-center gap-1">
                <FiCheckCircle size={10} /> Verified Owner
              </span>
            )}
            {/* Status dot — top right */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
              <span
                className={`status-dot ${isAvailable ? 'status-dot--live' : 'status-dot--offline'}`}
                title={isAvailable ? 'Live' : 'Offline'}
              />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                isAvailable ? 'text-green-400' : 'text-red-400'
              }`}>
                {isAvailable ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base leading-tight line-clamp-1">{name}</h3>
              {hasRating ? (
                <div className="flex items-center gap-1 shrink-0">
                  <FiStar className="text-brand fill-brand" size={13} />
                  <span className="text-sm font-medium">{rating}</span>
                  <span className="text-xs text-white/30">({totalReviews})</span>
                </div>
              ) : (
                <span className="text-xs text-white/20">No reviews</span>
              )}
            </div>

            {location && (
              <div className="flex items-center gap-1 mt-1.5 text-white/40 text-xs">
                <FiMapPin size={11} />
                <span>{location}</span>
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <div>
                {pricePerHour && (
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-brand">₹{pricePerHour}</span>
                    <span className="text-xs text-white/40">/hr</span>
                  </div>
                )}
                {pricePerDay && (
                  <div className="flex items-center gap-1 text-xs text-white/40 mt-0.5">
                    <FiClock size={10} />
                    <span>₹{pricePerDay}/day</span>
                  </div>
                )}
              </div>
              <span
                className={`badge text-xs ${
                  isAvailable
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
