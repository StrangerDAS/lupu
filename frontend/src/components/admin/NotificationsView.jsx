import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiBell, FiCheck, FiCheckSquare } from 'react-icons/fi'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import toast from 'react-hot-toast'

export default function NotificationsView() {
  const [notifs, setNotifs] = useState([])

  useEffect(() => {
    // Admin notices collection subscription (where read == false)
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', 'admin_group'), // We can use global topic or target specifically
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map(d => ({ _id: d.id, ...d.data() })))
    }, (err) => {
      // Fallback
      console.error(err)
    })
    return () => unsubscribe()
  }, [])

  const markRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true })
      toast.success('Marked as read.')
    } catch (err) {
      console.error(err)
    }
  }

  const markAllRead = async () => {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', 'admin_group'), where('read', '==', false))
      const snap = await getDocs(q)
      const promises = snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }))
      await Promise.all(promises)
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
                    {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
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
