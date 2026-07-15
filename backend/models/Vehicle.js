import mongoose from 'mongoose'

/**
 * Vehicle schema — matches live server.js behavior exactly.
 * Includes isLive toggle and denormalized owner sub-object for fast reads.
 */
const vehicleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vehicle name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['bike', 'scooty'],
      required: true,
    },
    pricePerHour: {
      type: Number,
      required: [true, 'Price per hour is required'],
      min: 1,
    },
    pricePerDay: {
      type: Number,
      min: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Pickup location is required'],
      trim: true,
    },
    images: [String],
    specs: {
      year: Number,
      cc: Number,
      fuel: { type: String, default: 'Petrol' },
      transmission: { type: String, enum: ['Manual', 'Automatic'] },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    isLive: {
      type: Boolean,
      default: true,
    },
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Denormalized for fast reads — updated when owner profile changes
    owner: {
      name: String,
      rating: { type: Number, default: 0 },
      totalTrips: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

// Indexes for common queries
vehicleSchema.index({ type: 1, status: 1, isLive: 1 })
vehicleSchema.index({ ownerId: 1 })
vehicleSchema.index({ status: 1 })

export default mongoose.model('Vehicle', vehicleSchema)
