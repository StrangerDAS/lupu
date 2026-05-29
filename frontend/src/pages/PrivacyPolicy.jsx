import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { FiShield, FiLock, FiEye, FiUserCheck, FiSmartphone, FiDatabase, FiTrash2, FiMail } from 'react-icons/fi'
import PageWrapper from '../components/PageWrapper'

const sections = [
  { id: 'introduction', label: '1. Introduction', icon: FiShield },
  { id: 'info-collect', label: '2. Information We Collect', icon: FiEye },
  { id: 'personal-info', label: '3. Personal Information', icon: FiLock },
  { id: 'identity-verification', label: '4. Identity Verification Information', icon: FiUserCheck },
  { id: 'driving-licence', label: '5. Driving Licence Verification', icon: FiUserCheck },
  { id: 'vehicle-docs', label: '6. Vehicle Verification Documents', icon: FiDatabase },
  { id: 'payment-info', label: '7. Payment Information', icon: FiLock },
  { id: 'device-location', label: '8. Device and Location Information', icon: FiSmartphone },
  { id: 'how-use', label: '9. How We Use Information', icon: FiShield },
  { id: 'data-sharing', label: '10. Data Sharing', icon: FiEye },
  { id: 'data-security', label: '11. Data Security', icon: FiLock },
  { id: 'data-retention', label: '12. Data Retention', icon: FiDatabase },
  { id: 'user-rights', label: '13. User Rights', icon: FiShield },
  { id: 'account-deletion', label: '14. Account Deletion', icon: FiTrash2 },
  { id: 'contact-info', label: '15. Contact Information', icon: FiMail }
]

