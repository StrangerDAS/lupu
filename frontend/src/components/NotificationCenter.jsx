import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheckSquare, FiTrash2, FiBell, FiDollarSign, FiAlertCircle, FiMessageSquare, FiClock } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { notificationAPI } from '../api/endpoints'
import { requestNotificationPermission, getNotificationPermission, triggerNativePush } from '../services/pushNotificationService'
import toast from 'react-hot-toast'

export default function NotificationCenter({ isOpen, onClose, notifications, userId, onRefresh }) {
  const navigate = useNavigate()
  const unreadCount = notifications.filter(n => !n.isRead && !n.read).length
  const [permStatus, setPermStatus] = useState(getNotificationPermission())

  useEffect(() => {
    setPermStatus(getNotificationPermission())
  }, [])

  // Auto trigger push notifications for new unread notifications
  useEffect(() => {
    if (permStatus === 'granted' && notifications.length > 0) {
      notifications.forEach((n) => {
        if (!n.read && !n.isRead) {
          triggerNativePush({
            id: n._id || n.notificationId,
            title: n.title || 'LUPU Notification',
            body: n.message || 'You have a new update.',
            link: n.link || '/my-bookings',
          })
        }
      })
    }
  }, [notifications, permStatus])

  const handleEnablePush = async () => {
    const res = await requestNotificationPermission()
    setPermStatus(res)
    if (res === 'granted') {
      toast.success('Device push notifications enabled!')
      triggerNativePush({
        id: 'welcome-push',
        title: 'Notifications Enabled 🎉',
        body: 'You will now receive real-time booking and trip alerts on your phone or laptop.',
        link: '/my-bookings',
      })
    } else if (res === 'denied') {
      toast.error('Notification permission was blocked in your browser settings.')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead()
      if (onRefresh) onRefresh()
    } catch {
      toast.error('Failed to mark all as read')
    }
  }

  const handleDeleteAll = async () => {
    if (confirm('Are you sure you want to delete all notifications?')) {
      try {
        await notificationAPI.deleteAll()
        if (onRefresh) onRefresh()
        toast.success('All notifications cleared')
      } catch {
        toast.error('Failed to delete notifications')
      }
    }
  }

  const handleItemClick = async (n) => {
    try {
      if (!n.read && !n.isRead) {
        await notificationAPI.markRead(n._id)
        if (onRefresh) onRefresh()
      }
    } catch (err) {
      console.error('Error marking notification read:', err)
    }

    onClose()

    if (n.link) {
      navigate(n.link)
    } else if (n.type === 'admin') {
      navigate('/admin')
    } else if (n.type === 'vehicle') {
      navigate('/dashboard')
    } else {
      navigate('/my-bookings')
    }
  }

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation()
    try {
      await notificationAPI.delete(id)
      if (onRefresh) onRefresh()
    } catch {
      toast.error('Failed to delete notification')
    }
  }

  const handleMarkReadOne = async (e, id) => {
    e.stopPropagation()
    try {
      await notificationAPI.markRead(id)
      if (onRefresh) onRefresh()
    } catch {
      toast.error('Failed to mark as read')
    }
  }

  const getIcon = (type) => {
    switch (type) {
      case 'payment': return <FiDollarSign className="text-green-400" />
      case 'vehicle': return <FiMessageSquare className="text-blue-400" />
      case 'admin': return <FiAlertCircle className="text-amber-400" />
      case 'reminder': return <FiClock className="text-yellow-400" />
      case 'booking':
      default:
        return <FiBell className="text-brand" />
    }
  }

  const formatDate = (d) => {
    if (!d) return 'Just now'
    try {
      const dateObj = typeof d === 'string' ? new Date(d) : (d.toDate ? d.toDate() : new Date(d))
      return dateObj.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Just now'
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

            {/* Push Notification Permission Banner */}
            {permStatus !== 'granted' && (
              <div className="mx-4 mt-4 p-3.5 bg-brand/10 border border-brand/25 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-white/90">
                  <FiBell className="text-brand shrink-0 text-base" />
                  <div>
                    <p className="font-semibold text-white">Enable Device Push Alerts</p>
                    <p className="text-[10px] text-white/60">Get instant booking & trip alerts on phone/laptop.</p>
                  </div>
                </div>
                <button
                  onClick={handleEnablePush}
                  className="px-3 py-1.5 bg-brand text-white font-semibold text-xs rounded-lg hover:bg-brand/90 transition shrink-0 shadow-md"
                >
                  Enable
                </button>
              </div>
            )}

            {/* Actions Toolbar */}
            {notifications.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border-b border-white/5 mt-2">
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
                  <FiTrash2 size={14} /> Clear all
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
                      onClick={() => handleItemClick(n)}
                      className={`relative p-4 rounded-xl transition border group cursor-pointer ${
                        isRead ? 'bg-white/5 border-white/5 hover:border-white/20' : 'bg-brand/10 border-brand/20 hover:border-brand/40 hover:bg-brand/15'
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isRead ? 'bg-surface-3' : 'bg-brand/20'}`}>
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0 pr-8">
                          <h4 className={`font-semibold text-sm ${isRead ? 'text-white/80' : 'text-white'}`}>{n.title}</h4>
                          <p className={`text-xs mt-1 leading-relaxed ${isRead ? 'text-white/50' : 'text-white/80'}`}>
                            {n.message}
                          </p>
                          <div className="text-[10px] text-white/30 mt-2 flex items-center gap-1">
                            <FiClock size={10} />
                            {formatDate(n.createdAt)}
                          </div>
                        </div>
                      </div>

                      {/* Item Actions */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition">
                        {!isRead && (
                          <button
                            onClick={(e) => handleMarkReadOne(e, n._id)}
                            className="p-1.5 bg-brand/20 text-brand rounded hover:bg-brand/40 transition"
                            title="Mark as read"
                          >
                            <FiCheckSquare size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteOne(e, n._id)}
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

