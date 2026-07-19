import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerName: {
      type: String,
      default: 'User',
    },
    reviewedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    vehicleName: String,
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
    },
    reviewType: {
      type: String,
      enum: ['vehicle', 'owner', 'customer'],
      required: true,
    },
    helpful: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

// Prevent duplicate reviews on database level
reviewSchema.index({ bookingId: 1, reviewerId: 1, reviewType: 1 }, { unique: true })
reviewSchema.index({ vehicleId: 1, reviewType: 1 })
reviewSchema.index({ reviewedUserId: 1 })

export default mongoose.model('Review', reviewSchema)
