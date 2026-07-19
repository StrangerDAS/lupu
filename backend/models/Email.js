import mongoose from 'mongoose'

const emailSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: 'delivered',
    },
  },
  { timestamps: true }
)

emailSchema.index({ to: 1 })
emailSchema.index({ createdAt: -1 })

export default mongoose.model('Email', emailSchema)
