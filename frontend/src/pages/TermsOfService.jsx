import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import {
  FiFileText, FiUser, FiCheckCircle, FiShield, FiSliders,
  FiBookOpen, FiAlertTriangle, FiAlertOctagon, FiDatabase, FiHelpCircle
} from 'react-icons/fi'
import PageWrapper from '../components/PageWrapper'

const sections = [
  { id: 'definitions', label: '1. Definitions', icon: FiFileText },
  { id: 'eligibility', label: '2. Eligibility Requirements', icon: FiUser },
  { id: 'registration', label: '3. Account Registration', icon: FiUser },
  { id: 'identity-rules', label: '4. Identity Verification Rules', icon: FiShield },
  { id: 'vehicle-requirements', label: '5. Vehicle Verification Requirements', icon: FiCheckCircle },
  { id: 'owner-responsibilities', label: '6. Owner Responsibilities', icon: FiSliders },
  { id: 'renter-responsibilities', label: '7. Renter Responsibilities', icon: FiSliders },
  { id: 'booking-process', label: '8. Booking & Rental Process', icon: FiCheckCircle },
  { id: 'payment-terms', label: '9. Payment Terms', icon: FiBookOpen },
  { id: 'security-deposits', label: '10. Security Deposits', icon: FiBookOpen },
  { id: 'cancellation-rules', label: '11. Cancellation & Refund Rules', icon: FiAlertTriangle },
  { id: 'usage-rules', label: '12. Vehicle Usage Rules', icon: FiSliders },
  { id: 'safety-standards', label: '13. Safety Standards', icon: FiShield },
  { id: 'community-guidelines', label: '14. Community Guidelines', icon: FiBookOpen },
  { id: 'damage-procedures', label: '15. Damage & Accident Procedures', icon: FiAlertOctagon },
  { id: 'traffic-fines', label: '16. Traffic Fines & Violations', icon: FiAlertTriangle },
  { id: 'insurance-responsibilities', label: '17. Insurance Responsibilities', icon: FiShield },
  { id: 'fraud-prevention', label: '18. Fraud Prevention', icon: FiShield },
  { id: 'prohibited-activities', label: '19. Prohibited Activities', icon: FiAlertTriangle },
  { id: 'suspension-termination', label: '20. Account Suspension & Termination', icon: FiAlertOctagon },
  { id: 'dispute-resolution', label: '21. Dispute Resolution', icon: FiHelpCircle },
  { id: 'limitation-liability', label: '22. Limitation of Liability', icon: FiAlertOctagon },
  { id: 'governing-law', label: '23. Governing Law & Jurisdiction', icon: FiFileText }
]

