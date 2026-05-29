import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiFlag, FiCheckCircle } from 'react-icons/fi'
import { resolveReport } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function ReportsView({ reports = [] }) {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const filteredReports = reports.filter(r =>
    (r.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.targetType || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.reporterName || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleResolve = async (id) => {
    try {
      await resolveReport(id, 'resolved', user._id, user.name)
      toast.success('Report resolved.')
    } catch (err) {
      toast.error('Update failed: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Violation Reports</h2>
          <p className="text-white/40 text-xs">Investigate listing flags, user misconduct reports, and policy breaches.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReports.length === 0 ? (
          <div className="col-span-full py-10 text-center text-white/30 text-xs">
            No violation reports logged.
          </div>
        ) : (
          filteredReports.map(r => (
            <motion.div layout key={r._id || r.id} className="glass p-4 rounded-xl border border-white/5 bg-surface-2/15 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded text-[9px] font-bold uppercase">{r.category}</span>
                  <span className="text-[10px] text-white/40">Target: {r.targetType} ({r.targetId})</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-medium mt-1">{r.reason}</p>
                <div className="text-[10px] text-white/30 flex items-center gap-1.5"><FiFlag /> Reported by: {r.reporterName}</div>
              </div>

              {r.status === 'open' ? (
                <div className="flex justify-end pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleResolve(r._id || r.id)}
                    className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white rounded-lg transition text-[10px] font-bold flex items-center gap-1"
                  >
                    <FiCheckCircle /> Mark Resolved
                  </button>
                </div>
              ) : (
                <div className="text-right text-[10px] text-green-400 font-semibold uppercase">Resolved ✓</div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
