import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiUsers, FiCalendar, FiDollarSign, FiAlertCircle, 
  FiMessageSquare, FiStar, FiFileText, FiBell, FiShield, 
  FiSettings, FiGrid, FiMenu, FiX, FiLogOut, FiAnchor, FiPercent
} from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import { getVisibleModules, isFounder as checkFounder, isSuperAdmin as checkSuperAdmin } from '../lib/roleUtils'

// Firebase Services (Legacy)
// Mock data removed in Sprint 2

// Auth Store
import useAuthStore from '../store/authStore'
import PageWrapper from '../components/PageWrapper'
import ErrorBoundary from '../components/ErrorBoundary'
import { adminAPI, userAPI, bookingAPI, paymentAPI } from '../api/endpoints'

// Administrative Subviews
import DashboardView from '../components/admin/DashboardView'
import FounderDashboard from '../components/admin/FounderDashboard'
import UsersView from '../components/admin/UsersView'
import VehiclesView from '../components/admin/VehiclesView'
import BookingsView from '../components/admin/BookingsView'
import PaymentsView from '../components/admin/PaymentsView'
import SafetyView from '../components/admin/SafetyView'
import SupportView from '../components/admin/SupportView'
import ReviewsView from '../components/admin/ReviewsView'
import NotificationsView from '../components/admin/NotificationsView'
import AuditLogsView from '../components/admin/AuditLogsView'
import AdminsView from '../components/admin/AdminsView'
import CommissionView from '../components/admin/CommissionView'
import SettingsView from '../components/admin/SettingsView'

export default function AdminPanel() {
  const { subview } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  
  // Navigation / Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Real-time Database States
  const [users, setUsers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [payments, setPayments] = useState([])
  const [disputes, setDisputes] = useState([])
  const [tickets, setTickets] = useState([])
  const [reports, setReports] = useState([])
  const [adminActions, setAdminActions] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  // Determine active subview
  const activeTab = subview || 'dashboard'

  const loadVehicles = async () => {
    try {
      const res = await adminAPI.getAllVehicles()
      setVehicles(res.data.vehicles || [])
    } catch (err) {
      console.error('Failed to load vehicles:', err)
    }
  }

  // Fetch users from Express API
  const loadUsers = async () => {
    try {
      const res = await userAPI.getAll()
      setUsers(res.data.users || [])
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const loadBookings = async () => {
    try {
      const res = await bookingAPI.getAll()
      setBookings(res.data?.bookings || [])
    } catch (err) {
      console.error('Failed to load bookings:', err)
    }
  }

  const loadPayments = async () => {
    try {
      const res = await paymentAPI.getHistory()
      setPayments(res.data?.payments || res.data || [])
    } catch (err) {
      console.error('Failed to load payments:', err)
    }
  }

  // Subscriptions hooks
  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadVehicles(),
      loadUsers(),
      loadBookings(),
      loadPayments()
    ]).finally(() => {
      setLoading(false)
    })
  }, [])

  // Icon map — keyed by roleUtils module id
  const MODULE_ICONS = {
    dashboard:     FiGrid,
    founder:       FiAnchor,
    users:         FiUsers,
    vehicles:      RiMotorbikeLine,
    bookings:      FiCalendar,
    payments:      FiDollarSign,
    safety:        FiShield,
    support:       FiMessageSquare,
    reviews:       FiStar,
    'audit-logs':  FiFileText,
    admins:        FiShield,
    commission:    FiPercent,
    settings:      FiSettings,
    notifications: FiBell,
  }

  // Badge counts for urgent items
  const MODULE_BADGES = {
    support:   tickets.filter(t => t.status === 'open').length  || null,
  }

  // Derive visible modules from Firestore role (via roleUtils — no hardcoding)
  const visibleMenuItems = getVisibleModules(user).map(m => ({
    ...m,
    icon:  MODULE_ICONS[m.id] || FiGrid,
    badge: MODULE_BADGES[m.id] || null,
  }))

  // Select which view to render
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView users={users} vehicles={vehicles} bookings={bookings} disputes={disputes} tickets={tickets} reports={reports} adminActions={adminActions} />
      case 'founder':
        if (!checkFounder(user)) return <UnauthorizedMessage />
        return <FounderDashboard users={[]} vehicles={vehicles} bookings={bookings} payments={payments} />
      case 'users':
        return <UsersView />
      case 'vehicles':
        return <VehiclesView vehicles={vehicles} onRefresh={loadVehicles} />
      case 'bookings':
        return <BookingsView bookings={bookings} />
      case 'payments':
        return <PaymentsView payments={payments} />
      case 'safety':
        return <SafetyView />
      case 'support':
        return <SupportView tickets={tickets} />
      case 'reviews':
        return <ReviewsView reviews={reviews} />
      case 'audit-logs':
        return <AuditLogsView adminActions={adminActions} />
      case 'admins':
        if (!checkSuperAdmin(user)) return <UnauthorizedMessage />
        return <AdminsView />
      case 'commission':
        if (!checkFounder(user)) return <UnauthorizedMessage />
        return <CommissionView />
      case 'settings':
        if (!checkFounder(user)) return <UnauthorizedMessage />
        return <SettingsView />
      case 'notifications':
        return <NotificationsView />
      default:
        return <DashboardView users={users} vehicles={vehicles} bookings={bookings} disputes={disputes} tickets={tickets} reports={reports} adminActions={adminActions} />
    }
  }

  const navigateToTab = (tabId) => {
    navigate(`/admin/${tabId}`)
    setSidebarOpen(false)
  }

  return (
    <PageWrapper>
      <div className="flex min-h-screen bg-black text-white relative">
        {/* Toggle Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-brand rounded-full shadow-lg text-white"
        >
          {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>

        {/* Sidebar Container */}
        <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0d0d0d] border-r border-white/5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:flex lg:flex-col`}>
          <div className="flex flex-col h-full">
            {/* Sidebar Branding */}
            <div className="p-6 border-b border-white/5">
              <h1 className="text-gradient text-lg font-bold tracking-wider">LUPU ADMIN</h1>
              <p className="text-[10px] text-white/30 tracking-widest uppercase mt-0.5">Control Center</p>
            </div>

            {/* Profile widget */}
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center font-bold text-xs uppercase text-brand">
                {user?.name?.[0] || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user?.name || 'Administrator'}</div>
                <div className="text-[9px] font-bold text-brand uppercase tracking-wider">{user?.role || 'Admin'}</div>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto hide-scrollbar">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateToTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition text-xs font-semibold ${
                      isActive 
                        ? 'bg-brand text-white shadow-lg shadow-brand/10' 
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-sm shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        isActive ? 'bg-white text-brand' : 'bg-brand text-white'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Logout button — calls Firebase signOut + clears Zustand + localStorage */}
            <div className="p-4 border-t border-white/5">
              <button
                onClick={() => logout(navigate)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition"
              >
                <FiLogOut className="text-sm" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content view container */}
        <div className="flex-1 p-6 lg:p-10 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-xs text-white/30 gap-2">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <span>Loading data...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <ErrorBoundary>
                  {renderActiveView()}
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function UnauthorizedMessage() {
  return (
    <div className="text-center py-20 text-white/40 text-xs space-y-2">
      <FiShield size={36} className="mx-auto text-red-500 mb-2" />
      <h3 className="font-bold text-white text-sm">Privileged Access Required</h3>
      <p>Your administrative permissions do not permit access to this module.</p>
    </div>
  )
}
