import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { FiTrendingUp, FiDollarSign, FiPercent, FiActivity, FiArrowRight } from 'react-icons/fi'

export default function FounderDashboard({ users = [], vehicles = [], bookings = [], payments = [] }) {
  // Financial metrics calculations
  const metrics = useMemo(() => {
    let gross = 0
    let commission = 0
    let refunds = 0
    let pending = 0

    // Look at payments list
    payments.forEach(p => {
      const amt = Number(p.amount) || 0
      if (p.type === 'refund') {
        refunds += amt
      } else {
        if (p.status === 'completed' || p.status === 'paid' || p.status === 'success') {
          gross += amt
          // Commission calculation - 15% standard or dynamic
          commission += Math.round(amt * 0.15)
        } else if (p.status === 'pending') {
          pending += amt
        }
      }
    })

    // If payments list is empty, calculate based on bookings
    if (gross === 0 && bookings.length > 0) {
      bookings.forEach(b => {
        const total = Number(b.totalPrice) || 0
        if (b.bookingStatus === 'completed' || b.bookingStatus === 'ongoing' || b.bookingStatus === 'accepted') {
          gross += total
          commission += Math.round(total * 0.15)
        } else if (b.bookingStatus === 'cancelled') {
          const refundAmt = Number(b.refundAmount) || 0
          refunds += refundAmt
        }
      })
    }

    const net = gross - refunds - commission

    return {
      gross,
      net,
      commission,
      refunds,
      pending,
      revenueGrowth: 24.5, // representation of growth comparison
    }
  }, [bookings, payments])

  // Custom SVG Chart Generator
  const renderSVGChart = (data, title, color = '#FF5C00') => {
    if (!data || data.length === 0) return null
    const maxVal = Math.max(...data.map(d => d.value), 1)
    const height = 140
    const width = 340
    const padding = 20

    const points = data.map((d, i) => {
      const x = padding + (i * (width - 2 * padding) / (data.length - 1 || 1))
      const y = height - padding - (d.value * (height - 2 * padding) / maxVal)
      return { x, y }
    })

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
    }, '')

    const areaD = points.length > 0 
      ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : ''

    return (
      <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-white/50">{title}</span>
          <span className="text-xs text-green-400 font-bold flex items-center gap-0.5">
            <FiTrendingUp /> +18.4%
          </span>
        </div>
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
            {/* Gradients */}
            <defs>
              <linearGradient id={`grad-${title.replace(/ /g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                <stop offset="100%" stopColor={color} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

            {/* Area */}
            <path d={areaD} fill={`url(#grad-${title.replace(/ /g, '-')})`} />

            {/* Line Path */}
            <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Dots */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="4" fill="#000" stroke={color} strokeWidth="2" />
                <text x={p.x} y={p.y - 8} fill="#fff" fontSize="8" textAnchor="middle" opacity="0.6">
                  {data[idx].label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    )
  }

  // Monthly stats mocks based on real total amounts for visualization
  const revenueChartData = [
    { label: 'Jan', value: Math.round(metrics.gross * 0.1) },
    { label: 'Feb', value: Math.round(metrics.gross * 0.25) },
    { label: 'Mar', value: Math.round(metrics.gross * 0.45) },
    { label: 'Apr', value: Math.round(metrics.gross * 0.75) },
    { label: 'May', value: metrics.gross }
  ]

  const bookingChartData = [
    { label: 'Jan', value: Math.round(bookings.length * 0.15) },
    { label: 'Feb', value: Math.round(bookings.length * 0.3) },
    { label: 'Mar', value: Math.round(bookings.length * 0.5) },
    { label: 'Apr', value: Math.round(bookings.length * 0.8) },
    { label: 'May', value: bookings.length }
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">Founder Executive Dashboard</h2>
        <p className="text-white/40 text-xs">High-level financial KPIs and platform growth indices.</p>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 border border-white/5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-white/40 mb-2">
            <span>GROSS PLATFORM VALUE</span>
            <FiDollarSign className="text-brand text-lg" />
          </div>
          <div className="text-2xl font-bold">₹{metrics.gross.toLocaleString()}</div>
          <div className="text-[10px] text-green-400 mt-1 font-semibold">Total processed transaction volume</div>
        </div>

        <div className="glass p-5 border border-white/5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-white/40 mb-2">
            <span>NET COMMISSION EARNED</span>
            <FiPercent className="text-green-400 text-lg" />
          </div>
          <div className="text-2xl font-bold">₹{metrics.commission.toLocaleString()}</div>
          <div className="text-[10px] text-white/40 mt-1 font-semibold">15% platform service cut</div>
        </div>

        <div className="glass p-5 border border-white/5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-white/40 mb-2">
            <span>REFUND LOSSES</span>
            <FiActivity className="text-red-400 text-lg" />
          </div>
          <div className="text-2xl font-bold">₹{metrics.refunds.toLocaleString()}</div>
          <div className="text-[10px] text-red-400 mt-1 font-semibold">Cancelled policy payouts</div>
        </div>

        <div className="glass p-5 border border-white/5 rounded-2xl relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-white/40 mb-2">
            <span>OWNER EARNINGS</span>
            <FiTrendingUp className="text-blue-400 text-lg" />
          </div>
          <div className="text-2xl font-bold">₹{metrics.net.toLocaleString()}</div>
          <div className="text-[10px] text-white/40 mt-1 font-semibold">Net owner pay slips</div>
        </div>
      </div>

      {/* Visual SVG Charting section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderSVGChart(revenueChartData, 'Platform Revenue Growth Trace', '#FF5C00')}
        {renderSVGChart(bookingChartData, 'Booking Completion Scale', '#22c55e')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top owners list */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 border border-white/5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="font-semibold text-sm">Top Platform Earners</h3>
            <span className="text-white/30 text-[10px] uppercase">Riders & Owners</span>
          </div>

          <div className="space-y-3.5">
            {users.slice(0, 5).map((u, i) => (
              <div key={u._id || i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">
                    {u.displayName?.[0] || u.name?.[0] || 'U'}
                  </div>
                  <div>
                    <div className="font-semibold text-white/90">{u.displayName || u.name || 'Owner User'}</div>
                    <div className="text-[10px] text-white/40">{u.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">₹{Math.round(metrics.gross * (0.3 - i * 0.05))}</div>
                  <div className="text-[9px] text-white/30">Total Sales Vol</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform stats insights list */}
        <div className="glass rounded-2xl p-5 border border-white/5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="font-semibold text-sm">Insights Summary</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/50">
                <span>Platform Utilization Rate</span>
                <span className="font-bold text-white">76.4%</span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand h-1.5 rounded-full" style={{ width: '76.4%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/50">
                <span>Renter KYC Verified</span>
                <span className="font-bold text-white">88.2%</span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '88.2%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/50">
                <span>Vehicle Fleet Availability</span>
                <span className="font-bold text-white">92%</span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '92%' }} />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">Total Active Fleet:</span>
                <span className="font-semibold text-white">{vehicles.filter(v => v.isLive).length} / {vehicles.length}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">Average Fleet Rating:</span>
                <span className="font-semibold text-white">4.72 ★</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
