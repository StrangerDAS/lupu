import { useState } from 'react'
import { FiPhone, FiTrash2, FiPlus, FiShield } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { safetyAPI } from '../api/endpoints'

export default function EmergencyContacts() {
  const { user, updateUser } = useAuthStore()
  const [contacts, setContacts] = useState(user?.emergencyContacts || [])
  const [loading, setLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' })

  const handleSave = async (updatedContacts) => {
    setLoading(true)
    try {
      await safetyAPI.updateEmergencyContacts({ emergencyContacts: updatedContacts })
      setContacts(updatedContacts)
      updateUser({ emergencyContacts: updatedContacts })
      toast.success('Emergency contacts updated')
    } catch (err) {
      toast.error('Failed to update emergency contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newContact.name || !newContact.phone || !newContact.relation) {
      toast.error('Please fill all fields')
      return
    }
    if (contacts.length >= 3) {
      toast.error('Maximum 3 emergency contacts allowed')
      return
    }
    const updated = [...contacts, newContact]
    await handleSave(updated)
    setNewContact({ name: '', phone: '', relation: '' })
    setIsAdding(false)
  }

  const handleRemove = async (index) => {
    if (!confirm('Remove this emergency contact?')) return
    const updated = contacts.filter((_, i) => i !== index)
    await handleSave(updated)
  }

  return (
    <div className="mt-12">
      <h2 className="font-semibold mb-5 flex items-center gap-2">
        <FiShield className="text-red-400" /> Emergency Contacts
      </h2>
      <div className="card p-6">
        <p className="text-xs text-white/50 mb-4">
          Add up to 3 trusted contacts. We'll notify them in case you trigger an SOS during a ride.
        </p>

        <div className="space-y-3 mb-4">
          <AnimatePresence>
            {contacts.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-white/5"
              >
                <div>
                  <div className="text-sm font-medium">{c.name} <span className="text-white/40 text-xs ml-2">({c.relation})</span></div>
                  <div className="text-xs text-white/60 mt-0.5">{c.phone}</div>
                </div>
                <button
                  onClick={() => handleRemove(i)}
                  disabled={loading}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                >
                  <FiTrash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {contacts.length === 0 && !isAdding && (
            <div className="text-sm text-white/40 text-center py-4 bg-surface-2 rounded-xl border border-white/5 border-dashed">
              No emergency contacts added yet.
            </div>
          )}
        </div>

        {isAdding ? (
          <form onSubmit={handleAdd} className="bg-surface-2 p-4 rounded-xl border border-white/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-1 block">Name</label>
                <input
                  autoFocus
                  type="text"
                  className="input text-sm py-2"
                  value={newContact.name}
                  onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  className="input text-sm py-2"
                  value={newContact.phone}
                  onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-1 block">Relationship</label>
                <input
                  type="text"
                  className="input text-sm py-2"
                  value={newContact.relation}
                  onChange={e => setNewContact({ ...newContact, relation: e.target.value })}
                  placeholder="Spouse, Parent, Friend"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button type="button" onClick={() => setIsAdding(false)} className="btn-ghost text-sm py-1.5">Cancel</button>
              <button type="submit" disabled={loading} className="btn-primary text-sm py-1.5 px-4 rounded-lg">Save Contact</button>
            </div>
          </form>
        ) : (
          contacts.length < 3 && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-3 flex items-center justify-center gap-2 text-sm text-brand bg-brand/10 hover:bg-brand/20 rounded-xl transition font-medium"
            >
              <FiPlus /> Add Contact
            </button>
          )
        )}
      </div>
    </div>
  )
}
