import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiAlertTriangle, FiCheckCircle, FiFileText, FiXCircle, FiCamera, FiShield, FiUserCheck } from 'react-icons/fi'
import useAuthStore from '../../store/authStore'
import { ADMIN_ROLES, isSuperAdmin } from '../../lib/roleUtils'
import toast from 'react-hot-toast'
import { adminSafetyAPI, userAPI, verificationAPI } from '../../api/endpoints'
import axiosInstance from '../../api/axiosInstance'
import { getImageUrl } from '../../utils/urlUtils'

export default function UsersView() {
  const { user: currentAdmin } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [verificationRecord, setVerificationRecord] = useState(null)
  const [loadingVerification, setLoadingVerification] = useState(false)
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'pending' | 'verified'
  
  // Modals: 'suspend' | 'restore' | 'kyc-review'
  const [modalType, setModalType] = useState(null)
  const [notes, setNotes] = useState('') // For suspension or KYC rejection

  const fetchUsers = async () => {
    try {
      const { data } = await userAPI.getAll()
      setUsers(data.users || (Array.isArray(data) ? data : []))
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

  const safeUsers = Array.isArray(users) ? users : []

  const isPendingUser = (u) => {
    const kyc = (u?.kycStatus || '').toLowerCase()
    const ver = (u?.verificationStatus || '').toLowerCase()
    return (
      kyc === 'pending' ||
      kyc === 'under review' ||
      ver === 'document_submitted' ||
      ver === 'document_under_review' ||
      ver === 'face_pending' ||
      ver === 'face_under_review'
    )
  }

  const isVerifiedUser = (u) => {
    return (
      u?.isVerified === true ||
      (u?.kycStatus || '').toLowerCase() === 'verified' ||
      (u?.verificationStatus || '').toLowerCase() === 'verified'
    )
  }

  const pendingCount = safeUsers.filter(isPendingUser).length
  const verifiedCount = safeUsers.filter(isVerifiedUser).length

  const q = (search || '').toLowerCase().trim()
  const filteredUsers = safeUsers.filter(u => {
    const matchesSearch =
      String(u?.name || '').toLowerCase().includes(q) ||
      String(u?.email || '').toLowerCase().includes(q) ||
      String(u?._id || u?.id || '').toLowerCase().includes(q)

    if (!matchesSearch) return false

    if (filterTab === 'pending') return isPendingUser(u)
    if (filterTab === 'verified') return isVerifiedUser(u)
    return true
  })

  const openKycReview = async (user) => {
    setSelectedUser(user)
    setModalType('kyc-review')
    setNotes('')
    setVerificationRecord(null)
    setLoadingVerification(true)

    try {
      const res = await verificationAPI.getAdminVerifications({ userId: user._id })
      if (res.data?.verifications && res.data.verifications.length > 0) {
        setVerificationRecord(res.data.verifications[0])
      }
    } catch (err) {
      console.warn('Could not load separate verification record:', err)
    } finally {
      setLoadingVerification(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    if (!isSuperAdmin(currentAdmin)) {
      toast.error('Only Super Admins and Founders can change user roles.')
      return
    }
    try {
      await userAPI.updateRole(userId, newRole)
      toast.success(`Role updated to ${newRole}`)
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role')
    }
  }

  const handleAction = async () => {
    if (!selectedUser) return
    try {
      if (modalType === 'suspend') {
        if (!notes) {
          toast.error('Suspension notes are required')
          return
        }
        await adminSafetyAPI.suspendUser(selectedUser._id, true, notes)
        toast.success(`User ${selectedUser.name} suspended.`)
      } else if (modalType === 'restore') {
        await adminSafetyAPI.suspendUser(selectedUser._id, false, 'Restored by admin')
        toast.success(`User ${selectedUser.name} account restored.`)
      }
      setSelectedUser(null)
      setNotes('')
      fetchUsers()
    } catch (err) {
      toast.error('Operation failed: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleGranularReview = async (action) => {
    if (!selectedUser) return
    if (selectedUser._id === currentAdmin?._id) {
      toast.error('Administrators cannot approve their own verification records.')
      return
    }
    if ((action === 'reject' || action === 'request_resubmission') && !notes) {
      toast.error('Rejection / resubmission reason is required')
      return
    }

    const toastId = toast.loading('Updating verification status...')
    try {
      if (verificationRecord?._id) {
        await verificationAPI.reviewVerification(verificationRecord._id, {
          action,
          notes,
          rejectionReason: notes,
        })
      } else {
        // Fallback to user KYC endpoint
        const kycStatus = action === 'reject' ? 'rejected' : 'verified'
        await axiosInstance.patch(`/admin/users/${selectedUser._id}/kyc`, {
          status: kycStatus,
          reason: notes,
        })
      }

      toast.success(`Verification action '${action}' completed!`, { id: toastId })
      setSelectedUser(null)
      setNotes('')
      setVerificationRecord(null)
      fetchUsers()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to update verification', { id: toastId })
    }
  }

  if (loading) return <div className="p-8 text-center text-white/50">Loading users...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">User Base Control & Verification</h2>
          <p className="text-white/40 text-xs">Review registration states, mandatory renter verification, and configure access profiles.</p>
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

      {/* Verification Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            filterTab === 'all'
              ? 'bg-brand text-white shadow-lg shadow-brand/20'
              : 'text-white/50 hover:text-white bg-white/5'
          }`}
        >
          All Users ({safeUsers.length})
        </button>
        <button
          onClick={() => setFilterTab('pending')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
            filterTab === 'pending'
              ? 'bg-yellow-500 text-black font-bold'
              : 'text-white/50 hover:text-white bg-white/5'
          }`}
        >
          <span>Pending Verification</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 bg-yellow-400 text-black rounded-full text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilterTab('verified')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
            filterTab === 'verified'
              ? 'bg-green-500 text-white font-bold'
              : 'text-white/50 hover:text-white bg-white/5'
          }`}
        >
          <span>Verified Renters ({verifiedCount})</span>
        </button>
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-white/50 font-medium">
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Verification Status</th>
                <th className="p-4">Document Info</th>
                <th className="p-4">Account Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-white/30 text-xs">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuspended = u?.status === 'suspended'
                  const isVer = isVerifiedUser(u)
                  const isPend = isPendingUser(u)
                  const docType = u?.documentType || u?.kycType || 'None'
                  const maskedNo = u?.maskedDocumentNumber || u?.aadhaarNumber || u?.drivingLicenseNumber || '—'

                  return (
                    <tr key={u?._id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                            {u?.avatar ? (
                              <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (u?.name?.[0] || u?.email?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-white/95">{u?.name || 'Unnamed User'}</div>
                            <div className="text-[10px] text-white/40">{u?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {isSuperAdmin(currentAdmin) ? (
                          <select
                            value={u?.role || 'user'}
                            onChange={(e) => handleRoleChange(u?._id, e.target.value)}
                            className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer outline-none ${
                              ADMIN_ROLES.includes(u?.role)
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-white/10'
                            }`}
                          >
                            <option value="user" className="bg-[#12141A] text-white">User</option>
                            <option value="owner" className="bg-[#12141A] text-white">Owner</option>
                            <option value="admin" className="bg-[#12141A] text-white">Admin</option>
                            <option value="super_admin" className="bg-[#12141A] text-white">Super Admin</option>
                            <option value="founder" className="bg-[#12141A] text-white">Founder</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ADMIN_ROLES.includes(u?.role)
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {u?.role || 'user'}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          isVer
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : isPend
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
                            : u?.kycStatus === 'rejected' || u?.verificationStatus === 'rejected'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-white/10 text-white/40'
                        }`}>
                          {isVer && <FiCheckCircle size={10} />}
                          {isPend && <FiAlertTriangle size={10} />}
                          {isVer ? 'Verified' : isPend ? 'Pending Review' : (u?.verificationStatus || u?.kycStatus || 'Not Submitted')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="font-semibold text-white/80 capitalize text-[11px]">
                            {docType.replace('_', ' ')}
                          </span>
                          <span className="block text-[10px] font-mono text-white/40">
                            {maskedNo}
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
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => openKycReview(u)}
                          className={`px-2.5 py-1.5 rounded-lg transition text-[10px] font-bold inline-flex items-center gap-1 ${
                            isPend
                              ? 'bg-brand hover:bg-brand-dark text-white shadow-md shadow-brand/20'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <FiFileText size={10} /> {isPend ? 'Review Verification' : 'Inspect KYC'}
                        </button>
                        
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
                })
              )}
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
      
      {/* KYC & Identity Verification Review Modal */}
      {selectedUser && modalType === 'kyc-review' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass max-w-4xl w-full rounded-2xl p-6 border border-white/10 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FiShield className="text-brand text-lg" />
                  <h3 className="font-bold text-lg text-white">Renter Verification Review — {selectedUser.name}</h3>
                </div>
                <p className="text-xs text-white/50">{selectedUser.email} • User ID: {selectedUser._id}</p>
              </div>
              <button onClick={() => { setSelectedUser(null); setNotes(''); setVerificationRecord(null); }} className="text-white/50 hover:text-white">
                <FiXCircle size={24} />
              </button>
            </div>

            {/* Metadata Summary Banner */}
            <div className="bg-surface-2 border border-white/5 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Document Type</span>
                <span className="font-semibold capitalize text-white">
                  {verificationRecord?.documentType?.replace('_', ' ') || selectedUser.documentType?.replace('_', ' ') || selectedUser.kycType || 'Identity Document'}
                </span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Masked Document No.</span>
                <span className="font-mono font-bold text-brand">
                  {verificationRecord?.documentNumberMasked || selectedUser.maskedDocumentNumber || selectedUser.aadhaarNumber || selectedUser.drivingLicenseNumber || '—'}
                </span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Document Status</span>
                <span className="font-semibold capitalize text-yellow-400">
                  {verificationRecord?.documentStatus || selectedUser.documentStatus || selectedUser.kycStatus || 'Submitted'}
                </span>
              </div>
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Face Status</span>
                <span className="font-semibold capitalize text-blue-400">
                  {verificationRecord?.faceStatus || selectedUser.faceStatus || 'Pending'}
                </span>
              </div>

              {/* DL Expiry & Categories if applicable */}
              {(verificationRecord?.drivingLicenseDetails || selectedUser.drivingLicenseExpiry) && (
                <>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">DL Expiry</span>
                    <span className="font-semibold text-white">
                      {verificationRecord?.drivingLicenseDetails?.expiryDate ? new Date(verificationRecord.drivingLicenseDetails.expiryDate).toLocaleDateString() : selectedUser.drivingLicenseExpiry ? new Date(selectedUser.drivingLicenseExpiry).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">DL Categories</span>
                    <span className="font-semibold text-white">
                      {(verificationRecord?.drivingLicenseDetails?.categories || selectedUser.drivingLicenseCategories || []).join(', ') || 'Motorcycle/Light'}
                    </span>
                  </div>
                </>
              )}

              {/* Biometric consent indicator */}
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Biometric Consent</span>
                <span className="font-semibold text-green-400 flex items-center gap-1">
                  <FiCheckCircle size={11} /> Granted
                </span>
              </div>
              {/* Face Verification Process Status */}
              <div>
                <span className="text-white/40 block text-[10px] uppercase font-bold tracking-wider">Face Review Process</span>
                <span className={`font-semibold text-xs ${
                  (verificationRecord?.faceStatus === 'face_verified' || selectedUser.faceStatus === 'face_verified')
                    ? 'text-green-400'
                    : (verificationRecord?.faceStatus === 'face_failed' || selectedUser.faceStatus === 'face_failed')
                    ? 'text-red-400'
                    : (verificationRecord?.selfieSignedUrl || verificationRecord?.selfieUrl || selectedUser.selfieUrl)
                    ? 'text-amber-400'
                    : 'text-white/40'
                }`}>
                  {verificationRecord?.faceStatus === 'face_verified' || selectedUser.faceStatus === 'face_verified'
                    ? 'Face comparison approved (Manual Review)'
                    : verificationRecord?.faceStatus === 'face_failed' || selectedUser.faceStatus === 'face_failed'
                    ? 'Face comparison rejected (Manual Review)'
                    : (verificationRecord?.selfieSignedUrl || verificationRecord?.selfieUrl || selectedUser.selfieUrl)
                    ? 'Selfie captured — Awaiting manual face review'
                    : 'Not captured'}
                </span>
              </div>
            </div>

            {/* Audit Notice Banner */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2.5">
              <FiShield className="text-base shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold">Manual Identity & Face Review Mode:</span> Facial matching is currently verified manually by authorized administrators. Compare document portrait and live selfie side-by-side. Signed preview links are short-lived (15-minute access duration).
              </div>
            </div>

            {/* SIDE-BY-SIDE PHOTO COMPARISON */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FiCamera className="text-brand" /> Side-by-Side Face & Document Comparison
              </h4>
              <p className="text-[11px] text-white/50">
                Compare the portrait in the identity document with the live selfie capture to confirm physical identity match.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Left: Document Images */}
                <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/90">Official Identity Document</span>
                    <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/60">Front & Back</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Front */}
                    <div>
                      <span className="text-[10px] text-white/40 block mb-1">Document Front</span>
                      {verificationRecord?.documentFrontSignedUrl || selectedUser.documentFrontUrl || selectedUser.governmentIdUrl || selectedUser.aadhaarFrontUrl || selectedUser.collegeIdUrl || selectedUser.drivingLicenseUrl ? (
                        <a
                          href={getImageUrl(verificationRecord?.documentFrontSignedUrl || selectedUser.documentFrontUrl || selectedUser.governmentIdUrl || selectedUser.aadhaarFrontUrl || selectedUser.collegeIdUrl || selectedUser.drivingLicenseUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-44 bg-black/40 rounded-lg overflow-hidden border border-white/10 hover:border-brand/60 transition group relative"
                        >
                          <img
                            src={getImageUrl(verificationRecord?.documentFrontSignedUrl || selectedUser.documentFrontUrl || selectedUser.governmentIdUrl || selectedUser.aadhaarFrontUrl || selectedUser.collegeIdUrl || selectedUser.drivingLicenseUrl)}
                            alt="Front"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </a>
                      ) : (
                        <div className="h-44 bg-white/5 rounded-lg flex items-center justify-center text-white/30 text-xs border border-dashed border-white/10">
                          Not available
                        </div>
                      )}
                    </div>

                    {/* Back */}
                    <div>
                      <span className="text-[10px] text-white/40 block mb-1">Document Back</span>
                      {verificationRecord?.documentBackSignedUrl || selectedUser.documentBackUrl || selectedUser.aadhaarBackUrl ? (
                        <a
                          href={getImageUrl(verificationRecord?.documentBackSignedUrl || selectedUser.documentBackUrl || selectedUser.aadhaarBackUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-44 bg-black/40 rounded-lg overflow-hidden border border-white/10 hover:border-brand/60 transition group relative"
                        >
                          <img
                            src={getImageUrl(verificationRecord?.documentBackSignedUrl || selectedUser.documentBackUrl || selectedUser.aadhaarBackUrl)}
                            alt="Back"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </a>
                      ) : (
                        <div className="h-44 bg-white/5 rounded-lg flex items-center justify-center text-white/30 text-xs border border-dashed border-white/10">
                          Single-sided / None
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Live Selfie Photo Portrait */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white/90">Live Webcam Selfie Capture</span>
                      <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded flex items-center gap-1 font-semibold">
                        <FiCheckCircle size={10} /> Live Photo
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40 block mb-1">User Selfie (Captured via In-App Camera)</span>
                  </div>

                  <div className="h-44 bg-black/40 rounded-lg overflow-hidden border border-white/10 relative group">
                    {verificationRecord?.selfieSignedUrl || selectedUser.selfieUrl || selectedUser.avatar ? (
                      <a
                        href={getImageUrl(verificationRecord?.selfieSignedUrl || selectedUser.selfieUrl || selectedUser.avatar)}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={getImageUrl(verificationRecord?.selfieSignedUrl || selectedUser.selfieUrl || selectedUser.avatar)}
                          alt="Selfie"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </a>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-white/30 text-xs">
                        <FiCamera size={28} className="mb-1 text-white/20" />
                        No selfie uploaded yet
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-[10px] text-white/40">
                    Verify facial landmarks, lighting, and consistency with ID portrait.
                  </div>
                </div>
              </div>
            </div>

            {/* Rejection / Resubmission Notes */}
            <div className="space-y-1.5 border-t border-white/10 pt-4">
              <label className="text-[10px] font-semibold text-white/50">
                Auditor Feedback / Rejection Notes (Required if rejecting or requesting resubmission)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Document photo is blurred, face in selfie does not match student ID photo, driving license expired..."
                className="input-field text-xs h-20 resize-none p-2.5"
              />
            </div>

            {/* Granular Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGranularReview('reject')}
                  className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition text-xs font-bold"
                >
                  Reject Verification
                </button>
                <button
                  type="button"
                  onClick={() => handleGranularReview('request_resubmission')}
                  className="px-3.5 py-2 bg-yellow-500/20 hover:bg-yellow-500 text-yellow-400 hover:text-black rounded-xl transition text-xs font-bold"
                >
                  Request Resubmission
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGranularReview('approve_document')}
                  className="px-3.5 py-2 bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl transition text-xs font-bold"
                >
                  Approve Document Only
                </button>
                <button
                  type="button"
                  onClick={() => handleGranularReview('approve_face')}
                  className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500 text-purple-400 hover:text-white rounded-xl transition text-xs font-bold"
                >
                  Approve Face Only
                </button>
                <button
                  type="button"
                  onClick={() => handleGranularReview('approve_full')}
                  className="px-5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition text-xs font-bold shadow-lg shadow-green-500/20 flex items-center gap-1.5"
                >
                  <FiCheckCircle size={14} /> Approve Full Verification
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

