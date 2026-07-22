import mongoose from 'mongoose'

/**
 * User schema — OTP-based authentication.
 * No password field. Supports login via email OR phone.
 * Roles: user | owner | admin
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,       // allows multiple docs with no email
      lowercase: true,
      trim: true,
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,       // allows multiple docs with no phone
      trim: true,
    },
    role: {
      type: String,
      enum: ['user', 'owner', 'admin', 'super_admin', 'founder'],
      default: 'user',
    },
    isRider: {
      type: Boolean,
      default: true,
    },
    isOwner: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    avatar: String,
    college: { type: String, trim: true, default: null },
    address: { type: String, trim: true, default: null },
    notificationPreferences: {
      booking:  { type: Boolean, default: true },
      vehicle:  { type: Boolean, default: true },
      payment:  { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
    },
    // Trust & Safety
    isSuspended: {
      type: Boolean,
      default: false,
    },
    fraudScore: {
      type: Number,
      default: 0,
    },
    emergencyContacts: [
      {
        name: String,
        phone: String,
        relation: String,
      }
    ],
    // KYC fields
    collegeIdUrl: { type: String, default: null },
    governmentIdUrl: { type: String, default: null },
    kycStatus: {
      type: String,
      enum: ['unsubmitted', 'pending', 'verified', 'rejected'],
      default: 'unsubmitted',
    },
    kycRejectionReason: { type: String, default: null },
  },
  { timestamps: true }
)

// Indexes for common queries
userSchema.index({ role: 1 })
userSchema.index({ kycStatus: 1 })

export default mongoose.model('User', userSchema)
