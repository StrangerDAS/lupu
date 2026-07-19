import mongoose from 'mongoose'

/**
 * Booking schema — stores LUPU rental agreements and handover checklists.
 * Transitions through: draft -> requested -> accepted -> rejected -> cancelled -> confirmed -> ready_for_pickup -> ongoing -> completed
 */
const bookingSchema = new mongoose.Schema(
  {
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    renterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    status: {
      type: String,
      enum: [
        'draft',
        'requested',
        'accepted',
        'rejected',
        'cancelled',
        'confirmed',
        'ready_for_pickup',
        'ongoing',
        'completed'
      ],
      default: 'requested',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    deposit: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Meta fields matching frontend expectations
    duration: Number,
    vehicleName: String,
    vehicleType: String,
    renterName: String,
    renterEmail: String,
    ownerName: String,
    pricing: {
      total: Number,
      advance: Number,
      remaining: Number,
    },
    // MVP Payment System Fields
    rentalAmount: { type: Number, default: 0 },
    bookingFee: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['Online Payment', 'Pending', 'Paid', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    paymentMethod: { type: String, default: 'razorpay' },
    ownerPaymentStatus: {
      type: String,
      enum: ['Pending Pickup', 'Pending Owner Payment', 'Paid To Owner', 'Completed'],
      default: 'Pending Pickup',
    },
    lateReturnInfo: {
      lateHours: { type: Number, default: 0 },
      lateCharge: { type: Number, default: 0 }
    },
    ownerCommission: { type: Number, default: 0 },
    verificationDetails: {
      currentAddress: String,
      permanentAddress: String,
      collegeName: String,
      aadhaarNumber: String,
      selfieUrl: String,
      aadhaarFrontUrl: String,
      aadhaarBackUrl: String,
      collegeIdUrl: String,
      signatureUrl: String,
      verificationPdfUrl: String,
    },
    handoverDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    agreementAccepted: {
      type: Boolean,
      default: false,
    },
    agreementVersion: String,
    agreementAcceptedAt: Date,
    ipAddress: String,
    userAgent: String,
    agreementTimestamp: Date,
    pickupReminderSent: {
      type: Boolean,
      default: false,
    },
    returnReminderSent: {
      type: Boolean,
      default: false,
    },
    reviewReminderSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

// Indexes for common queries and validation checks
bookingSchema.index({ vehicleId: 1, startTime: 1, endTime: 1 })
bookingSchema.index({ renterId: 1, status: 1 })
bookingSchema.index({ ownerId: 1, status: 1 })
bookingSchema.index({ createdAt: -1 })

export default mongoose.model('Booking', bookingSchema)