export default function TermsOfService() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.substring(1)
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      window.scrollTo(0, 0)
    }
  }, [location])

  const handleNavClick = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      window.history.pushState(null, '', `#${id}`)
    }
  }

  return (
    <PageWrapper>
      <div className="container-main py-10 md:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand mx-auto mb-4 shadow-lg shadow-brand/10"
          >
            <FiFileText size={28} />
          </motion.div>
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-2xl md:text-3xl font-extrabold"
          >
            Terms of Service
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="text-white/40 text-xs mt-2"
          >
            Last Updated: May 29, 2026 • LUPU Platform
          </motion.p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 max-h-[calc(100vh-120px)] overflow-y-auto card p-4 border border-white/5 bg-surface-1 hidden lg:block custom-scrollbar">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4 px-2">Sections</h3>
            <nav className="space-y-1">
              {sections.map((sec) => {
                const Icon = sec.icon
                return (
                  <button
                    key={sec.id}
                    onClick={() => handleNavClick(sec.id)}
                    className="w-full text-left text-xs text-white/60 hover:text-brand hover:bg-white/5 px-2.5 py-2 rounded-lg transition flex items-center gap-2 group"
                  >
                    <Icon className="text-white/30 group-hover:text-brand transition shrink-0" size={14} />
                    <span className="truncate">{sec.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <article className="flex-1 card p-6 md:p-8 border border-white/5 bg-surface-1 space-y-10 leading-relaxed text-sm text-white/70">
            
            {/* 1. Definitions */}
            <section id="definitions" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">1.</span> Definitions
              </h2>
              <p>
                In these Terms of Service:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li><strong>"Platform"</strong> refers to the LUPU vehicle-sharing website, app, and associated systems.</li>
                <li><strong>"Renter"</strong> refers to a registered user who requests and rents a vehicle through the Platform.</li>
                <li><strong>"Owner"</strong> refers to a registered user who lists a vehicle for rental bookings through the Platform.</li>
                <li><strong>"Booking"</strong> refers to a scheduled rental transaction initiated by a Renter and approved by an Owner on LUPU.</li>
                <li><strong>"Rental Agreement"</strong> refers to the legally binding contract signed by the Owner and Renter during the physical vehicle handover process.</li>
              </ul>
            </section>

            {/* 2. Eligibility Requirements */}
            <section id="eligibility" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">2.</span> Eligibility Requirements
              </h2>
              <p>
                To be eligible to use LUPU, you must:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Be at least 18 years of age.</li>
                <li>Hold a valid driving licence issued by appropriate licensing authorities in India permitting operation of the category of vehicle rented.</li>
                <li>Possess a clean record, with no major traffic violations or criminal records related to driving offenses.</li>
              </ul>
            </section>

            {/* 3. Account Registration */}
            <section id="registration" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">3.</span> Account Registration
              </h2>
              <p>
                You must register an account with LUPU to list or book vehicles. You agree to provide accurate, current, and complete information during registration and keep your profile updated. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
              </p>
            </section>

            {/* 4. Identity Verification Rules */}
            <section id="identity-rules" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">4.</span> Identity Verification Rules
              </h2>
              <p>
                LUPU implements strict identity verification rules to protect the community. 
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>All Renters must submit a scan of their original Aadhaar Card and Driving Licence for online verification.</li>
                <li>During vehicle handover, Renters must physically present their original Aadhaar Card and Driving Licence to the Owner.</li>
                <li>Owners reserve the right to deny the rental and cancel the Booking immediately if document records do not match or appear suspicious.</li>
              </ul>
            </section>

            {/* 5. Vehicle Verification Requirements */}
            <section id="vehicle-requirements" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">5.</span> Vehicle Verification Requirements
              </h2>
              <p>
                Owners must submit valid documentation for verification before listing any vehicle:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Registration Certificate (RC) proving active legal registry of the vehicle in India.</li>
                <li>Valid third-party insurance certificate.</li>
                <li>Pollution Under Control (PUC) certificate.</li>
                <li>Photos showing clear registration numbers.</li>
              </ul>
            </section>

            {/* 6. Vehicle Owner Responsibilities */}
            <section id="owner-responsibilities" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">6.</span> Vehicle Owner Responsibilities
              </h2>
              <p>
                As a vehicle Owner on LUPU, you agree to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Provide a vehicle that is in clean, roadworthy condition, with functional brakes, lights, tyres, and engine.</li>
                <li>Provide safety gear (at least one clean helmet for the rider, plus secondary pillion helmet if requested).</li>
                <li>Declare accurate vehicle details, specifications, and availability on the Platform.</li>
                <li>Ensure all legal registrations, insurance premiums, and taxes are fully paid.</li>
              </ul>
            </section>

            {/* 7. Renter Responsibilities */}
            <section id="renter-responsibilities" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">7.</span> Renter Responsibilities
              </h2>
              <p>
                As a Renter on LUPU, you agree to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Operate the vehicle safely and wear helmet gear at all times.</li>
                <li>Possess a valid physical driving licence at handover and throughout the booking period.</li>
                <li>Verify vehicle conditions at handover and take photos as evidence before driving off.</li>
                <li>Return the vehicle to the Owner at the agreed location and time in the same general condition as picked up, subject to normal wear and tear.</li>
              </ul>
            </section>

            {/* 8. Booking and Rental Process */}
            <section id="booking-process" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">8.</span> Booking and Rental Process
              </h2>
              <p>
                The rental process follows a strict structure:
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-white/60">
                <li>Renter submits a Booking request specifying start time, duration, and details.</li>
                <li>Renter pays the partial advance amount (typically 25% of total cost).</li>
                <li>Owner approves the request to confirm the booking reservation.</li>
                <li>During handover, both parties execute the handover verification forms on LUPU, upload current state photos, and sign the digital Rental Agreement.</li>
                <li>After the ride, the Renter returns the vehicle, completes drop-off checks, and pays the remaining booking balance (75%).</li>
              </ol>
            </section>

            {/* 9. Payment Terms */}
            <section id="payment-terms" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">9.</span> Payment Terms
              </h2>
              <p>
                Renters agree to pay the rates displayed at booking. Payment is split: 25% advance to secure the booking, and 75% settled directly to the owner at drop-off or pickup as configured. Owners receive payouts minus LUPU platform facilitation commissions.
              </p>
            </section>

            {/* 10. Security Deposits */}
            <section id="security-deposits" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">10.</span> Security Deposits
              </h2>
              <p>
                Owners may request a security deposit for high-value vehicles, which must be clearly specified on the vehicle listing page. The security deposit is fully refundable at return, provided the vehicle is returned without damage, traffic violations, or fuel discrepancies.
              </p>
            </section>

            {/* 11. Cancellation and Refund Rules */}
            <section id="cancellation-rules" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">11.</span> Cancellation and Refund Rules
              </h2>
              <p>
                Our standardized cancellation and refund schedule is structured to protect both users:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li><strong>Owner Cancellation:</strong> If an Owner cancels a booking, the Renter receives a 100% refund of any advance paid.</li>
                <li><strong>Renter Cancellation (Early):</strong> If a Renter cancels more than 24 hours prior to the scheduled start time, they are eligible for a partial refund (typically up to 15% refund depending on timing).</li>
                <li><strong>Renter Cancellation (Late):</strong> If a Renter cancels within 24 hours of the start time or fails to show up, the booking advance is entirely non-refundable.</li>
              </ul>
            </section>

            {/* 12. Vehicle Usage Rules */}
            <section id="usage-rules" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">12.</span> Vehicle Usage Rules
              </h2>
              <p>
                Renters must strictly adhere to the following vehicle usage rules:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Do not exceed speed limits (standard speed cap is 60 km/h).</li>
                <li>Do not use the vehicle for commercial transportation of goods, racing, stunt riding, or off-road trial riding.</li>
                <li>Only the registered Renter who completed verification is authorized to ride the vehicle.</li>
                <li>Do not transport prohibited or illegal substances.</li>
              </ul>
            </section>

            {/* 13. Safety Standards */}
            <section id="safety-standards" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">13.</span> Safety Standards
              </h2>
              <p>
                Safety is LUPU's highest priority. Both parties must perform basic checks during handover, verifying brakes, tyre pressure, headlight functionality, and helmet integrity. If a vehicle is deemed unsafe during handover checkups, the Renter must refuse the ride and contact LUPU support.
              </p>
            </section>

            {/* 14. Community Guidelines */}
            <section id="community-guidelines" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">14.</span> Community Guidelines
              </h2>
              <p>
                All LUPU members must behave respectfully. Document forgeries, verbal harassment, vehicle abuse, safety rule violations, and listing false listings are strictly banned. Users who violate community guidelines will face immediate platform suspension.
              </p>
            </section>

            {/* 15. Damage and Accident Procedures */}
            <section id="damage-procedures" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">15.</span> Damage and Accident Procedures
              </h2>
              <p>
                In the event of an accident or physical vehicle damage during the rental period:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>The Renter must report the incident to the Owner and LUPU customer support immediately.</li>
                <li>Capture clear photos of the damage details on-site.</li>
                <li>If personal injury occurs, report to emergency authorities and file an First Information Report (FIR) if required.</li>
                <li>Renters are financially liable for repairs corresponding to damages incurred during their booking timeline, audited against before/after handover photos.</li>
              </ul>
            </section>

            {/* 16. Traffic Fines and Violations */}
            <section id="traffic-fines" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">16.</span> Traffic Fines and Violations
              </h2>
              <p>
                The Renter is fully responsible for all traffic violations, parking fines, and challans generated during the rental duration. If the Owner receives a fine notice related to the booking period, the Renter must reimburse the fine amount in full along with any platform processing fees.
              </p>
            </section>

            {/* 17. Insurance Responsibilities */}
            <section id="insurance-responsibilities" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">17.</span> Insurance Responsibilities
              </h2>
              <p>
                Owners must maintain active insurance policies. In case of accidents, the owner's active third-party vehicle insurance is accessed as per regulations, with the Renter remaining liable to pay for any deductible/excess charges and costs not covered by insurance.
              </p>
            </section>

            {/* 18. Fraud Prevention */}
            <section id="fraud-prevention" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">18.</span> Fraud Prevention
              </h2>
              <p>
                LUPU actively monitors listings and verification accounts to prevent fraud. Uploading fake documentation, dummy numbers, or listing vehicles that you do not own/hold power of attorney to rent is a violation of law and will be reported to security cyber divisions.
              </p>
            </section>

            {/* 19. Prohibited Activities */}
            <section id="prohibited-activities" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">19.</span> Prohibited Activities
              </h2>
              <p>
                Users are strictly prohibited from:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Sub-renting LUPU vehicles to external parties.</li>
                <li>Operating vehicles under the influence of alcohol, drugs, or medications that impair driving ability.</li>
                <li>Modifying or painting any parts of the vehicle.</li>
                <li>Using vehicles for illegal activities or crossing national borders.</li>
              </ul>
            </section>

            {/* 20. Account Suspension and Termination */}
            <section id="suspension-termination" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">20.</span> Account Suspension and Termination
              </h2>
              <p>
                We reserve the right to temporarily suspend or permanently terminate your LUPU account at our sole discretion, without notice, if we believe you have breached these Terms of Service, failed document audits, engaged in fraud, or posed safety risks to the community.
              </p>
            </section>

            {/* 21. Dispute Resolution */}
            <section id="dispute-resolution" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">21.</span> Dispute Resolution
              </h2>
              <p>
                In case of disputes between Owners and Renters, LUPU acts as an arbitrator by analyzing check-in/check-out documentation records. If a mutual settlement cannot be reached through our customer service team, the dispute shall be resolved through binding arbitration in Dibrugarh, Assam.
              </p>
            </section>

            {/* 22. Limitation of Liability */}
            <section id="limitation-liability" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">22.</span> Limitation of Liability
              </h2>
              <p>
                LUPU is a peer-to-peer facilitation platform. We are not responsible for the physical actions of users, vehicle breakdowns, personal injury, property damage, loss of life, or theft that occurs during bookings. You ride and share at your own risk.
              </p>
            </section>

            {/* 23. Governing Law and Jurisdiction */}
            <section id="governing-law" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">23.</span> Governing Law and Jurisdiction
              </h2>
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws of India. Any disputes arising out of these terms or platform usage shall be subject to the exclusive jurisdiction of the courts located in Dibrugarh, Assam, India.
              </p>
            </section>

          </article>
        </div>
      </div>
    </PageWrapper>
  )
}
