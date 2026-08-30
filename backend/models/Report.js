import mongoose from 'mongoose'

const evidenceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  filename: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false })

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'vehicle', 'booking'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'closed', 'rejected', 'pending', 'investigating', 'dismissed'],
      default: 'open',
    },
    evidence: [evidenceSchema],
    adminNotes: {
      type: String,
      default: ''
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
)

export default mongoose.model('Report', reportSchema)

