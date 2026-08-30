import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiBell, FiCheck, FiCheckSquare } from 'react-icons/fi'
import { notificationAPI } from '../../api/endpoints'
import toast from 'react-hot-toast'

export default function NotificationsView() {
  const [notifs, setNotifs] = useState([])

  const fetchNotifs = async () => {
    try {
      const { data } = await notificationAPI.getAll()
      setNotifs(data.notifications || [])
    } catch (err) {
      console.error('Failed to load admin notifications:', err)
    }
  }

  useEffect(() => {
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 5000)
    return () => clearInterval(interval)
  }, [])

  const markRead = async (id) => {
    try {
      await notificationAPI.markRead(id)
      setNotifs(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
      toast.success('Marked as read.')
    } catch (err) {
      console.error(err)
    }
  }

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead()
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('All marked as read.')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Operational Alerts</h2>
          <p className="text-white/40 text-xs">Real-time alerts for vehicle submissions, disputes, ticket creations, and payment states.</p>
        </div>
        {notifs.filter(n => !n.read).length > 0 && (
          <button
            onClick={markAllRead}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-xs font-semibold text-white/80"
          >
            Mark All Read
          </button>
        )}
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
        {notifs.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-xs">
            No active notification notices.
          </div>
        ) : (
          notifs.map(n => (
            <div key={n._id} className={`p-4 flex justify-between items-center text-xs transition ${n.read ? 'opacity-40' : 'bg-brand/5'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  n.read ? 'bg-white/5 text-white/40' : 'bg-brand/10 text-brand border border-brand/20'
                }`}>
                  <FiBell size={14} />
                </div>
                <div>
                  <div className="font-semibold text-white/95">{n.title}</div>
                  <p className="text-white/60 mt-0.5">{n.message}</p>
                  <span className="text-[9px] text-white/30 block mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN') : 'Just now'}
                  </span>
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => markRead(n._id)}
                  className="p-1.5 bg-white/5 hover:bg-brand/20 text-white/60 hover:text-white rounded-lg transition"
                  title="Mark as read"
                >
                  <FiCheck size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
