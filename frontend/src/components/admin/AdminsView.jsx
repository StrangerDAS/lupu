import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiUserPlus, FiTrash2, FiShield } from 'react-icons/fi'
import { addAdminAccount, deleteAdminAccount, subscribeToAdmins } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import { isSuperAdmin } from '../../lib/roleUtils'
import toast from 'react-hot-toast'

export default function AdminsView() {
  const { user } = useAuthStore()
  const [adminsList, setAdminsList] = useState([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('admin') // 'admin' | 'super_admin' | 'founder'

  useEffect(() => {
    const unsub = subscribeToAdmins((list) => {
      setAdminsList(list)
    })
    return () => unsub()
  }, [])

  const handleAddAdmin = async (e) => {
    e.preventDefault()
    if (!name || !email) {
      toast.error('Name and email are required')
      return
    }
    try {
      await addAdminAccount(email, name, role, user._id, user.name)
      toast.success('Admin added successfully!')
      setName('')
      setEmail('')
      setRole('admin')
    } catch (err) {
      toast.error('Failed to create account mapping: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove administrative access for this user?')) return
    try {
      await deleteAdminAccount(id, user._id, user.name)
      toast.success('Admin access revoked.')
    } catch (err) {
      toast.error('Failed to revoke access: ' + err.message)
    }
  }

  const isAccessAllowed = isSuperAdmin(user)

  if (!isAccessAllowed) {
    return (
      <div className="text-center py-12 text-white/40 text-xs">
        <FiShield size={24} className="mx-auto text-red-400 mb-2" />
        <span>Permission denied. Only Founders and Super Admins can manage administrative credentials.</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Administrative Team Roster</h2>
        <p className="text-white/40 text-xs">Create, configure, and manage credentials for admins, super-admins, and founders.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration Form */}
        <div className="lg:col-span-1 glass p-5 border border-white/5 rounded-2xl h-fit space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-1.5"><FiUserPlus /> Add Team Member</h3>

          <form onSubmit={handleAddAdmin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-white/50 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="input-field py-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-white/50 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@lupu.in"
                className="input-field py-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-white/50 block">Access Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input-field py-2 text-xs bg-surface-2 text-white"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="founder">Founder</option>
              </select>
            </div>

            <button type="submit" className="btn-primary w-full py-2 rounded-xl text-xs font-semibold">
              Provision Admin Mapping
            </button>
          </form>
        </div>

        {/* Admin List */}
        <div className="lg:col-span-2 glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-white/50 font-medium">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {adminsList?.map(a => (
                  <tr key={a?._id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-white/90">{a?.name}</td>
                    <td className="p-4 text-white/60">{a?.email}</td>
                    <td className="p-4 capitalize">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a?.role === 'founder' ? 'bg-brand/20 text-brand border border-brand/30' :
                        a?.role === 'super_admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        {a?.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {a?.email !== user?.email && (
                        <button
                          onClick={() => handleDelete(a?._id)}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition"
                          title="Revoke Admin Access"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
