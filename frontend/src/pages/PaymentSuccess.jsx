import { useLocation, useNavigate, Link } from 'react-router-dom'
import { FiCheckCircle, FiChevronRight } from 'react-icons/fi'
import PageWrapper from '../components/PageWrapper'

export default function PaymentSuccess() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state

  if (!state) {
    return (
      <PageWrapper>
        <div className="container-main py-10 max-w-xl text-center">
          <p className="text-white/40">No payment details found.</p>
          <Link to="/" className="btn-secondary mt-4 inline-block">Go Home</Link>
        </div>
      </PageWrapper>
    )
  }

  const { bookingId, vehicleName, amount, transactionId } = state

  return (
    <PageWrapper>
      <div className="container-main py-10 max-w-xl text-center">
        <div className="card p-8 bg-green-500/10 border border-green-500/20">
          <FiCheckCircle className="text-green-400 text-6xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">🎉 Payment Successful!</h1>
          <p className="text-white/70 mb-8">Enjoy your ride.</p>
          
          <div className="text-left bg-surface-2 rounded-xl p-6 space-y-4">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40">Booking ID</span>
              <span className="font-semibold text-white">{bookingId}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40">Vehicle Name</span>
              <span className="font-semibold text-white">{vehicleName}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40">Amount Paid</span>
              <span className="font-semibold text-brand">₹{amount}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-white/40">Transaction ID</span>
              <span className="font-mono text-sm text-white/80">{transactionId}</span>
            </div>
          </div>
          
          <div className="mt-8">
            <button 
              onClick={() => navigate('/my-bookings')} 
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              View My Bookings <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
