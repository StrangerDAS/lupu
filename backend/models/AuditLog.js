import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    adminName: {
      type: String,
      required: true
    },
    adminEmail: {
      type: String,
      required: true
    },
    actionType: {
      type: String,
      required: true
    },
    affectedRecord: {
      collectionName: String,
      docId: String,
      name: String
    },
    notes: {
      type: String,
      default: ''
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
)

export default mongoose.model('AuditLog', auditLogSchema)
