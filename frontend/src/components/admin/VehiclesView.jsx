import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiFileText, FiEye, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi'
import { verifyVehicleStatus } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function VehiclesView({ vehicles = [] }) {
  const { user: currentAdmin } = useAuthStore()
  const [search, setSearch] = useState('')
  const [activeQueue, setActiveQueue] = useState('pending') // 'pending' | 'approved' | 'rejected' | 'all'
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [notes, setNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionType, setActionType] = useState(null) // 'approve' | 'reject' | 'needs_update'

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.name?.toLowerCase().includes(search.toLowerCase()) || 
                          v.ownerName?.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false

    if (activeQueue === 'all') return true
    if (activeQueue === 'pending') return v.status === 'pending' || v.status === 'under_review' || v.status === 'needs_update'
    return v.status === activeQueue
  })

  const handleVerification = async () => {
    if (!selectedVehicle) return
    try {
      let nextStatus = 'approved'
      if (actionType === 'reject') {
        if (!rejectionReason) {
          toast.error('Rejection reason is required')
          return
        }
        nextStatus = 'rejected'
      } else if (actionType === 'needs_update') {
        nextStatus = 'needs_update'
      }

      await verifyVehicleStatus(
        selectedVehicle._id || selectedVehicle.id,
        nextStatus,
        currentAdmin._id,
        currentAdmin.name,
        notes,
        rejectionReason
      )
      
      toast.success(`Vehicle listing marked as ${nextStatus}`)
      setSelectedVehicle(null)
      setNotes('')
      setRejectionReason('')
    } catch (err) {
      toast.error('Update failed: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Vehicle Verification Queue</h2>
          <p className="text-white/40 text-xs">Verify registration certificates, insurance coverages, and pollution status.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-56">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-8 text-xs py-1.5 h-8.5"
            />
          </div>
        </div>
      </div>

      {/* Queue selector tabs */}
      <div className="flex gap-1.5 bg-surface-2/60 border border-white/5 rounded-xl p-1 w-fit text-xs">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveQueue(tab)}
            className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition ${
              activeQueue === tab ? 'bg-brand text-white' : 'text-white/40 hover:text-white'
            }`}
          >
            {tab === 'pending' ? 'Verification Queue' : tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVehicles.length === 0 ? (
          <div className="col-span-full py-16 text-center text-white/30 text-xs">
            No listings found matching this status filter.
          </div>
        ) : (
          filteredVehicles.map((v) => (
            <motion.div layout key={v._id || v.id} className="card p-4 flex flex-col justify-between border border-white/5 bg-surface-2/20">
              <div className="space-y-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-xs truncate max-w-[180px]">{v.name}</h3>
                    <span className="text-[10px] text-white/40">Owner: {v.ownerName || 'Unknown Owner'}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold capitalize ${
                    v.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    v.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {v.status || 'pending'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[9px] bg-white/5 p-2 rounded-lg text-center border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-white/40 block uppercase font-semibold">RC DOC</span>
                    <span className="text-green-400 flex items-center justify-center gap-0.5"><FiFileText /> Linked</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-white/40 block uppercase font-semibold">INSURANCE</span>
                    <span className="text-green-400 flex items-center justify-center gap-0.5"><FiFileText /> Linked</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-white/40 block uppercase font-semibold">PUC DOC</span>
                    <span className="text-green-400 flex items-center justify-center gap-0.5"><FiFileText /> Linked</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-white/5">
                <button
                  onClick={() => { setSelectedVehicle(v); setActionType('needs_update') }}
                  className="p-2 bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1"
                >
                  <FiRefreshCw /> Re-upload
                </button>
                <button
                  onClick={() => { setSelectedVehicle(v); setActionType('reject') }}
                  className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1"
                >
                  <FiX /> Reject
                </button>
                <button
                  onClick={() => { setSelectedVehicle(v); setActionType('approve') }}
                  className="p-2 bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1"
                >
                  <FiCheck /> Approve
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Verification Action Drawer/Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass max-w-md w-full rounded-2xl p-6 border border-white/10 space-y-4">
            <h3 className="font-bold text-sm text-white/90 capitalize flex items-center gap-2">
              Vehicle Listing Review · {actionType}
            </h3>
            <p className="text-xs text-white/60">
              Confirming decision state for: <strong>{selectedVehicle.name}</strong> listed by {selectedVehicle.ownerName}.
            </p>

            <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-2 text-xs">
              <div className="font-semibold text-white/50 text-[10px] uppercase">Compliance Checks</div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/60">Registration Certificate:</span>
                <button className="text-brand hover:underline font-bold flex items-center gap-0.5"><FiEye /> Inspect File</button>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/60">Motor Insurance Policy:</span>
                <button className="text-brand hover:underline font-bold flex items-center gap-0.5"><FiEye /> Inspect File</button>
              </div>
            </div>

            <div className="space-y-3">
              {actionType === 'reject' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-white/50">Rejection Reason (Sent to owner)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="E.g., Expired Insurance policy, illegible RC document scan..."
                    className="input-field text-xs h-16 resize-none p-2.5"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-white/50">Verification Action Notes (Internal Log)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record verification checklist results..."
                  className="input-field text-xs h-16 resize-none p-2.5"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setSelectedVehicle(null); setNotes(''); setRejectionReason('') }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-xs font-semibold text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleVerification}
                className="px-4 py-2 bg-brand hover:bg-brand-light rounded-xl transition text-xs font-semibold text-white"
              >
                Submit Decision
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
