import mongoose from 'mongoose'

const sosSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    location: {
      // e.g., string representation or GeoJSON. keeping it simple as string for now.
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
    },
    resolvedAt: {
      type: Date,
    },
    adminNotes: {
      type: String,
    }
  },
  { timestamps: true }
)

export default mongoose.model('SOS', sosSchema)