export default function PrivacyPolicy() {
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
            <FiLock size={28} />
          </motion.div>
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-2xl md:text-3xl font-extrabold"
          >
            Privacy Policy
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
            
            {/* 1. Introduction */}
            <section id="introduction" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">1.</span> Introduction
              </h2>
              <p>
                Welcome to LUPU (referred to as "we", "us", "our", or "LUPU"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, disclose, and protect your information when you use our peer-to-peer vehicle sharing website and mobile services.
              </p>
              <p>
                By using LUPU in India, you consent to the data practices described in this Privacy Policy. If you do not agree with any terms of this policy, please discontinue the use of our services immediately.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section id="info-collect" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">2.</span> Information We Collect
              </h2>
              <p>
                We collect information directly from you, automatically when you navigate through the LUPU platform, and from third-party partners. This collected information is essential for facilitating secure peer-to-peer sharing, verification procedures, and fraud prevention.
              </p>
            </section>

            {/* 3. Personal Information */}
            <section id="personal-info" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">3.</span> Personal Information
              </h2>
              <p>
                When you create an account, update your profile, or verify your identity, we collect personal details including:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Full Name</li>
                <li>Email Address</li>
                <li>Mobile Phone Number</li>
                <li>Profile Photo</li>
                <li>Emergency Contact details</li>
              </ul>
            </section>

            {/* 4. Identity Verification Information */}
            <section id="identity-verification" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">4.</span> Identity Verification Information
              </h2>
              <p>
                To maintain a safe trust community, we require renters and owners to verify their identity. We collect:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Government-issued identification numbers (e.g., Aadhaar Number)</li>
                <li>Scans or photos of Aadhaar cards</li>
                <li>Selfie photographs to run matching verification checks</li>
              </ul>
              <p className="text-xs text-white/50 bg-white/5 p-3 rounded-lg">
                <strong>Aadhaar Notice:</strong> Aadhaar numbers are collected and processed in accordance with local regulations in India, and are stored securely using private database systems.
              </p>
            </section>

            {/* 5. Driving Licence Verification */}
            <section id="driving-licence" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">5.</span> Driving Licence Verification
              </h2>
              <p>
                Before allowing any booking to be processed, renters must upload information regarding their active and valid driving licence:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Driving Licence Number</li>
                <li>Clear photographs of both front and back of the driving licence card</li>
                <li>Expiry date and authorized vehicle categories (e.g., Motorcycle with Gear)</li>
              </ul>
              <p>
                This information is audited to confirm validity under Indian Transport Department rules.
              </p>
            </section>

            {/* 6. Vehicle Verification Documents */}
            <section id="vehicle-docs" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">6.</span> Vehicle Verification Documents
              </h2>
              <p>
                For owners listing vehicles on LUPU, we collect verification documents to prove ownership and legal eligibility:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Registration Certificate (RC) number and copy</li>
                <li>Active Third-Party or Comprehensive Insurance policy document</li>
                <li>Pollution Under Control (PUC) certificate details</li>
                <li>Photos of the vehicle registration plate and physical vehicle state</li>
              </ul>
            </section>

            {/* 7. Payment Information */}
            <section id="payment-info" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">7.</span> Payment Information
              </h2>
              <p>
                All financial transactions on LUPU are processed securely. We collect:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Bank account numbers and IFSC details (for owner payouts)</li>
                <li>Transaction reference numbers and booking payment history</li>
              </ul>
              <p>
                We do not store full credit card numbers or security CVVs. All checkout processing is securely offloaded to certified Payment Gateway partners operating in India.
              </p>
            </section>

            {/* 8. Device and Location Information */}
            <section id="device-location" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">8.</span> Device and Location Information
              </h2>
              <p>
                We collect location data to help search for vehicles and log accurate vehicle pickup and drop-off records.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Approximate or precise GPS coordinates (with user permission via the mobile browser/app)</li>
                <li>IP Addresses, browser user-agent tokens, operating system details, and device identifiers</li>
              </ul>
            </section>

            {/* 9. How We Use Information */}
            <section id="how-use" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">9.</span> How We Use Information
              </h2>
              <p>
                LUPU uses collected information to perform the following core tasks:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Facilitate the rental booking and approval workflow between owners and renters.</li>
                <li>Conduct identity checks, RC lookups, and driver profile audits.</li>
                <li>Process refunds, advances, payouts, and collect security deposits.</li>
                <li>Generate and compile legally binding digital Rental Agreement PDFs.</li>
                <li>Provide customer support, resolve disputes, and trace safety anomalies.</li>
              </ul>
            </section>

            {/* 10. Data Sharing */}
            <section id="data-sharing" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">10.</span> Data Sharing
              </h2>
              <p>
                We do not sell your personal data. We share information only under these circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li><strong>Between Owner and Renter:</strong> To complete handovers, we display name, photo, phone number, and document verification status to your counterparty once a booking is confirmed.</li>
                <li><strong>Service Providers:</strong> Payment processors, KYC verification entities, and server hosting providers.</li>
                <li><strong>Legal Requirements:</strong> We may share data with police or court departments under appropriate warrant protocols or in case of serious accidents/vehicle theft investigation.</li>
              </ul>
            </section>

            {/* 11. Data Security */}
            <section id="data-security" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">11.</span> Data Security
              </h2>
              <p>
                We use industry-standard security measures, including SSL encryption, secure API endpoints, and controlled Firestore access rules, to ensure data is protected from unauthorized access, modification, or exposure. All verification document images are uploaded to private, secure cloud buckets with limited-duration signed link access.
              </p>
            </section>

            {/* 12. Data Retention */}
            <section id="data-retention" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">12.</span> Data Retention
              </h2>
              <p>
                We retain your personal information as long as your LUPU account remains active. If you close your account, we may retain certain records (like booking transactions, signed agreements, and identity hashes) for a period required to satisfy tax obligations, legal claims, dispute resolutions, and local law compliance.
              </p>
            </section>

            {/* 13. User Rights */}
            <section id="user-rights" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">13.</span> User Rights
              </h2>
              <p>
                You have the following rights regarding your personal data on LUPU:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-white/60">
                <li>Access and update your profile details and listings directly from the user dashboard.</li>
                <li>Request a copy of the personal information stored in our database.</li>
                <li>Revoke location permissions through your device or browser settings.</li>
              </ul>
            </section>

            {/* 14. Account Deletion */}
            <section id="account-deletion" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">14.</span> Account Deletion
              </h2>
              <p>
                You have the right to request deletion of your LUPU account and associated data. You can submit an account deletion request through your Profile settings.
              </p>
              <p>
                Upon verification, we will delete your personal identification profiles, uploaded document assets, and listings. Please note that active booking histories, unpaid dues, and signed legal agreements cannot be immediately deleted due to legal record obligations in India.
              </p>
            </section>

            {/* 15. Contact Information */}
            <section id="contact-info" className="scroll-mt-24 space-y-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
                <span className="text-brand">15.</span> Contact Information
              </h2>
              <p>
                If you have any questions or concerns regarding our Privacy Policy or data handling procedures, feel free to contact our Privacy Team:
              </p>
              <p className="text-white/60">
                <strong>Email:</strong> privacy@lupu.in<br />
                <strong>Address:</strong> LUPU Technologies, Chowkidingee, Dibrugarh, Assam, 786001, India.
              </p>
            </section>

          </article>
        </div>
      </div>
    </PageWrapper>
  )
}
