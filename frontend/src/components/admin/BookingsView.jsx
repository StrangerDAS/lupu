import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiCalendar, FiClock, FiFileText } from 'react-icons/fi'

export default function BookingsView({ bookings = [] }) {
  const [search, setSearch] = useState('')
  const [selectedBooking, setSelectedBooking] = useState(null)

  const safeBookings = Array.isArray(bookings) ? bookings : []
  const filteredBookings = safeBookings.filter(b =>
    b?.vehicleName?.toLowerCase().includes(search.toLowerCase()) ||
    b?.renterName?.toLowerCase().includes(search.toLowerCase()) ||
    b?.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
    (b?._id || b?.id || '').toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status) => {
    const map = {
      completed: 'bg-green-500/20 text-green-400 border border-green-500/20',
      ongoing: 'bg-blue-500/20 text-blue-400 border border-blue-500/20',
      active: 'bg-blue-500/20 text-blue-400 border border-blue-500/20',
      pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20',
      cancelled: 'bg-red-500/20 text-red-400 border border-red-500/20',
    }
    return <span className={`badge capitalize ${map[status] || 'bg-white/10 text-white/50 border border-white/5'}`}>{status}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Global Booking Logs</h2>
          <p className="text-white/40 text-xs">Track active rides, completed tours, cancelled contracts, and booking details.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search booking ID, vehicle, owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-9"
          />
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-white/50 font-medium">
                <th className="p-4">Booking ID</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4">Renter</th>
                <th className="p-4">Owner</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Rent Value</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-white/30 text-xs">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr key={b?._id || b?.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono font-bold text-white/70">{b?._id || b?.id}</td>
                    <td className="p-4 font-semibold text-white/95">{b?.vehicleName || 'Unknown'}</td>
                    <td className="p-4 text-white/75">{b?.renterName || 'Unknown'}</td>
                    <td className="p-4 text-white/75">{b?.ownerName || 'Unknown'}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-1"><FiClock /> {b?.duration || 1} hrs</span>
                    </td>
                    <td className="p-4 font-semibold text-brand">₹{b?.totalPrice || b?.pricing?.total || 0}</td>
                    <td className="p-4">{getStatusBadge(b?.bookingStatus || b?.status)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedBooking(b)}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[10px] font-semibold"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass max-w-md w-full rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex justify-between items-start pb-2 border-b border-white/5">
              <div>
                <h3 className="font-bold text-sm text-white/90">Booking Agreement Overview</h3>
                <span className="text-[10px] text-white/30 font-mono">ID: {selectedBooking._id || selectedBooking.id}</span>
              </div>
              {getStatusBadge(selectedBooking.bookingStatus)}
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Renter details</span>
                  <span className="font-semibold text-white/95">{selectedBooking.renterName}</span>
                  <span className="block text-[10px] text-white/40">{selectedBooking.renterEmail}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-white/40 text-[10px] block uppercase font-bold">Owner details</span>
                  <span className="font-semibold text-white/95">{selectedBooking.ownerName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-white/40 text-[10px] block uppercase font-bold">Rental Period</span>
                <span className="text-white flex items-center gap-1.5"><FiCalendar /> {selectedBooking.startTime} to {selectedBooking.endTime}</span>
              </div>

              <div className="bg-white/5 p-3 rounded-lg border border-white/5 space-y-2">
                <div className="text-[10px] font-semibold text-white/50 uppercase">Legal Agreement Status</div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-white/60">Agreement Signed:</span>
                  <span className="text-green-400 font-bold">Yes (Legally Binding)</span>
                </div>
                {selectedBooking.agreementAccepted && (
                  <button className="text-brand hover:underline font-bold flex items-center gap-0.5 text-[10px] mt-1"><FiFileText /> View Contract Agreement PDF</button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-xs font-semibold text-white"
              >
                Close View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
