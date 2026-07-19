import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiUsers, FiCpu, FiBookmark, FiAlertCircle, FiSettings, FiCheckCircle } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'

export default function DashboardView({ users = [], vehicles = [], bookings = [], disputes = [], tickets = [], reports = [], adminActions = [] }) {
  const safeUsers = Array.isArray(users) ? users : []
  const safeVehicles = Array.isArray(vehicles) ? vehicles : []
  const safeBookings = Array.isArray(bookings) ? bookings : []
  const safeDisputes = Array.isArray(disputes) ? disputes : []
  const safeTickets = Array.isArray(tickets) ? tickets : []
  const safeReports = Array.isArray(reports) ? reports : []
  const safeActions = Array.isArray(adminActions) ? adminActions : []

  const stats = {
    totalUsers: safeUsers.length,
    activeUsers: safeUsers.filter(u => u?.status !== 'suspended').length,
    verifiedUsers: safeUsers.filter(u => u?.kycStatus === 'verified').length,
    pendingVerifications: safeUsers.filter(u => u?.kycStatus === 'pending').length,
    suspendedUsers: safeUsers.filter(u => u?.status === 'suspended').length,
    
    totalVehicles: safeVehicles.length,
    approvedVehicles: safeVehicles.filter(v => v?.status === 'approved').length,
    pendingVehicles: safeVehicles.filter(v => v?.status === 'pending').length,
    rejectedVehicles: safeVehicles.filter(v => v?.status === 'rejected').length,
    activeVehicles: safeVehicles.filter(v => v?.isLive).length,

    totalBookings: safeBookings.length,
    activeBookings: safeBookings.filter(b => b?.bookingStatus === 'active' || b?.bookingStatus === 'ongoing').length,
    completedBookings: safeBookings.filter(b => b?.bookingStatus === 'completed').length,
    cancelledBookings: safeBookings.filter(b => b?.bookingStatus === 'cancelled').length,
    disputedBookings: safeBookings.filter(b => b?.bookingStatus === 'disputed').length,

    openDisputes: safeDisputes.filter(d => d?.status === 'open').length,
    openReports: safeReports.filter(r => r?.status === 'open').length,
    openTickets: safeTickets.filter(t => t?.status === 'open').length,
    
    // Finance
    totalRevenue: safeBookings.reduce((sum, b) => sum + (b?.bookingFee || 0), 0),
    outstandingOwnerPayments: safeBookings.filter(b => b?.ownerPaymentStatus === 'Pending Owner Payment').reduce((sum, b) => sum + ((b?.remainingAmount || 0) + (b?.lateReturnInfo?.lateCharge || 0)), 0),
    lateChargesEarned: safeBookings.reduce((sum, b) => sum + (b?.lateReturnInfo?.lateCharge || 0), 0),
    totalRentalVolume: safeBookings.reduce((sum, b) => sum + (b?.rentalAmount || 0), 0),
  }

  const statGroups = [
    {
      title: 'Users',
      color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400',
      icon: FiUsers,
      items: [
        { label: 'Total Users', value: stats.totalUsers },
        { label: 'Active Users', value: stats.activeUsers },
        { label: 'Pending KYC', value: stats.pendingVerifications, highlight: stats.pendingVerifications > 0 ? 'text-yellow-400 font-bold' : '' },
        { label: 'Verified Users', value: stats.verifiedUsers },
        { label: 'Suspended', value: stats.suspendedUsers, highlight: stats.suspendedUsers > 0 ? 'text-red-400 font-bold' : '' }
      ]
    },
    {
      title: 'Vehicles',
      color: 'from-orange-500/20 to-brand/20 border-brand/30 text-brand',
      icon: RiMotorbikeLine,
      items: [
        { label: 'Total Listings', value: stats.totalVehicles },
        { label: 'Approved', value: stats.approvedVehicles },
        { label: 'Pending Queue', value: stats.pendingVehicles, highlight: stats.pendingVehicles > 0 ? 'text-yellow-400 font-bold' : '' },
        { label: 'Live & Active', value: stats.activeVehicles }
      ]
    },
    {
      title: 'Bookings',
      color: 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400',
      icon: FiBookmark,
      items: [
        { label: 'Total Bookings', value: stats.totalBookings },
        { label: 'Active Rides', value: stats.activeBookings },
        { label: 'Completed', value: stats.completedBookings },
        { label: 'Cancelled', value: stats.cancelledBookings }
      ]
    },
    {
      title: 'Operations & Alerts',
      color: 'from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400',
      icon: FiAlertCircle,
      items: [
        { label: 'Open Disputes', value: stats.openDisputes, highlight: stats.openDisputes > 0 ? 'text-red-400 font-bold' : '' },
        { label: 'Open Reports', value: stats.openReports, highlight: stats.openReports > 0 ? 'text-yellow-400 font-bold' : '' },
        { label: 'Open Tickets', value: stats.openTickets, highlight: stats.openTickets > 0 ? 'text-blue-400 font-bold' : '' }
      ]
    },
    {
      title: 'Finance & Revenue',
      color: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30 text-amber-400',
      icon: FiCheckCircle,
      items: [
        // { label: 'Total Platform Revenue', value: `₹${stats.totalRevenue}` }, // Hidden for Beta
        { label: 'Total Rental Volume', value: `₹${stats.totalRentalVolume}` },
        { label: 'Pending Owner Payouts', value: `₹${stats.outstandingOwnerPayments}`, highlight: stats.outstandingOwnerPayments > 0 ? 'text-red-400 font-bold' : '' },
        { label: 'Late Charges Generated', value: `₹${stats.lateChargesEarned}` }
      ]
    }
  ]

  // Combine real activity logs
  const displayActivities = [...safeActions].slice(0, 10)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">Operations Overview</h2>
        <p className="text-white/40 text-xs">Real-time status updates across the Lupu network.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {statGroups.map((g, idx) => (
          <motion.div
            key={g.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`glass rounded-2xl p-5 border bg-gradient-to-br ${g.color.split(' ')[0]} ${g.color.split(' ')[1]} ${g.color.split(' ')[2]}`}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
              <span className="font-semibold text-sm tracking-wide uppercase text-white/80">{g.title}</span>
              <g.icon className="text-lg" />
            </div>
            <div className="space-y-2.5">
              {g.items.map(item => (
                <div key={item.label} className="flex justify-between items-center text-xs">
                  <span className="text-white/50">{item.label}</span>
                  <span className={`font-semibold text-sm ${item.highlight || 'text-white'}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="font-semibold text-sm">Recent Platform Activity Feed</h3>
            <span className="text-white/30 text-[10px] uppercase">Real-time Admin Actions</span>
          </div>

          {displayActivities.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-xs">No recent admin activity recorded yet.</div>
          ) : (
            <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
              {displayActivities.map((act) => (
                <div key={act._id} className="flex items-start gap-3.5 text-xs py-2 border-b border-white/5 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                    <FiCpu className="text-brand text-xs" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white/90">{act.adminName || 'System'}</span>
                      <span className="text-white/30 text-[9px]">
                        {act.timestamp?.seconds 
                          ? new Date(act.timestamp.seconds * 1000).toLocaleTimeString()
                          : 'Just now'}
                      </span>
                    </div>
                    <p className="text-white/60 mt-0.5 font-medium">
                      <span className="text-brand/90 font-semibold">{act.actionType}</span> - {act.notes || `Updated record in ${act.affectedRecord?.collection || 'database'}`}
                    </p>
                    {act.affectedRecord && (
                      <div className="mt-1 text-[10px] text-white/40">
                        Affected: <span className="text-white/60">{act.affectedRecord.name}</span> ({act.affectedRecord.docId})
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="font-semibold text-sm">Quick Links</h3>
            <FiSettings className="text-white/30 text-sm" />
          </div>
          <div className="space-y-2.5">
            <div className="p-3 bg-surface-2/40 hover:bg-surface-2 rounded-xl transition cursor-pointer border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white/90">Pending Approvals</div>
                <div className="text-[10px] text-white/40">{stats.pendingVehicles} vehicles in queue</div>
              </div>
              {stats.pendingVehicles > 0 && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full text-[10px] font-bold">
                  {stats.pendingVehicles}
                </span>
              )}
            </div>

            <div className="p-3 bg-surface-2/40 hover:bg-surface-2 rounded-xl transition cursor-pointer border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white/90">Dispute Escalations</div>
                <div className="text-[10px] text-white/40">{stats.openDisputes} active cases</div>
              </div>
              {stats.openDisputes > 0 && (
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold">
                  {stats.openDisputes}
                </span>
              )}
            </div>

            <div className="p-3 bg-surface-2/40 hover:bg-surface-2 rounded-xl transition cursor-pointer border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white/90">Support Tickets</div>
                <div className="text-[10px] text-white/40">{stats.openTickets} awaiting reply</div>
              </div>
              {stats.openTickets > 0 && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-bold">
                  {stats.openTickets}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
