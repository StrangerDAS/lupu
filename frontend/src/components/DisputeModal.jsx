import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiAlertOctagon } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { safetyAPI } from '../api/endpoints'

export default function DisputeModal({ isOpen, onClose, bookingId }) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason) {
      toast.error('Please select a reason')
      return
    }

    setSubmitting(true)
    const toastId = toast.loading('Submitting dispute...')
    try {
      await safetyAPI.dispute({
        bookingId,
        reason,
        description
      })
      toast.success('Dispute submitted to Trust & Safety team', { id: toastId })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit dispute', { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  const reasonsList = [
    'Vehicle Damage',
    'Payment Issue',
    'Late Return',
    'Unprofessional Behavior',
    'Other'
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-surface rounded-2xl border border-white/10 p-6 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                <FiAlertOctagon className="text-red-500" /> Open Dispute
              </h3>
              <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition">
                <FiX size={20} />
              </button>
            </div>

            <p className="text-sm text-white/60 mb-6">
              You are opening a dispute for this booking. Our Trust & Safety team will review this report and contact both parties.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-2">Reason</label>
                <select
                  className="input w-full"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a reason...</option>
                  {reasonsList.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-2">Details (Optional)</label>
                <textarea
                  className="input w-full min-h-[100px] resize-none"
                  placeholder="Provide additional context to help our investigation..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary bg-red-600 hover:bg-red-700">
                  {submitting ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
