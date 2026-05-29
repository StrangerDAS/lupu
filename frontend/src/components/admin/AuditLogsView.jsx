import { useState } from 'react'
import { FiSearch, FiCpu } from 'react-icons/fi'

export default function AuditLogsView({ adminActions = [] }) {
  const [search, setSearch] = useState('')

  const filteredLogs = adminActions.filter(log =>
    (log.adminName || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.actionType || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.notes || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Administrative Audit Logs</h2>
          <p className="text-white/40 text-xs">A comprehensive, immutable ledger of all modifications, suspensions, and configurations.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search action, admin name, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-9"
          />
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-white/50 font-medium">
                <th className="p-4">Admin Name</th>
                <th className="p-4">Action Event</th>
                <th className="p-4">Affected Entity</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-white/30 text-xs">No audit logs found.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-white/90">{log.adminName}</td>
                    <td className="p-4 font-mono font-bold text-brand">{log.actionType}</td>
                    <td className="p-4">
                      {log.affectedRecord ? (
                        <div>
                          <div className="font-semibold text-white/80">{log.affectedRecord.name}</div>
                          <div className="text-[10px] text-white/40">{log.affectedRecord.collection} : {log.affectedRecord.docId}</div>
                        </div>
                      ) : (
                        <span className="text-white/30">-</span>
                      )}
                    </td>
                    <td className="p-4 text-white/70 max-w-xs truncate">{log.notes || '-'}</td>
                    <td className="p-4 text-right text-white/40">
                      {log.timestamp?.seconds
                        ? new Date(log.timestamp.seconds * 1000).toLocaleString()
                        : 'Just now'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
