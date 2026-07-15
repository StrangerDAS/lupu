import mongoose from 'mongoose'

/**
 * Booking schema — supports multi-item bookings (vehicles + accessories).
 * items[] replaces the old single vehicleId field.
 */

const bookingItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },   // string ID for cross-collection compat
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['vehicle', 'accessory'],
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [bookingItemSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'At least one item is required',
      },
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'confirmed',
    },
    agreementAccepted: {
      type: Boolean,
      default: false,
    },
    agreementTimestamp: {
      type: Date,
    },
    notes: String,
  },
  { timestamps: true }
)

// Indexes for common queries
bookingSchema.index({ userId: 1, status: 1 })
bookingSchema.index({ 'items.itemId': 1 })
bookingSchema.index({ createdAt: -1 })

export default mongoose.model('Booking', bookingSchema)
