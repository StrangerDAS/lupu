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
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['bike', 'scooty'],
      required: true,
    },
    pricePerHour: {
      type: Number,
      required: [true, 'Price per hour is required'],
      min: [1, 'Price per hour must be positive'],
    },
    pricePerDay: {
      type: Number,
      min: [1, 'Price per day must be positive'],
    },
    securityDeposit: {
      type: Number,
      default: 0,
      min: [0, 'Security deposit cannot be negative'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Pickup location is required'],
      trim: true,
    },
    images: [String],
    photos: [String],
    documents: {
      RC: String,
      Insurance: String,
      PUC: String,
    },
    helmetAvailable: {
      type: Boolean,
      default: false,
    },
    specs: {
      year: Number,
      cc: Number,
      fuel: { type: String, default: 'Petrol' },
      transmission: { type: String, enum: ['Manual', 'Automatic'] },
    },
    verificationStatus: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected'],
      default: 'draft',
    },
    status: {
      type: String,
      enum: ['draft', 'pending_verification', 'under_review', 'approved', 'rejected'],
      default: 'draft',
    },
    submittedAt: Date,
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminNotes: String,
    rejectionReason: String,
    isLive: {
      type: Boolean,
      default: false,
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

// Pre-save middleware to keep status & images in sync with verificationStatus & photos.
// 'images' is the canonical field for the frontend, while 'photos' is retained for legacy integration.
vehicleSchema.pre('save', function (next) {
  // Sync status
  if (this.isModified('verificationStatus')) {
    const map = {
      draft: 'draft',
      submitted: 'pending_verification',
      under_review: 'under_review',
      approved: 'approved',
      rejected: 'rejected',
    }
    this.status = map[this.verificationStatus] || 'draft'
  }
  // Sync images with photos bi-directionally if one is updated
  if (this.isModified('photos') && !this.isModified('images')) {
    this.images = this.photos
  } else if (this.isModified('images') && !this.isModified('photos')) {
    this.photos = this.images
  }
  next()
})

// Indexes for common queries
// Note: registrationNumber already has a unique index from `unique: true` in field definition
vehicleSchema.index({ verificationStatus: 1, isLive: 1 }) // primary listing query
vehicleSchema.index({ type: 1, verificationStatus: 1, isLive: 1 }) // filtered listing query
vehicleSchema.index({ ownerId: 1 })
vehicleSchema.index({ status: 1 }) // admin status check query index

export default mongoose.model('Vehicle', vehicleSchema)
