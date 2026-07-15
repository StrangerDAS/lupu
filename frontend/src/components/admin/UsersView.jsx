import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiAlertTriangle, FiCheckCircle, FiFileText, FiXCircle } from 'react-icons/fi'
import { suspendUser, restoreUser } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import { ADMIN_ROLES } from '../../lib/roleUtils'
import toast from 'react-hot-toast'
import { userAPI, adminAPI } from '../../api/endpoints'
import axiosInstance from '../../api/axiosInstance'

export default function UsersView() {
  const { user: currentAdmin } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  
  // Modals: 'suspend' | 'restore' | 'kyc-review'
  const [modalType, setModalType] = useState(null)
  const [notes, setNotes] = useState('') // For suspension or KYC rejection

  const fetchUsers = async () => {
    try {
      const { data } = await userAPI.getAll()
      setUsers(data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u._id?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAction = async () => {
    if (!selectedUser) return
    try {
      if (modalType === 'suspend') {
        if (!notes) {
          toast.error('Suspension notes are required')
          return
        }
        await suspendUser(selectedUser._id, currentAdmin._id, currentAdmin.name, notes)
        toast.success(`User ${selectedUser.name} suspended.`)
      } else if (modalType === 'restore') {
        await restoreUser(selectedUser._id, currentAdmin._id, currentAdmin.name)
        toast.success(`User ${selectedUser.name} account restored.`)
      }
      setSelectedUser(null)
      setNotes('')
      fetchUsers()
    } catch (err) {
      toast.error('Operation failed: ' + err.message)
    }
  }

  const handleKycAction = async (status) => {
    if (!selectedUser) return
    if (status === 'rejected' && !notes) {
      toast.error('Rejection reason is required')
      return
    }
    
    try {
      await axiosInstance.patch(`/admin/users/${selectedUser._id}/kyc`, {
        status: status,
        reason: status === 'rejected' ? notes : ''
      })
      toast.success(`KYC status updated to ${status}`)
      setSelectedUser(null)
      setNotes('')
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update KYC')
    }
  }

  if (loading) return <div className="p-8 text-center text-white/50">Loading users...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">User Base Control</h2>
          <p className="text-white/40 text-xs">Review registration states, KYC, and configure access profiles.</p>
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
                <th className="p-4">KYC Status</th>
                <th className="p-4">Account Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u) => {
                const isSuspended = u.status === 'suspended'
                return (
                  <tr key={u._id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            (u.name?.[0] || u.email?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white/95">{u.name || 'Unnamed User'}</div>
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        u.kycStatus === 'verified' ? 'bg-green-500/20 text-green-400' :
                        u.kycStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        u.kycStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {u.kycStatus === 'verified' && <FiCheckCircle size={10} />}
                        {u.kycStatus === 'pending' && <FiAlertTriangle size={10} />}
                        {u.kycStatus || 'unsubmitted'}
                      </span>
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
                    <td className="p-4 text-right space-x-2">
                      {u.kycStatus === 'pending' && (
                        <button
                          onClick={() => { setSelectedUser(u); setModalType('kyc-review'); setNotes(''); }}
                          className="px-2.5 py-1.5 bg-brand/20 hover:bg-brand text-white rounded-lg transition text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <FiFileText size={10} /> Review KYC
                        </button>
                      )}
                      
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
      {selectedUser && modalType !== 'kyc-review' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass max-w-sm w-full rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-yellow-400">
              <FiAlertTriangle className="text-xl shrink-0" />
              <h3 className="font-bold text-sm">
                Confirm User {modalType === 'suspend' ? 'Suspension' : 'Restoration'}
              </h3>
            </div>
            <p className="text-xs text-white/60">
              Are you sure you want to change the status of <strong>{selectedUser.name}</strong> ({selectedUser.email})?
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
      
      {/* KYC Review Modal */}
      {selectedUser && modalType === 'kyc-review' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass max-w-2xl w-full rounded-2xl p-6 border border-white/10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h3 className="font-bold text-lg">Review KYC Documents - {selectedUser.name}</h3>
              <button onClick={() => { setSelectedUser(null); setNotes(''); }} className="text-white/50 hover:text-white">
                <FiXCircle size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2">Government ID</p>
                {selectedUser.governmentIdUrl ? (
                  <a href={selectedUser.governmentIdUrl} target="_blank" rel="noreferrer" className="block w-full h-48 bg-white/5 rounded-xl overflow-hidden hover:opacity-90 transition border border-white/10 relative group">
                    {selectedUser.governmentIdUrl.includes('.pdf') ? (
                      <div className="w-full h-full flex items-center justify-center text-white/50"><FiFileText size={48} /> <span className="absolute bottom-4">View PDF</span></div>
                    ) : (
                      <img src={selectedUser.governmentIdUrl} className="w-full h-full object-cover" alt="Gov ID" />
                    )}
                  </a>
                ) : <div className="h-48 bg-white/5 rounded-xl flex items-center justify-center text-white/30 text-xs border border-white/10">Not uploaded</div>}
              </div>
              
              <div>
                <p className="text-xs font-semibold text-white/50 mb-2">College ID</p>
                {selectedUser.collegeIdUrl ? (
                  <a href={selectedUser.collegeIdUrl} target="_blank" rel="noreferrer" className="block w-full h-48 bg-white/5 rounded-xl overflow-hidden hover:opacity-90 transition border border-white/10 relative group">
                    {selectedUser.collegeIdUrl.includes('.pdf') ? (
                      <div className="w-full h-full flex items-center justify-center text-white/50"><FiFileText size={48} /> <span className="absolute bottom-4">View PDF</span></div>
                    ) : (
                      <img src={selectedUser.collegeIdUrl} className="w-full h-full object-cover" alt="College ID" />
                    )}
                  </a>
                ) : <div className="h-48 bg-white/5 rounded-xl flex items-center justify-center text-white/30 text-xs border border-white/10">Not uploaded</div>}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-white/10 pt-4 mt-4">
              <label className="text-[10px] font-semibold text-white/50">Rejection Reason (Required if rejecting)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Image is blurry, name does not match..."
                className="input-field text-xs h-20 resize-none p-2.5"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleKycAction('rejected')}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition text-xs font-bold"
              >
                Reject KYC
              </button>
              <button
                onClick={() => handleKycAction('verified')}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition text-xs font-bold"
              >
                Approve KYC
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
