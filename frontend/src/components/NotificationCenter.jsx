import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheckSquare, FiTrash2, FiBell, FiDollarSign, FiAlertCircle, FiMessageSquare } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications
} from '../firebase/firestoreService'

export default function NotificationCenter({ isOpen, onClose, notifications, userId }) {
  const unreadCount = notifications.filter(n => !n.isRead && !n.read).length

  const handleMarkAllRead = async () => {
    if (userId) await markAllNotificationsRead(userId)
  }

  const handleDeleteAll = async () => {
    if (!userId) return
    if (confirm('Are you sure you want to delete all notifications?')) {
      await deleteAllNotifications(userId)
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'payment': return <FiDollarSign className="text-green-400" />
      case 'vehicle': return <FiMessageSquare className="text-blue-400" />
      case 'admin': return <FiAlertCircle className="text-amber-400" />
      case 'booking':
      default:
        return <FiBell className="text-brand" />
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
          />

          {/* Slide-over Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md glass border-l border-white/10 z-[100] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Notification Center
                  {unreadCount > 0 && (
                    <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </h2>
              </div>
              <button onClick={onClose} className="btn-ghost p-2 rounded-full">
                <FiX size={20} />
              </button>
            </div>

            {/* Actions Toolbar */}
            {notifications.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border-b border-white/5">
                <button
                  onClick={handleMarkAllRead}
                  disabled={unreadCount === 0}
                  className={`text-xs flex items-center gap-1.5 transition ${unreadCount > 0 ? 'text-brand hover:underline' : 'text-white/30 cursor-not-allowed'}`}
                >
                  <FiCheckSquare size={14} /> Mark all read
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="text-xs flex items-center gap-1.5 text-red-400 hover:text-red-300 transition"
                >
                  <FiTrash2 size={14} /> Delete all
                </button>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-50 p-6">
                  <FiBell size={48} className="mb-4" />
                  <p>You're all caught up!</p>
                  <p className="text-xs mt-2">No new notifications.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isRead = n.isRead || n.read
                  return (
                    <motion.div
                      key={n._id || n.notificationId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`relative p-4 rounded-xl transition border group ${
                        isRead ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-brand/10 border-brand/20 hover:border-brand/30'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isRead ? 'bg-surface-3' : 'bg-brand/20'}`}>
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <h4 className={`font-semibold text-sm ${isRead ? 'text-white/80' : 'text-white'}`}>{n.title}</h4>
                          <p className={`text-xs mt-1 leading-relaxed ${isRead ? 'text-white/50' : 'text-white/70'}`}>
                            {n.message}
                          </p>
                          <div className="text-[10px] text-white/30 mt-2">
                            {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('en-IN') : 'Just now'}
                          </div>
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
                        {!isRead && (
                          <button
                            onClick={() => markNotificationRead(n._id || n.notificationId)}
                            className="p-1.5 bg-brand/20 text-brand rounded hover:bg-brand/40 transition"
                            title="Mark as read"
                          >
                            <FiCheckSquare size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(n._id || n.notificationId)}
                          className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition"
                          title="Delete notification"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
