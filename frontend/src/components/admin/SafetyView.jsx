import { useState, useEffect } from 'react'
import { FiShield, FiAlertTriangle, FiAlertOctagon, FiUserX, FiCheck, FiCheckCircle, FiXCircle, FiMessageSquare } from 'react-icons/fi'
import { adminSafetyAPI } from '../../api/endpoints'
import toast from 'react-hot-toast'
import { getImageUrl } from '../../utils/urlUtils'

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
      setReports(repRes.data.reports || [])
      setDisputes(disRes.data.disputes || [])
      setSosList(sosRes.data.sosList || [])
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
      await adminSafetyAPI.suspendUser(userId, isSuspended, isSuspended ? 'Suspended due to safety report' : 'Restored')
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

  const handleUpdateReportStatus = async (reportId, status) => {
    const notes = prompt(`Enter resolution notes for report status: ${status}`)
    if (notes === null) return
    try {
      await adminSafetyAPI.updateReportStatus(reportId, status, notes)
      toast.success(`Report status updated to ${status}`)
      fetchData()
    } catch (err) {
      toast.error('Failed to update report: ' + (err.response?.data?.message || err.message))
    }
  }

  const handleUpdateDisputeStatus = async (disputeId, status) => {
    const notes = prompt(`Enter resolution notes for dispute status: ${status}`)
    if (notes === null) return
    try {
      await adminSafetyAPI.updateDisputeStatus(disputeId, status, notes)
      toast.success(`Dispute status updated to ${status}`)
      fetchData()
    } catch (err) {
      toast.error('Failed to update dispute: ' + (err.response?.data?.message || err.message))
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
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="badge bg-yellow-500/10 text-yellow-400 text-xs uppercase">{r.targetType}</span>
                  <span className="font-bold text-sm">{r.reason}</span>
                  <span className={`badge text-[10px] uppercase ${r.status === 'resolved' ? 'bg-green-500/10 text-green-400' : 'bg-surface-3 text-white/60'}`}>{r.status}</span>
                </div>
                <p className="text-xs text-white/60 line-clamp-2">{r.description || 'No description provided.'}</p>
                {r.adminNotes && (
                  <p className="text-xs text-brand/80 bg-brand/5 p-1.5 rounded border border-brand/20">
                    <strong>Admin Note:</strong> {r.adminNotes}
                  </p>
                )}
                {r.evidence && r.evidence.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-white/40">Evidence:</span>
                    {r.evidence.map((ev, i) => (
                      <a key={i} href={getImageUrl(ev.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline text-[10px]">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-white/40 pt-1">
                  Reported by {r.reporterId?.name || 'User'} on {new Date(r.createdAt).toLocaleString()} | Target ID: {r.targetId}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleUpdateReportStatus(r._id, 'resolved')}
                    className="btn-secondary text-[11px] py-1 px-2 text-green-400 hover:bg-green-500/10 border-green-500/20"
                  >
                    <FiCheckCircle /> Resolve
                  </button>
                  <button
                    onClick={() => handleUpdateReportStatus(r._id, 'rejected')}
                    className="btn-secondary text-[11px] py-1 px-2 text-red-400 hover:bg-red-500/10 border-red-500/20"
                  >
                    <FiXCircle /> Reject
                  </button>
                </div>
                <button
                  onClick={() => handleSuspendUser(r.targetId, true)}
                  className="btn-secondary text-xs py-1.5 px-3 text-red-400 hover:bg-red-500/10 border-red-500/20"
                >
                  <FiUserX /> Suspend Target
                </button>
              </div>
            </div>
          ))
        )}

        {activeTab === 'disputes' && (
          disputes.length === 0 ? <p className="text-white/40">No disputes found.</p> :
          disputes.map(d => (
            <div key={d._id} className="card p-4 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="badge bg-red-500/10 text-red-400 text-xs uppercase">{d.reason}</span>
                  <span className={`badge text-xs uppercase ${d.status === 'resolved' ? 'bg-green-500/10 text-green-400' : 'bg-surface-3 text-white/60'}`}>{d.status}</span>
                </div>
                <span className="text-[10px] text-white/40">Booking: {d.bookingId}</span>
              </div>
              <p className="text-sm text-white/80">{d.description || 'No additional details.'}</p>
              {d.adminNotes && (
                <p className="text-xs text-brand/80 bg-brand/5 p-2 rounded border border-brand/20">
                  <strong>Admin Note:</strong> {d.adminNotes}
                </p>
              )}
              {d.evidence && d.evidence.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40">Evidence:</span>
                  {d.evidence.map((ev, i) => (
                    <a key={i} href={getImageUrl(ev.url)} target="_blank" rel="noreferrer" className="text-brand hover:underline text-[10px]">
                      Attachment {i + 1}
                    </a>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/40">
                <span>Raised by {d.raisedBy?.name || 'User'} on {new Date(d.createdAt).toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateDisputeStatus(d._id, 'resolved')}
                    className="btn-secondary text-[11px] py-1 px-2.5 text-green-400 hover:bg-green-500/10 border-green-500/20"
                  >
                    <FiCheckCircle /> Resolve Dispute
                  </button>
                  <button
                    onClick={() => handleUpdateDisputeStatus(d._id, 'rejected')}
                    className="btn-secondary text-[11px] py-1 px-2.5 text-red-400 hover:bg-red-500/10 border-red-500/20"
                  >
                    <FiXCircle /> Reject Dispute
                  </button>
                </div>
              </div>
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

