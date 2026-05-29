import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSearch, FiSend, FiCheckSquare, FiAlertCircle } from 'react-icons/fi'
import { replyToSupportTicket, updateSupportTicketStatus } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function SupportView({ tickets = [] }) {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [message, setMessage] = useState('')

  const filteredTickets = tickets.filter(t =>
    (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.userName || '').toLowerCase().includes(search.toLowerCase()) ||
    (t._id || t.id || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleReply = async (e) => {
    e.preventDefault()
    if (!selectedTicket || !message.trim()) return
    try {
      await replyToSupportTicket(selectedTicket._id || selectedTicket.id, user._id, user.name, message, true)
      setMessage('')
      toast.success('Reply submitted.')
    } catch (err) {
      toast.error('Failed to send message: ' + err.message)
    }
  }

  const handleCloseTicket = async () => {
    if (!selectedTicket) return
    try {
      await updateSupportTicketStatus(selectedTicket._id || selectedTicket.id, 'closed', user._id, user.name)
      toast.success('Ticket closed successfully.')
      setSelectedTicket(null)
    } catch (err) {
      toast.error('Failed to close ticket: ' + err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Customer Support Center</h2>
          <p className="text-white/40 text-xs">Reply to booking, payment, or technical assistance tickets.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-xs" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs py-2 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1 space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-xs">No support tickets found.</div>
          ) : (
            filteredTickets.map(t => (
              <div
                key={t._id || t.id}
                onClick={() => setSelectedTicket(t)}
                className={`p-3.5 rounded-xl border cursor-pointer transition text-xs flex flex-col gap-2 ${
                  selectedTicket?._id === t._id 
                    ? 'border-brand/40 bg-brand/5' 
                    : 'border-white/5 bg-surface-2/15 hover:bg-white/5'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[9px] font-bold uppercase">{t.category}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] capitalize ${t.status === 'closed' ? 'bg-white/10 text-white/40' : 'bg-green-500/20 text-green-400'}`}>{t.status}</span>
                </div>
                <h4 className="font-semibold text-white/90 truncate">{t.subject}</h4>
                <div className="text-[10px] text-white/40 flex justify-between items-center mt-1">
                  <span>From: {t.userName}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat / Ticket details */}
        <div className="lg:col-span-2 glass rounded-2xl border border-white/5 p-5 flex flex-col justify-between h-[500px]">
          {selectedTicket ? (
            <>
              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <div>
                  <h3 className="font-bold text-sm text-white/90">{selectedTicket.subject}</h3>
                  <span className="text-[10px] text-white/40">Open with {selectedTicket.userName}</span>
                </div>
                {selectedTicket.status !== 'closed' && (
                  <button
                    onClick={handleCloseTicket}
                    className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition text-[10px] font-semibold flex items-center gap-1"
                  >
                    <FiCheckSquare /> Close Ticket
                  </button>
                )}
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1 text-xs">
                {selectedTicket.messages?.map((msg, idx) => {
                  const isUserSender = msg.senderId === user._id || msg.isAdmin
                  return (
                    <div key={idx} className={`flex ${isUserSender ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] p-3 rounded-xl border ${
                        isUserSender 
                          ? 'bg-brand/10 border-brand/20 text-white/90 rounded-tr-none' 
                          : 'bg-white/5 border-white/5 text-white/80 rounded-tl-none'
                      }`}>
                        <div className="text-[9px] text-white/30 mb-0.5 flex justify-between gap-4">
                          <span>{msg.senderName}</span>
                          <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                        </div>
                        <p className="leading-relaxed font-medium">{msg.message}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Chat Input */}
              {selectedTicket.status !== 'closed' ? (
                <form onSubmit={handleReply} className="flex gap-2 pt-3 border-t border-white/5">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your response to the user..."
                    className="input-field text-xs py-2 px-3 h-9 flex-1"
                  />
                  <button type="submit" className="p-2.5 bg-brand hover:bg-brand-light text-white rounded-xl transition">
                    <FiSend size={14} />
                  </button>
                </form>
              ) : (
                <div className="text-center py-2 border-t border-white/5 text-[10px] text-white/40 font-semibold uppercase tracking-wider">This support ticket is closed.</div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-white/30 text-xs gap-2">
              <FiAlertCircle size={24} className="text-brand/50" />
              <span>Select a support ticket from the sidebar to inspect conversation timeline.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
