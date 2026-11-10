import mongoose from 'mongoose'

/**
 * Verification Schema — Mandatory Renter Identity, Document & Face Verification
 * Tracks full verification lifecycle, masked credentials, liveness/face telemetry, and audit trail.
 */
const verificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Document Type: 'student_id' | 'aadhaar' | 'driving_license'
    documentType: {
      type: String,
      enum: ['student_id', 'aadhaar', 'driving_license'],
      required: true,
    },
    // Document verification status
    documentStatus: {
      type: String,
      enum: [
        'not_started',
        'document_submitted',
        'document_under_review',
        'document_verified',
        'document_rejected',
        'resubmission_required',
      ],
      default: 'document_submitted',
    },
    // Face verification status
    faceStatus: {
      type: String,
      enum: [
        'not_started',
        'face_pending',
        'face_under_review',
        'face_verified',
        'face_failed',
        'resubmission_required',
      ],
      default: 'not_started',
    },
    // Overall renter verification status
    overallStatus: {
      type: String,
      enum: [
        'not_started',
        'document_submitted',
        'face_pending',
        'under_review',
        'verified',
        'rejected',
        'resubmission_required',
      ],
      default: 'document_submitted',
    },

    // Masked Document Numbers (Aadhaar: XXXX-XXXX-1234, DL: AS-****-****-1234, Student: STU-****-1234)
    maskedDocumentNumber: {
      type: String,
      trim: true,
    },

    // Document Assets
    documentFrontUrl: {
      type: String,
      default: null,
    },
    documentBackUrl: {
      type: String,
      default: null,
    },

    // Document Specific Metadata
    studentIdDetails: {
      studentIdNumberMasked: String,
      institutionName: String,
      department: String,
      validUntil: Date,
      isVerified: { type: Boolean, default: false },
    },
    aadhaarDetails: {
      lastFourDigits: String,
      isCompliant: { type: Boolean, default: true },
      isVerified: { type: Boolean, default: false },
    },
    drivingLicenseDetails: {
      licenseNumberMasked: String,
      expiryDate: Date,
      categories: { type: [String], default: ['MCWG'] }, // MCWG, MCWOG, LMV
      isExpired: { type: Boolean, default: false },
      isVerified: { type: Boolean, default: false },
    },

    // Face Verification Assets & Telemetry
    selfieUrl: {
      type: String,
      default: null,
    },
    biometricConsentGiven: {
      type: Boolean,
      default: false,
    },
    biometricConsentTimestamp: {
      type: Date,
      default: null,
    },
    livenessScore: {
      type: Number,
      default: 0,
    },
    livenessCheckPassed: {
      type: Boolean,
      default: false,
    },
    faceMatchScore: {
      type: Number,
      default: 0,
    },
    faceMismatchReason: {
      type: String,
      default: null,
    },
    faceAttemptsCount: {
      type: Number,
      default: 0,
    },
    lastFaceAttemptAt: {
      type: Date,
      default: null,
    },

    // Provider & Review Attribution
    verificationProvider: {
      type: String,
      default: 'admin_review', // 'admin_review' | 'automated_vision' | 'digilocker'
    },
    verificationReference: {
      type: String,
      unique: true,
      sparse: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    resubmissionNotes: {
      type: String,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },

    // Audit Trail
    auditHistory: [
      {
        action: String,
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedByName: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  { timestamps: true }
)

verificationSchema.index({ userId: 1, createdAt: -1 })
verificationSchema.index({ overallStatus: 1 })
verificationSchema.index({ documentStatus: 1 })
verificationSchema.index({ faceStatus: 1 })

export default mongoose.model('Verification', verificationSchema)
