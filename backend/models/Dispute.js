import mongoose from 'mongoose'

const disputeSchema = new mongoose.Schema(
  {
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
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
      enum: ['open', 'under_review', 'resolved'],
      default: 'open',
    },
    adminNotes: {
      type: String,
    }
  },
  { timestamps: true }
)

export default mongoose.model('Dispute', disputeSchema)
