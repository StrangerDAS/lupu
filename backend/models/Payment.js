import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    renterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ['advance', 'final', 'refund'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    platformFee: {
      type: Number,
      default: 50,
    },
    ownerShare: {
      type: Number,
      default: 0,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
    },
    errorMessage: String,
  },
  { timestamps: true }
)

// Indexes for common dashboard queries and lookup optimization
paymentSchema.index({ bookingId: 1 })
paymentSchema.index({ renterId: 1 })
paymentSchema.index({ ownerId: 1 })

export default mongoose.model('Payment', paymentSchema)
