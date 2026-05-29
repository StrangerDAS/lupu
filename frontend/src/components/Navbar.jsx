import { useState, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { HiMenuAlt3, HiX } from 'react-icons/hi'
import { RiMotorbikeLine } from 'react-icons/ri'
import { FiCalendar, FiBell, FiCheckSquare } from 'react-icons/fi'
import useAuthStore from '../store/authStore'
import {
  subscribeToUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../firebase/firestoreService'

const navLinks = [
  { label: 'Explore', to: '/explore' },
  { label: 'How it works', to: '/how-it-works' },
  { label: 'About', to: '/about' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout, isAuthenticated, isKycComplete, isAdmin } = useAuthStore()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)

  useEffect(() => {
    if (user?._id) {
      const unsub = subscribeToUserNotifications(user._id, (data) => {
        setNotifications(data)
      })
      return () => unsub()
    } else {
      setNotifications([])
    }
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    // logout() handles Firebase signOut + store clear + localStorage wipe + redirect
    await logout(navigate)
  }

  const getDashboardLink = () => {
    if (!user) return null
    if (isAdmin()) return { to: '/admin', label: 'Admin Panel' }
    if (user.isOwner) return { to: '/dashboard', label: 'Dashboard' }
    return { to: '/profile', label: 'Profile' }
  }

  const dashLink = getDashboardLink()

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass border-b border-white/5' : 'bg-transparent'
      }`}
    >
      <div className="container-main">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/30 group-hover:shadow-brand/50 transition-shadow">
              <RiMotorbikeLine className="text-white text-xl" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              lupu<span className="text-brand">.</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `btn-ghost text-sm ${isActive ? 'text-white' : 'text-white/60'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated() ? (
              <>
                {/* My Bookings link — always shown for authenticated users */}
                <NavLink
                  to="/my-bookings"
                  className={({ isActive }) =>
                    `btn-ghost text-sm flex items-center gap-1.5 ${isActive ? 'text-brand' : 'text-white/60'}`
                  }
                >
                  <FiCalendar size={14} />
                  My Bookings
                </NavLink>

                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="btn-ghost p-2 text-white/60 hover:text-white relative flex items-center justify-center rounded-xl"
                  >
                    <FiBell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-brand text-[10px] text-white font-bold rounded-full flex items-center justify-center animate-bounce">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <AnimatePresence>
                    {showNotifDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-3 w-80 glass border border-white/10 rounded-2xl p-4 shadow-xl z-50 max-h-96 overflow-y-auto"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                          <span className="font-semibold text-sm">Notifications</span>
                          {unreadCount > 0 && (
                            <button
                              onClick={() => markAllNotificationsRead(user?._id)}
                              className="text-xs text-brand hover:underline flex items-center gap-1"
                            >
                              <FiCheckSquare size={12} /> Mark all read
                            </button>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          {notifications.length === 0 ? (
                            <p className="text-xs text-white/30 text-center py-4">No notifications yet</p>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n._id}
                                onClick={async () => {
                                  if (!n.read) await markNotificationRead(n._id)
                                  if (n.bookingId) navigate('/my-bookings')
                                  setShowNotifDropdown(false)
                                }}
                                className={`p-3 rounded-xl cursor-pointer transition text-left ${
                                  n.read ? 'bg-white/5 hover:bg-white/10' : 'bg-brand/10 border border-brand/20 hover:bg-brand/15'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className="font-semibold text-xs text-white/80">{n.title}</h4>
                                  {!n.read && <span className="w-1.5 h-1.5 bg-brand rounded-full shrink-0 mt-1" />}
                                </div>
                                <p className="text-[11px] text-white/50 mt-1 leading-normal">{n.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {dashLink && (
                  <Link to={dashLink.to} className="btn-ghost text-sm text-white/70">
                    {dashLink.label}
                  </Link>
                )}
                {isAuthenticated() && !isKycComplete() && (
                  <Link
                    to="/verify"
                    className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full font-semibold hover:bg-amber-500/25 transition flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                    Verify
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="btn-ghost text-sm text-white/70">
                  Log in
                </Link>
                <Link to="/auth/signup" className="btn-primary text-sm px-5 py-2.5">
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/5 transition"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <HiX size={24} /> : <HiMenuAlt3 size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden glass border-t border-white/5 overflow-hidden"
          >
            <div className="container-main py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="btn-ghost text-sm w-full text-left"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="divider my-2" />
              {isAuthenticated() ? (
                <>
                  <Link
                    to="/my-bookings"
                    className="btn-ghost text-sm w-full text-left flex items-center gap-2"
                    onClick={() => setMenuOpen(false)}
                  >
                    <FiCalendar size={14} />
                    My Bookings
                  </Link>
                  {dashLink && (
                    <Link
                      to={dashLink.to}
                      className="btn-ghost text-sm text-white/70 w-full text-left"
                      onClick={() => setMenuOpen(false)}
                    >
                      {dashLink.label}
                    </Link>
                  )}
                  <button onClick={handleLogout} className="btn-secondary text-sm mt-1">
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth/login"
                    className="btn-ghost text-sm text-white/70"
                    onClick={() => setMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    to="/auth/signup"
                    className="btn-primary text-sm mt-1 text-center"
                    onClick={() => setMenuOpen(false)}
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
