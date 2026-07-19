import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheck, FiAlertTriangle, FiInfo, FiFileText } from 'react-icons/fi'

export default function BookingAgreementModal({ isOpen, onClose, onAccept }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false)
  const [checks, setChecks] = useState({
    read: false,
    binding: false,
    evidence: false,
    failure: false,
    responsibilities: false
  })
  
  const contentRef = useRef(null)

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setScrolledToBottom(false)
      setChecks({
        read: false,
        binding: false,
        evidence: false,
        failure: false,
        responsibilities: false
      })
    }
  }, [isOpen])

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current
      if (Math.abs(scrollHeight - clientHeight - scrollTop) < 5) {
        setScrolledToBottom(true)
      }
    }
  }

  const allChecked = Object.values(checks).every(Boolean)
  const canAccept = scrolledToBottom && allChecked

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-3xl bg-surface-0 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 bg-surface-1 shrink-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <FiFileText className="text-brand" />
              LUPU Beta Rental Agreement
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Please read this agreement carefully before confirming your booking. By accepting this agreement, you enter into a legally binding contract with LUPU.
            </p>
          </div>

          {/* Scrollable Content */}
          <div 
            ref={contentRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 custom-scrollbar bg-surface-0"
          >
            {/* Section 1 */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 1: Legal Acceptance</h3>
              <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                <p>By clicking "I Agree & Continue", you confirm that:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>You have read this agreement.</li>
                  <li>You understand this agreement.</li>
                  <li>You voluntarily agree to all obligations.</li>
                  <li>Your electronic acceptance is legally binding.</li>
                  <li>False claims or fraudulent activity may result in account suspension, financial liability, and legal action where applicable.</li>
                </ul>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-3 bg-red-500/5 border border-red-500/20 p-5 rounded-xl">
              <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                <FiAlertTriangle /> Section 2: Mandatory Vehicle Inspection & Evidence Policy
              </h3>
              <div className="text-sm text-white/80 space-y-3 leading-relaxed">
                <p className="font-bold text-white">Before EVERY vehicle pickup and BEFORE EVERY vehicle return, BOTH the Vehicle Owner and the Renter MUST INDEPENDENTLY capture and upload evidence.</p>
                <p className="font-semibold text-red-300">This requirement is COMPULSORY. It is NOT optional.</p>
                <p>The following evidence is mandatory:</p>
                <ul className="list-disc pl-5 space-y-1 text-white/70 grid grid-cols-2">
                  <li className="col-span-2">Continuous unedited video of the complete vehicle</li>
                  <li>Front & Rear</li>
                  <li>Left side & Right side</li>
                  <li>Interior & Dashboard</li>
                  <li>Odometer & Fuel level</li>
                  <li>Registration plate & Tyres</li>
                  <li>Existing scratches/dents/damage</li>
                  <li>Helmet(s) & Keys</li>
                  <li>RC (if handed over) & Accessories</li>
                </ul>
                <p className="mt-2 text-white/70">The evidence must be captured at the pickup location and at the return location. Whenever supported by the device, media should include GPS Location, Date, and Time.</p>
                <p className="font-bold text-red-300 mt-2">Failure to upload this evidence may result in:</p>
                <ul className="list-disc pl-5 space-y-1 text-white/70">
                  <li>Rejection of damage claims</li>
                  <li>Rejection of compensation requests</li>
                  <li>Loss of dispute protection</li>
                </ul>
                <p className="italic">LUPU reserves the right to resolve disputes solely on the basis of the evidence available.</p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 3: Renter Declaration</h3>
              <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                <p>The renter confirms they have personally inspected:</p>
                <ul className="list-disc pl-5 space-y-1 grid grid-cols-2">
                  <li>Vehicle condition</li>
                  <li>Fuel level</li>
                  <li>Odometer</li>
                  <li>Tyres & Mirrors</li>
                  <li>Lights & Accessories</li>
                  <li>Existing damage</li>
                </ul>
                <p className="mt-2 font-medium text-white/90">Once the renter accepts the vehicle, they acknowledge that the vehicle has been received in satisfactory condition except for defects already documented before pickup.</p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 4: Vehicle Return</h3>
              <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                <p>The renter agrees to return the vehicle:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>In substantially the same condition</li>
                  <li>On time</li>
                  <li>With all accessories</li>
                  <li>With the agreed fuel level</li>
                </ul>
                <p className="mt-2 font-medium text-white/90">If damage occurs during the rental, the renter agrees to pay: Repair costs, Replacement costs, Cleaning charges, and Other verified charges supported by evidence.</p>
              </div>
            </section>

            {/* Section 5 & 6 */}
            <div className="grid sm:grid-cols-2 gap-6">
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 5: Traffic Violations</h3>
                <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                  <p>The renter accepts responsibility for: Traffic challans, Parking fines, Toll charges, FASTag deductions, and E-Challans incurred during the rental period.</p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 6: Fraud</h3>
                <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                  <p>Users shall not: Upload fake documents, Edit photographs or videos, Submit false complaints, Tamper with evidence, or Submit fraudulent claims.</p>
                  <p>Violation may result in: Permanent suspension, Cancellation of bookings, Recovery of losses, and Reporting to authorities.</p>
                </div>
              </section>
            </div>

            {/* Section 7 */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 7: LUPU's Role</h3>
              <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                <p>State clearly: LUPU is only a technology marketplace connecting vehicle owners and renters. LUPU does not own privately listed vehicles.</p>
                <p>LUPU may assist in dispute resolution but is not responsible for the physical condition, quality, legality, or safety of privately owned vehicles.</p>
              </div>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-brand">Section 8: Digital Contract</h3>
              <div className="text-sm text-white/70 space-y-2 leading-relaxed">
                <p className="font-bold text-white">By clicking "I Agree & Continue", the user electronically signs this Rental Agreement.</p>
                <p>This electronic acceptance creates a legally binding contract with LUPU and carries the same legal effect as a handwritten signature to the extent permitted under applicable Indian law.</p>
              </div>
            </section>
          </div>

          {/* Checkboxes (Fixed Bottom Area) */}
          <div className="p-5 border-t border-white/10 bg-surface-1 shrink-0 space-y-3 max-h-[35vh] overflow-y-auto custom-scrollbar">
            <h4 className="text-xs font-bold text-white/50 uppercase mb-2">Mandatory Acknowledgements</h4>
            
            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition ${checks.read ? 'bg-brand/10 border-brand/30' : 'bg-surface-2 border-white/5 hover:border-white/20'}`}>
              <input type="checkbox" checked={checks.read} onChange={(e) => setChecks({...checks, read: e.target.checked})} className="mt-0.5 w-4 h-4 accent-brand shrink-0" />
              <span className="text-xs text-white/80 leading-relaxed">I have carefully read and understood this Rental Agreement.</span>
            </label>

            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition ${checks.binding ? 'bg-brand/10 border-brand/30' : 'bg-surface-2 border-white/5 hover:border-white/20'}`}>
              <input type="checkbox" checked={checks.binding} onChange={(e) => setChecks({...checks, binding: e.target.checked})} className="mt-0.5 w-4 h-4 accent-brand shrink-0" />
              <span className="text-xs text-white/80 leading-relaxed">I understand that this agreement is legally binding and creates a digital contract with LUPU.</span>
            </label>

            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition ${checks.evidence ? 'bg-brand/10 border-brand/30' : 'bg-surface-2 border-white/5 hover:border-white/20'}`}>
              <input type="checkbox" checked={checks.evidence} onChange={(e) => setChecks({...checks, evidence: e.target.checked})} className="mt-0.5 w-4 h-4 accent-brand shrink-0" />
              <span className="text-xs text-white/80 leading-relaxed">I agree that both the Vehicle Owner and the Renter MUST capture mandatory photographs and one continuous video before pickup and after return.</span>
            </label>

            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition ${checks.failure ? 'bg-brand/10 border-brand/30' : 'bg-surface-2 border-white/5 hover:border-white/20'}`}>
              <input type="checkbox" checked={checks.failure} onChange={(e) => setChecks({...checks, failure: e.target.checked})} className="mt-0.5 w-4 h-4 accent-brand shrink-0" />
              <span className="text-xs text-white/80 leading-relaxed">I understand that failure to upload mandatory evidence may result in rejection of my claims or loss of dispute protection.</span>
            </label>

            <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition ${checks.responsibilities ? 'bg-brand/10 border-brand/30' : 'bg-surface-2 border-white/5 hover:border-white/20'}`}>
              <input type="checkbox" checked={checks.responsibilities} onChange={(e) => setChecks({...checks, responsibilities: e.target.checked})} className="mt-0.5 w-4 h-4 accent-brand shrink-0" />
              <span className="text-xs text-white/80 leading-relaxed">I understand and accept my responsibilities regarding vehicle inspection, damages, traffic violations, fraud, and vehicle return.</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="p-5 border-t border-white/10 bg-surface-2 shrink-0 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={onClose}
              className="btn-secondary w-full sm:w-1/3 py-3 font-semibold"
            >
              Cancel Booking
            </button>
            <div className="w-full sm:w-2/3 relative group">
              <button
                onClick={onAccept}
                disabled={!canAccept}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <FiCheck /> I Agree & Continue
              </button>
              {!scrolledToBottom && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                  Please scroll to the bottom of the agreement first
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
