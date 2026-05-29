import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  FiShield, FiAlertTriangle, FiBookOpen, FiUserCheck,
  FiFileText, FiLock, FiCornerUpLeft, FiAlertOctagon, FiCheckSquare, FiArrowRight
} from 'react-icons/fi'
import PageWrapper from '../components/PageWrapper'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
}

const gatewayDocuments = [
  {
    title: 'Terms of Service',
    icon: FiFileText,
    to: '/terms',
    color: 'text-brand border-brand/20 bg-brand/5',
    description: 'The operating rules and legal agreements governing the use of LUPU.',
    highlights: [
      'Eligibility & Account Registration rules',
      'Identity & Vehicle Verification requirements',
      'Detailed Owner & Renter responsibilities',
      'Cancellation, refunds, and security deposits',
      'Damage, accident procedures, and traffic fines'
    ]
  },
  {
    title: 'Privacy Policy',
    icon: FiLock,
    to: '/privacy',
    color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    description: 'How we collect, verify, use, protect, and retain your personal data.',
    highlights: [
      'Personal & Account detail collection',
      'KYC documents storage (Aadhaar, Licence, RC)',
      'Device location tracking rules & permissions',
      'Secure hosting & data sharing protocols',
      'Your privacy rights and account deletion options'
    ]
  }
]

const quickSummaries = [
  {
    title: 'Identity Verification',
    icon: FiUserCheck,
    emoji: '🪪',
    description: 'Renters must physically present original Aadhaar and Driving Licence at handover.',
    to: '/terms#identity-rules'
  },
  {
    title: 'Vehicle Verification',
    icon: FiCheckSquare,
    emoji: '🔍',
    description: 'Owners must register valid RC, active insurance, and PUC certificate before listing.',
    to: '/terms#vehicle-requirements'
  },
  {
    title: 'Cancellation & Refunds',
    icon: FiCornerUpLeft,
    emoji: '💰',
    description: 'Owner cancellations refund 100%. Renter cancellations follow structured timing gates.',
    to: '/terms#cancellation-rules'
  },
  {
    title: 'Damage & Accidents',
    icon: FiAlertOctagon,
    emoji: '💥',
    description: 'Renters are financially liable for damage. Digital handover photos serve as evidence.',
    to: '/terms#damage-procedures'
  }
]

export default function LegalCenter() {
  return (
    <PageWrapper>
      <div className="container-main py-10 md:py-16 max-w-4xl">
        {/* Page Title */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand mx-auto mb-4 shadow-lg shadow-brand/10"
          >
            <FiShield size={28} />
          </motion.div>
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-2xl md:text-3xl font-extrabold"
          >
            LUPU Legal &amp; Safety Hub
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="text-white/40 text-sm max-w-lg mx-auto mt-2 leading-relaxed"
          >
            Welcome to LUPU's simplified legal center. Below, you will find direct links and summaries to help you quickly understand your rights, responsibilities, and safety rules.
          </motion.p>
        </div>

        {/* Highlighted Notice */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="card p-5 border border-brand/30 bg-brand/5 mb-10 flex gap-3.5 items-start animate-pulse-subtle"
        >
          <FiAlertTriangle className="text-brand shrink-0 mt-0.5" size={20} />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand">Important Policy Notice</h4>
            <p className="text-xs text-white/70 leading-relaxed">
              These pages provide simplified explanations of our policies. All rentals are governed by the legally binding agreements signed by vehicle owners and renters during the booking process. In case of any conflict, the signed agreement takes precedence.
            </p>
          </div>
        </motion.div>

        {/* Two Main Document Gateways */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {gatewayDocuments.map((doc, idx) => {
            const Icon = doc.icon
            return (
              <motion.div
                key={doc.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + idx * 0.1 }}
                className={`card p-6 border ${doc.color} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 text-white">
                      <Icon size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-white">{doc.title}</h3>
                  </div>
                  <p className="text-xs text-white/60 mb-5 leading-relaxed">{doc.description}</p>
                  
                  <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Key Sections Include:</h4>
                  <ul className="space-y-2 mb-6">
                    {doc.highlights.map((highlight, index) => (
                      <li key={index} className="flex items-center gap-2 text-xs text-white/70">
                        <div className="w-1 h-1 rounded-full bg-brand shrink-0" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={doc.to}
                  className="w-full btn-primary py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 text-xs hover:shadow-[0_0_15px_rgba(255,107,0,0.1)] transition-all"
                >
                  View Full {doc.title} <FiArrowRight size={14} />
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Quick Summaries Heading */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest px-1">Quick Policy References</h3>
        </div>

        {/* Legal Grid of Quick Summaries */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {quickSummaries.map((summary) => {
            const Icon = summary.icon
            return (
              <motion.div
                key={summary.title}
                variants={cardVariants}
                className="card p-4 border border-white/5 bg-surface-1 hover:border-brand/20 transition flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center border border-brand/20 text-brand">
                      <Icon size={16} />
                    </div>
                    <h4 className="font-bold text-xs text-white">{summary.emoji} {summary.title}</h4>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{summary.description}</p>
                </div>
                <Link
                  to={summary.to}
                  className="text-[10px] font-semibold text-brand hover:underline mt-3 flex items-center gap-1 w-fit"
                >
                  Read Policy Rules <FiArrowRight className="text-[9px]" />
                </Link>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Footer info links */}
        <div className="text-center mt-12 pt-6 border-t border-white/5">
          <p className="text-xs text-white/30 flex items-center justify-center gap-2">
            <FiBookOpen /> Looking for support? Visit our <a href="/#contact" className="text-brand hover:underline">Contact Center</a> or email <a href="mailto:support@lupu.in" className="text-brand hover:underline">support@lupu.in</a>.
          </p>
        </div>
      </div>
    </PageWrapper>
  )
}
