import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'
import { suspendUser, restoreUser } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import { ADMIN_ROLES } from '../../lib/roleUtils'
import toast from 'react-hot-toast'

export default function UsersView({ users = [] }) {
  const { user: currentAdmin } = useAuthStore()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [modalType, setModalType] = useState(null) // 'suspend' | 'restore'
  const [notes, setNotes] = useState('')

  const filteredUsers = users.filter(u =>
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.uid?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAction = async () => {
    if (!selectedUser) return
    try {
      if (modalType === 'suspend') {
        if (!notes) {
          toast.error('Suspension notes are required')
          return
        }
        await suspendUser(selectedUser._id || selectedUser.uid, currentAdmin._id, currentAdmin.name, notes)
        toast.success(`User ${selectedUser.displayName || selectedUser.name} suspended.`)
      } else {
        await restoreUser(selectedUser._id || selectedUser.uid, currentAdmin._id, currentAdmin.name)
        toast.success(`User ${selectedUser.displayName || selectedUser.name} account restored.`)
      }
      setSelectedUser(null)
      setNotes('')
    } catch (err) {
      toast.error('Operation failed: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">User Base Control</h2>
          <p className="text-white/40 text-xs">Review registration states, roles, and configure access profiles.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search name, email, user ID..."
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
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Verification</th>
                <th className="p-4">Account Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => {
                const isSuspended = u.status === 'suspended'
                return (
                  <tr key={u._id || u.uid} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (u.displayName?.[0] || u.email?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white/95">{u.displayName || u.name || 'Unnamed User'}</div>
                          <div className="text-[10px] text-white/40">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 capitalize">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ADMIN_ROLES.includes(u.role)
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${u.emailVerified ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                          Email
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${u.phoneVerified ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'}`}>
                          Phone
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isSuspended
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`} />
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {isSuspended ? (
                        <button
                          onClick={() => { setSelectedUser(u); setModalType('restore') }}
                          className="px-2.5 py-1.5 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white rounded-lg transition text-[10px] font-bold"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => { setSelectedUser(u); setModalType('suspend') }}
                          className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition text-[10px] font-bold"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass max-w-sm w-full rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-yellow-400">
              <FiAlertTriangle className="text-xl shrink-0" />
              <h3 className="font-bold text-sm">
                Confirm User {modalType === 'suspend' ? 'Suspension' : 'Restoration'}
              </h3>
            </div>
            <p className="text-xs text-white/60">
              Are you sure you want to change the status of <strong>{selectedUser.displayName || selectedUser.name}</strong> ({selectedUser.email})?
            </p>

            {modalType === 'suspend' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-white/50">Reason for Suspension</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g., Policy violation, fraudulent activity..."
                  className="input-field text-xs h-20 resize-none p-2.5"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setSelectedUser(null); setNotes('') }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-xs font-semibold text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`px-4 py-2 rounded-xl transition text-xs font-semibold text-white ${
                  modalType === 'suspend' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
