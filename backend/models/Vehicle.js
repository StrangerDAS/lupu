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
      min: [0, 'Price per day cannot be negative'],
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
      enum: ['draft', 'submitted', 'pending_verification', 'under_review', 'approved', 'rejected'],
      default: 'submitted',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'pending_verification', 'under_review', 'approved', 'rejected'],
      default: 'pending_verification',
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

const syncStatusMap = (val) => {
  if (val === 'submitted' || val === 'pending_verification') {
    return { verificationStatus: 'submitted', status: 'pending_verification' }
  }
  if (val === 'approved') {
    return { verificationStatus: 'approved', status: 'approved' }
  }
  if (val === 'rejected') {
    return { verificationStatus: 'rejected', status: 'rejected' }
  }
  if (val === 'under_review') {
    return { verificationStatus: 'under_review', status: 'under_review' }
  }
  return { verificationStatus: 'draft', status: 'draft' }
}

// Pre-save middleware to keep status & images in sync with verificationStatus & photos.
vehicleSchema.pre('save', function (next) {
  if (this.isModified('verificationStatus') || this.isModified('status')) {
    const activeVal = this.isModified('verificationStatus') ? this.verificationStatus : this.status
    const synced = syncStatusMap(activeVal)
    this.verificationStatus = synced.verificationStatus
    this.status = synced.status
  }
  // Sync images with photos bi-directionally if one is updated
  if (this.isModified('photos') && !this.isModified('images')) {
    this.images = this.photos
  } else if (this.isModified('images') && !this.isModified('photos')) {
    this.photos = this.images
  }
  next()
})

// Pre-findOneAndUpdate hook to keep fields synchronized across findByIdAndUpdate operations
vehicleSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate()
  if (!update) return next()
  const setObj = update.$set || update
  if (setObj.verificationStatus || setObj.status) {
    const activeVal = setObj.verificationStatus || setObj.status
    const synced = syncStatusMap(activeVal)
    setObj.verificationStatus = synced.verificationStatus
    setObj.status = synced.status
  }
  if (setObj.photos && !setObj.images) {
    setObj.images = setObj.photos
  } else if (setObj.images && !setObj.photos) {
    setObj.photos = setObj.images
  }
  next()
})

// Indexes for common queries
vehicleSchema.index({ verificationStatus: 1, isLive: 1 })
vehicleSchema.index({ status: 1, isLive: 1 })
vehicleSchema.index({ type: 1, verificationStatus: 1, isLive: 1 })
vehicleSchema.index({ ownerId: 1 })

export default mongoose.model('Vehicle', vehicleSchema)

