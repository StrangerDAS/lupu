import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiClock, FiMapPin, FiStar, FiCheckCircle } from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine } from 'react-icons/ri'
import { getImageUrl } from '../utils/urlUtils'

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
    currentStatus = 'Available',
    bookedFrom,
    bookedUntil,
    availableAgain,
  } = vehicle

  // Only show rating if there are real reviews
  const hasRating = rating > 0 && totalReviews > 0

  const isAvailable = currentStatus === 'Available'
  const isBooked = currentStatus === 'Booked'
  const isPending = currentStatus === 'Pending Approval'
  
  const Icon = type === 'bike' ? RiMotorbikeLine : RiEBikeLine

  // Format dates
  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  const formatTime = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

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
                src={getImageUrl(images[0])}
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
                className={`status-dot ${isAvailable ? 'status-dot--live' : isBooked ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]'}`}
                title={currentStatus}
              />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                isAvailable ? 'text-green-400' : isBooked ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {currentStatus}
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

            {isBooked ? (
              <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 bg-red-500/5 -mx-4 px-4 pb-1 rounded-b-xl">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Booked From:</span>
                  <span className="text-white/70 font-medium">{formatDate(bookedFrom)} {formatTime(bookedFrom)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/40">Booked Until:</span>
                  <span className="text-white/70 font-medium">{formatDate(bookedUntil)} {formatTime(bookedUntil)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                  <span className="text-brand/80 font-medium">Available Again:</span>
                  <span className="text-green-400 font-semibold">{formatDate(availableAgain)} {formatTime(availableAgain)}</span>
                </div>
              </div>
            ) : (
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
                      : isPending ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {currentStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
