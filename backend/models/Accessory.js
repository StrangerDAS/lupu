import mongoose from 'mongoose'

/**
 * Accessory schema — rental accessories (helmets, gloves, etc.)
 * Mirrors the mock data structure from the original server.js.
 */
const accessorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Accessory name is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'accessory',
    },
    pricePerDay: {
      type: Number,
      required: [true, 'Price per day is required'],
      min: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    availability: {
      type: Boolean,
      default: true,
    },
    location: {
      type: String,
      trim: true,
    },
    images: [String],
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Denormalized for fast reads
    owner: {
      name: String,
    },
  },
  { timestamps: true }
)

accessorySchema.index({ availability: 1 })
accessorySchema.index({ ownerId: 1 })

export default mongoose.model('Accessory', accessorySchema)
