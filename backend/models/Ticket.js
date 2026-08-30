import mongoose from 'mongoose'

const ticketMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false })

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

const ticketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    userName: {
      type: String,
      required: true
    },
    userEmail: {
      type: String
    },
    subject: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'General'
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'in_progress', 'resolved', 'closed', 'rejected'],
      default: 'open'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    evidence: [evidenceSchema],
    messages: [ticketMessageSchema],
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

export default mongoose.model('Ticket', ticketSchema)

