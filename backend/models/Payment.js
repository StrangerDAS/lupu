import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
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
    rentalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    securityDeposit: {
      type: Number,
      default: 0,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    ownerPayoutAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    type: {
      type: String,
      enum: ['rental', 'advance', 'final', 'deposit', 'refund', 'payout'],
      default: 'rental',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'success', 'failed', 'refunded', 'cancelled', 'not_integrated'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: 'none',
    },
    transactionReference: {
      type: String,
      default: null,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    payoutStatus: {
      type: String,
      enum: ['unsettled', 'processing', 'settled', 'hold'],
      default: 'unsettled',
    },
    payoutDetails: {
      upiId: String,
      accountHolderName: String,
      accountNumberMasked: String,
      ifscCode: String,
    },
    notes: String,
  },
  { timestamps: true }
)

// Indexes for common dashboard queries and lookup optimization
paymentSchema.index({ bookingId: 1 })
paymentSchema.index({ renterId: 1 })
paymentSchema.index({ ownerId: 1 })
paymentSchema.index({ status: 1 })

export default mongoose.model('Payment', paymentSchema)

