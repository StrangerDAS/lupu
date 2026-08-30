import { useState } from 'react'
import { FiSearch, FiDollarSign } from 'react-icons/fi'

export default function PaymentsView({ payments = [] }) {
  const [search, setSearch] = useState('')

  const safePayments = Array.isArray(payments) ? payments : []
  const filteredPayments = safePayments.filter(p =>
    (p?.bookingId || '').toLowerCase().includes(search.toLowerCase()) ||
    (p?._id || p?.id || '').toLowerCase().includes(search.toLowerCase()) ||
    (p?.type || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Financial Transaction Ledger</h2>
          <p className="text-white/40 text-xs">Review payouts, commission calculations, and transaction histories.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search payments by booking/tx ID..."
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
                <th className="p-4">Transaction ID</th>
                <th className="p-4">Booking ID</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Type</th>
                <th className="p-4">Platform Commission</th>
                <th className="p-4">Owner Earnings</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-white/30 text-xs">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const amt = Number(p?.amount) || 0
                  const isRefund = p?.type === 'refund'
                  const comm = isRefund ? 0 : (p?.platformFee !== undefined ? Number(p.platformFee) : 0)
                  const ownerShare = isRefund ? 0 : (p?.ownerPayoutAmount !== undefined ? Number(p.ownerPayoutAmount) : (amt - comm))
                  const secDeposit = Number(p?.securityDeposit) || 0

                  return (
                    <tr key={p?._id || p?.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-mono text-white/50">{p?.transactionId || p?._id || p?.id}</td>
                      <td className="p-4 font-mono font-bold text-white/80">{p?.bookingId?._id || p?.bookingId || 'Unknown'}</td>
                      <td className={`p-4 font-semibold ${isRefund ? 'text-red-400' : 'text-white'}`}>
                        {isRefund ? '-' : ''}₹{amt.toLocaleString()}
                        {secDeposit > 0 && <div className="text-[10px] text-white/40">Dep: ₹{secDeposit}</div>}
                      </td>
                      <td className="p-4 capitalize">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isRefund ? 'bg-red-500/10 text-red-400' : 'bg-brand/10 text-brand'
                        }`}>
                          {p?.type || 'rental'}
                        </span>
                      </td>
                      <td className="p-4 text-white/60">₹{comm.toLocaleString()}</td>
                      <td className="p-4 text-brand font-bold">₹{ownerShare.toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`badge capitalize ${
                          p?.status === 'paid' || p?.status === 'success'
                            ? 'bg-green-500/20 text-green-400 border-green-500/20'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {p?.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
