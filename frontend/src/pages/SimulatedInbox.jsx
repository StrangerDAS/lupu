import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMail, FiTrash2, FiChevronLeft, FiExternalLink } from 'react-icons/fi'
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import PageWrapper from '../components/PageWrapper'
import useAuthStore from '../store/authStore'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function SimulatedInbox() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const { user } = useAuthStore()

  useEffect(() => {
    // We listen to all emails for admin, or just the user's emails
    // But since it's a simulated inbox for testing, let's just fetch all emails
    // Or filter by user.email if we want it isolated. Let's filter by user.email to match reality.
    
    if (!user?.email) return
    
    // For localhost testing flexibility, if they are admin, they see all. Otherwise, they see theirs.
    const isGlobal = user?.roles?.includes('admin')
    
    let q = query(collection(db, 'emails'), orderBy('createdAt', 'desc'))
    
    const unsub = onSnapshot(q, (snap) => {
      const allEmails = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
      // Filter clientside if needed
      if (!isGlobal) {
        setEmails(allEmails.filter(e => e.to === user.email || e.to?.includes(user.email)))
      } else {
        setEmails(allEmails)
      }
      setLoading(false)
    })
    
    return () => unsub()
  }, [user])

  const handleClearInbox = async () => {
    if (!confirm('Are you sure you want to delete all emails in this inbox?')) return
    const toastId = toast.loading('Clearing inbox...')
    try {
      const promises = emails.map(e => deleteDoc(doc(db, 'emails', e._id)))
      await Promise.all(promises)
      toast.success('Inbox cleared', { id: toastId })
      setSelectedEmail(null)
    } catch (err) {
      toast.error('Failed to clear inbox', { id: toastId })
    }
  }

  const formatDate = (ts) => {
    if (!ts) return 'Just now'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const formatTime = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <PageWrapper>
      <div className="container-main py-6 md:py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FiMail className="text-brand" /> Simulated Inbox
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Localhost testing sandbox. Viewing emails sent to <strong>{user?.roles?.includes('admin') ? 'All Users (Admin View)' : user?.email}</strong>.
            </p>
          </div>
          {emails.length > 0 && (
            <button
              onClick={handleClearInbox}
              className="btn-secondary text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10 flex items-center gap-2 text-sm"
            >
              <FiTrash2 /> Clear Inbox
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-6 h-[70vh] max-h-[800px]">
          {/* List View */}
          <div className={`md:w-1/3 flex flex-col glass rounded-2xl border border-white/5 overflow-hidden ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
              <h3 className="font-semibold text-sm">Recent Emails</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="p-4 text-center text-white/30 text-sm">Loading inbox...</div>
              ) : emails.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center justify-center h-full opacity-50">
                  <FiMail size={40} className="mb-3" />
                  <p className="text-sm">Inbox is empty</p>
                </div>
              ) : (
                emails.map(e => (
                  <button
                    key={e._id}
                    onClick={() => setSelectedEmail(e)}
                    className={`w-full text-left p-4 rounded-xl transition ${
                      selectedEmail?._id === e._id ? 'bg-brand/20 border border-brand/30' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm truncate pr-2">{e.subject}</span>
                      <span className="text-[10px] text-white/40 shrink-0">{formatDate(e.createdAt)}</span>
                    </div>
                    <div className="text-xs text-white/50 truncate">To: {e.to}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Detail View */}
          <div className={`md:w-2/3 glass rounded-2xl border border-white/5 flex flex-col overflow-hidden ${!selectedEmail ? 'hidden md:flex' : 'flex'}`}>
            {!selectedEmail ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 p-10 text-center">
                <FiMail size={48} className="mb-4 opacity-50" />
                <p>Select an email to read</p>
              </div>
            ) : (
              <>
                {/* Email Header */}
                <div className="p-5 border-b border-white/5 bg-white/[0.02] relative">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="md:hidden absolute top-5 left-4 p-2 -ml-2 text-white/50 hover:text-white"
                  >
                    <FiChevronLeft size={20} />
                  </button>
                  <div className="md:ml-0 ml-8">
                    <h2 className="text-lg font-bold mb-3">{selectedEmail.subject}</h2>
                    <div className="flex justify-between items-end">
                      <div className="text-xs space-y-1 text-white/60">
                        <p><span className="text-white/40">From:</span> notifications@lupu.in (System)</p>
                        <p><span className="text-white/40">To:</span> <span className="font-semibold text-white/80">{selectedEmail.to}</span></p>
                      </div>
                      <div className="text-[10px] text-white/40 text-right">
                        {formatDate(selectedEmail.createdAt)}<br/>
                        {formatTime(selectedEmail.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Email Body */}
                <div className="flex-1 p-6 overflow-y-auto bg-black/40">
                  <div 
                    className="prose prose-invert prose-sm max-w-none text-white/80"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.content }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
