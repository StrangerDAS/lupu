import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiAlertCircle, FiCheck, FiPlay, FiClock } from 'react-icons/fi'
import { updateDisputeStatus } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function DisputesView({ disputes = [] }) {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [selectedDispute, setSelectedDispute] = useState(null)
  const [notes, setNotes] = useState('')

  const filteredDisputes = disputes.filter(d =>
    (d.bookingId || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (d._id || d.id || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusUpdate = async (status) => {
    if (!selectedDispute) return
    if (!notes) {
      toast.error('Notes are required to update case timeline')
      return
    }
    try {
      await updateDisputeStatus(selectedDispute._id || selectedDispute.id, status, user._id, user.name, notes)
      toast.success(`Dispute case updated to: ${status.toUpperCase()}`)
      setSelectedDispute(null)
      setNotes('')
    } catch (err) {
      toast.error('Failed to update: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Dispute Resolution Center</h2>
          <p className="text-white/40 text-xs">Investigate payment discrepancies, policy violations, and vehicle safety disputes.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search disputes category, booking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {filteredDisputes.length === 0 ? (
            <div className="glass p-10 rounded-2xl border border-white/5 text-center text-white/30 text-xs">
              No dispute claims currently logged.
            </div>
          ) : (
            filteredDisputes.map(d => (
              <div
                key={d._id || d.id}
                onClick={() => setSelectedDispute(d)}
                className={`glass p-4 rounded-xl border transition cursor-pointer hover:bg-white/5 flex flex-col justify-between gap-3 ${
                  selectedDispute?._id === d._id ? 'border-brand/40 bg-brand/5' : 'border-white/5 bg-surface-2/15'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-[9px] font-bold uppercase tracking-wider">{d.category}</span>
                    <h3 className="font-bold text-xs text-white/95 mt-1.5">Booking Link: {d.bookingId}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                    d.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{d.status}</span>
                </div>
                <p className="text-xs text-white/60 line-clamp-2">{d.description}</p>
                <div className="text-[10px] text-white/30 flex items-center gap-1.5"><FiClock /> Reported by: {d.reporterName}</div>
              </div>
            ))
          )}
        </div>

        {/* Dispute Details & Resolution Panel */}
        <div className="glass p-5 rounded-2xl border border-white/5 space-y-4">
          <h3 className="font-bold text-sm">Resolution Panel</h3>

          {selectedDispute ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-white/30">Claim Details</span>
                <p className="text-white/80 leading-relaxed mt-1 font-medium bg-white/5 p-3 rounded-lg border border-white/5">{selectedDispute.description}</p>
              </div>

              {selectedDispute.timeline && (
                <div className="space-y-2 border-t border-white/5 pt-3">
                  <span className="text-[10px] uppercase font-bold text-white/30">Case History Log</span>
                  <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    {selectedDispute.timeline.map((evt, idx) => (
                      <div key={idx} className="border-l-2 border-brand/40 pl-3 py-1 space-y-0.5">
                        <div className="font-semibold text-white/90 capitalize">{evt.action}</div>
                        <div className="text-[10px] text-white/50">{evt.notes}</div>
                        <div className="text-[9px] text-white/30">{evt.timestamp}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
                <div className="space-y-3 pt-3 border-t border-white/5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-white/50">Resolution Notes & Auditing Action</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Input final actions or review details..."
                      className="input-field text-xs h-16 resize-none p-2"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusUpdate('in_review')}
                      className="flex-1 py-2 bg-yellow-500/20 hover:bg-yellow-500 hover:text-black rounded-lg transition text-[10px] font-bold flex items-center justify-center gap-1"
                    >
                      <FiPlay /> In Review
                    </button>
                    <button
                      onClick={() => handleStatusUpdate('resolved')}
                      className="flex-1 py-2 bg-green-500/20 hover:bg-green-500 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center justify-center gap-1"
                    >
                      <FiCheck /> Resolve
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-white/35 text-xs">
              Select a dispute claim to initiate resolution steps.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
