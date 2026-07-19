import { useState, useEffect } from 'react'
import { FiShield, FiAlertTriangle, FiAlertOctagon, FiUserX, FiCheck } from 'react-icons/fi'
import { adminSafetyAPI } from '../../api/endpoints'
import toast from 'react-hot-toast'

export default function SafetyView() {
  const [activeTab, setActiveTab] = useState('reports') // reports, disputes, sos
  const [reports, setReports] = useState([])
  const [disputes, setDisputes] = useState([])
  const [sosList, setSosList] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [repRes, disRes, sosRes] = await Promise.all([
        adminSafetyAPI.getReports(),
        adminSafetyAPI.getDisputes(),
        adminSafetyAPI.getSOS()
      ])
      setReports(repRes.data.reports)
      setDisputes(disRes.data.disputes)
      setSosList(sosRes.data.sosList)
    } catch (err) {
      console.error('Failed to fetch safety data', err)
      toast.error('Failed to load safety data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSuspendUser = async (userId, isSuspended) => {
    try {
      await adminSafetyAPI.suspendUser(userId, isSuspended)
      toast.success(isSuspended ? 'User suspended' : 'User suspension lifted')
      fetchData()
    } catch (err) {
      toast.error('Failed to update suspension status')
    }
  }

  const handleUpdateFraudScore = async (userId, currentScore) => {
    const newScore = prompt('Enter new fraud score (0-100):', currentScore)
    if (newScore === null || isNaN(parseInt(newScore))) return
    try {
      await adminSafetyAPI.updateFraudScore(userId, parseInt(newScore))
      toast.success('Fraud score updated')
      fetchData()
    } catch (err) {
      toast.error('Failed to update fraud score')
    }
  }

  if (loading) return <div className="p-10 text-center text-white/50">Loading Safety Data...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <FiShield className="text-brand" /> Trust & Safety Center
        </h2>
        <p className="text-white/50 text-sm">Monitor user reports, resolve booking disputes, and handle SOS emergency alerts.</p>
      </div>

      <div className="flex items-center gap-4 border-b border-white/5 pb-2">
        <button
          className={`pb-2 px-1 border-b-2 transition ${activeTab === 'reports' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
          onClick={() => setActiveTab('reports')}
        >
          User/Vehicle Reports ({reports.length})
        </button>
        <button
          className={`pb-2 px-1 border-b-2 transition ${activeTab === 'disputes' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
          onClick={() => setActiveTab('disputes')}
        >
          Booking Disputes ({disputes.length})
        </button>
        <button
          className={`pb-2 px-1 border-b-2 transition ${activeTab === 'sos' ? 'border-brand text-brand' : 'border-transparent text-white/50 hover:text-white'}`}
          onClick={() => setActiveTab('sos')}
        >
          SOS Alerts <span className="text-red-500 font-bold">({sosList.length})</span>
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'reports' && (
          reports.length === 0 ? <p className="text-white/40">No reports found.</p> :
          reports.map(r => (
            <div key={r._id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-yellow-500/10 text-yellow-400 text-xs uppercase">{r.targetType}</span>
                  <span className="font-bold text-sm">{r.reason}</span>
                </div>
                <p className="text-xs text-white/60 line-clamp-2 mb-2">{r.description || 'No description provided.'}</p>
                <div className="text-[10px] text-white/40">
                  Reported by {r.reporterId?.name || r.reporterId} on {new Date(r.createdAt).toLocaleString()}
                  <br />
                  Target ID: {r.targetId}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => handleSuspendUser(r.targetId, true)}
                  className="btn-secondary text-xs py-1.5 px-3 text-red-400 hover:bg-red-500/10 border-red-500/20"
                >
                  <FiUserX /> Suspend Target
                </button>
                <button
                  onClick={() => handleUpdateFraudScore(r.targetId, 50)}
                  className="btn-secondary text-xs py-1.5 px-3 text-amber-400 hover:bg-amber-500/10 border-amber-500/20"
                >
                  <FiAlertTriangle /> Flag Fraud
                </button>
              </div>
            </div>
          ))
        )}

        {activeTab === 'disputes' && (
          disputes.length === 0 ? <p className="text-white/40">No disputes found.</p> :
          disputes.map(d => (
            <div key={d._id} className="card p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge bg-red-500/10 text-red-400 text-xs uppercase">{d.reason}</span>
                  <span className={`badge text-xs uppercase ${d.status === 'resolved' ? 'bg-green-500/10 text-green-400' : 'bg-surface-3 text-white/60'}`}>{d.status}</span>
                </div>
                <span className="text-[10px] text-white/40">Booking: {d.bookingId}</span>
              </div>
              <p className="text-sm text-white/80 mb-2">{d.description || 'No additional details.'}</p>
              <div className="text-[10px] text-white/40 mb-3">Raised by {d.raisedBy?.name || d.raisedBy} on {new Date(d.createdAt).toLocaleString()}</div>
            </div>
          ))
        )}

        {activeTab === 'sos' && (
          sosList.length === 0 ? <p className="text-white/40">No SOS alerts found.</p> :
          sosList.map(s => (
            <div key={s._id} className="card p-4 border-2 border-red-500/30 bg-red-500/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-red-400 font-bold">
                  <FiAlertOctagon size={18} /> SOS TRIGGERED
                </div>
                <span className={`badge text-xs uppercase ${s.status === 'resolved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500 text-white animate-pulse'}`}>{s.status}</span>
              </div>
              <p className="text-sm text-white mb-1"><strong>Location:</strong> {s.location || 'Unknown'}</p>
              <div className="text-xs text-white/60 mb-2">
                User: {s.userId?.name} ({s.userId?.phone}) <br/>
                Booking: {s.bookingId}
              </div>
              <div className="text-[10px] text-white/40">Triggered at: {new Date(s.createdAt).toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
