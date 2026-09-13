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
      // Broad category toggles (legacy — kept for backward compat)
      booking:              { type: Boolean, default: true },
      vehicle:              { type: Boolean, default: true },
      payment:              { type: Boolean, default: true },
      email:                { type: Boolean, default: true },
      // Granular booking notifications
      bookingRequest:       { type: Boolean, default: true },
      bookingAccepted:      { type: Boolean, default: true },
      bookingRejected:      { type: Boolean, default: true },
      bookingCancelled:     { type: Boolean, default: true },
      // Granular payment notifications
      paymentRecorded:      { type: Boolean, default: true },
      paymentConfirmed:     { type: Boolean, default: true },
      paymentDisputed:      { type: Boolean, default: true },
      // Account notifications
      securityAlerts:       { type: Boolean, default: true },
      verificationUpdates:  { type: Boolean, default: true },
    },
    // Trust & Safety
    isSuspended: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
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
    kycType: { type: String, default: 'government_id' },
    collegeIdUrl: { type: String, default: null },
    governmentIdUrl: { type: String, default: null },
    drivingLicenseNumber: { type: String, default: null },
    drivingLicenseUrl: { type: String, default: null },
    aadhaarNumber: { type: String, default: null },
    aadhaarFrontUrl: { type: String, default: null },
    aadhaarBackUrl: { type: String, default: null },
    panNumber: { type: String, default: null },
    panUrl: { type: String, default: null },
    selfieUrl: { type: String, default: null },
    kycDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    kycStatus: {
      type: String,
      enum: ['unsubmitted', 'pending', 'Under Review', 'verified', 'Verified', 'rejected', 'Rejected'],
      default: 'unsubmitted',
    },
    kycSubmittedAt: { type: Date, default: null },
    kycRejectionReason: { type: String, default: null },
    // Owner Payout Information
    payoutDetails: {
      upiId: { type: String, trim: true, default: null },
      accountHolderName: { type: String, trim: true, default: null },
      accountNumber: { type: String, trim: true, default: null },
      ifscCode: { type: String, trim: true, default: null },
      bankName: { type: String, trim: true, default: null },
      isVerified: { type: Boolean, default: false }
    },
  },
  { timestamps: true }
)

// Indexes for common queries
userSchema.index({ role: 1 })
userSchema.index({ kycStatus: 1 })

// Pre-validate middleware to ensure name is populated
userSchema.pre('validate', function (next) {
  if (!this.name || this.name.trim().length < 2) {
    this.name = this.email ? this.email.split('@')[0] : 'LUPU User'
  }
  next()
})

export default mongoose.model('User', userSchema)
