import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiChevronDown, FiSearch, FiKey, FiShield, FiDollarSign, FiCamera, FiCheckCircle } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import PageWrapper from '../components/PageWrapper'

const RENTER_STEPS = [
  { icon: FiSearch, title: 'Find a Ride', desc: 'Browse nearby bikes, scooters, and accessories.' },
  { icon: FiCheckCircle, title: 'Book Instantly', desc: 'Choose your dates and confirm your booking securely.' },
  { icon: FiKey, title: 'Pick Up & Ride', desc: 'Meet the owner, verify condition, and hit the road.' },
]

const OWNER_STEPS = [
  { icon: FiCamera, title: 'List Your Ride', desc: 'Upload photos, set pricing, and list your unused vehicle.' },
  { icon: FiShield, title: 'Accept Bookings', desc: 'Review renter profiles and accept booking requests.' },
  { icon: FiDollarSign, title: 'Earn Money', desc: 'Get paid securely while your vehicle is rented.' },
]

const FAQS = [
  { q: 'How do I rent a bike?', a: 'Sign up, verify your profile, browse available vehicles near you, and book them for your desired dates. Payment and deposits are handled securely through the platform.' },
  { q: 'Can I list accessories only?', a: 'Yes! You can list helmets, riding jackets, gloves, and other accessories independently or alongside a vehicle.' },
  { q: 'Is verification mandatory?', a: 'Yes, for the safety of our community, all users must complete profile and identity verification before booking or listing a vehicle.' },
  { q: 'How do payments work?', a: 'Payments are processed digitally. Owners receive their earnings after a successful trip completion, minus a small platform fee.' },
  { q: 'What happens if a vehicle is damaged?', a: 'Our Trust & Safety system includes photo/video proof requirements before and after trips to resolve disputes fairly.' },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-white/10 rounded-2xl bg-white/5 overflow-hidden">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full text-left p-5 flex justify-between items-center hover:bg-white/5 transition-colors focus:outline-none"
      >
        <span className="font-semibold text-white/90">{q}</span>
        <FiChevronDown className={`text-brand transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-5 text-white/60 leading-relaxed"
          >
            {a}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function HowItWorks() {
  return (
    <PageWrapper>
      <div className="pt-20 pb-24 overflow-hidden relative">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-brand/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="container-main relative z-10">
          
          {/* Intro Hero */}
          <div className="text-center max-w-3xl mx-auto mb-20 mt-10">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-xl"
            >
              How <span className="text-brand">LUPU</span> Works
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-lg md:text-xl text-white/60"
            >
              LUPU connects vehicle owners with riders in a fast, secure, and affordable way. Whether you need a ride or want to earn money, we've got you covered.
            </motion.p>
          </div>

          {/* For Renters */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="mb-24"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">For Renters</h2>
              <p className="text-white/50">Hit the road in three simple steps.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {RENTER_STEPS.map((step, i) => (
                <div key={i} className="card p-8 bg-gradient-to-b from-[#1A1A1A] to-[#111] border border-white/5 hover:border-brand/30 transition-colors group">
                  <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-6 group-hover:bg-brand/20 transition-colors">
                    <step.icon className="w-6 h-6 text-brand" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-white/50">{step.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center flex flex-col items-center gap-3 text-sm text-white/40">
              <p>Affordable pricing • Flexible rentals • Local accessories</p>
              <Link to="/explore" className="btn-primary px-8 py-3 mt-4">Find a Ride</Link>
            </div>
          </motion.section>

          {/* For Owners */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="mb-24 relative"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-full bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
            
            <div className="text-center mb-12 relative z-10">
              <h2 className="text-3xl font-bold mb-3">For Owners</h2>
              <p className="text-white/50">Turn your idle vehicle into passive income.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {OWNER_STEPS.map((step, i) => (
                <div key={i} className="card p-8 bg-gradient-to-b from-[#1A1A1A] to-[#111] border border-white/5 hover:border-purple-500/30 transition-colors group">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                    <step.icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-white/50">{step.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center flex flex-col items-center gap-3 text-sm text-white/40 relative z-10">
              <p>Passive income • Flexible pricing • Verified renters</p>
              <Link to="/owner/setup" className="btn-secondary bg-white text-black hover:bg-gray-200 px-8 py-3 mt-4">List Your Vehicle</Link>
            </div>
          </motion.section>

          {/* Trust & Safety */}
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            className="mb-24"
          >
            <div className="card p-10 md:p-14 bg-gradient-to-br from-brand/10 via-[#111] to-[#111] border border-brand/20 text-center md:text-left flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                  <FiShield className="w-8 h-8 text-brand" />
                  <h2 className="text-3xl font-bold">Trust & Safety</h2>
                </div>
                <p className="text-white/60 mb-6 text-lg leading-relaxed">
                  We've built a robust ecosystem to ensure every ride is secure. With comprehensive identity checks and digital rental agreements, peace of mind is guaranteed.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-white/70">
                  <li className="flex items-center gap-2"><FiCheckCircle className="text-brand" /> Profile & Identity Verification</li>
                  <li className="flex items-center gap-2"><FiCheckCircle className="text-brand" /> Future Aadhaar Integration</li>
                  <li className="flex items-center gap-2"><FiCheckCircle className="text-brand" /> Safe Booking System</li>
                  <li className="flex items-center gap-2"><FiCheckCircle className="text-brand" /> Photo/Video Pre-trip Proof</li>
                </ul>
              </div>
              <div className="shrink-0">
                <div className="w-40 h-40 rounded-full bg-brand/5 border border-brand/20 flex items-center justify-center shadow-[0_0_50px_rgba(255,107,0,0.2)]">
                  <RiMotorbikeLine className="w-20 h-20 text-brand opacity-80" />
                </div>
              </div>
            </div>
          </motion.section>

          {/* FAQ */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-3">Frequently Asked Questions</h2>
              <p className="text-white/50">Got questions? We've got answers.</p>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-3">
              {FAQS.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </motion.section>

        </div>
      </div>
    </PageWrapper>
  )
}
