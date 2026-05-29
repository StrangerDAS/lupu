import { motion, AnimatePresence } from 'framer-motion'
import {
  FiX, FiSearch, FiCamera, FiShield, FiDollarSign,
  FiCheckCircle, FiNavigation, FiUser, FiAlertTriangle, FiBookOpen, FiFileText
} from 'react-icons/fi'

const modalContent = {
  explore: {
    title: 'Explore Vehicles',
    icon: FiSearch,
    description: 'Renting a ride has never been easier. Find the perfect vehicle for your needs around Dibrugarh.',
    points: [
      { text: 'Users can browse bikes, scooties, helmets, and accessories.', icon: FiSearch },
      { text: 'Compare prices to find the best deals.', icon: FiDollarSign },
      { text: 'Choose nearby rides for quick convenience.', icon: FiNavigation },
      { text: 'Book instantly and hit the road safely.', icon: FiCheckCircle },
    ]
  },
  list: {
    title: 'List Your Vehicle',
    icon: FiCamera,
    description: 'Turn your idle vehicle into a source of income. It is fast, secure, and fully controlled by you.',
    points: [
      { text: 'Owners can easily upload their vehicle details.', icon: FiCamera },
      { text: 'Add beautiful photos, set your pricing, and manage availability.', icon: FiDollarSign },
      { text: 'Earn money by securely renting it out to verified locals.', icon: FiCheckCircle },
      { text: 'Strict verification keeps the platform safe for everyone.', icon: FiShield },
    ]
  },
  howItWorks: {
    title: 'How It Works',
    icon: FiNavigation,
    description: 'A seamless process designed for both owners and renters.',
    points: [
      { text: '1. Owner lists vehicle securely on LUPU.', icon: FiCamera },
      { text: '2. LUPU verifies listing RC & insurance metadata.', icon: FiShield },
      { text: '3. Renter searches, books, and pays 25% advance.', icon: FiSearch },
      { text: '4. Both complete pickup handover photos & sign agreement.', icon: FiNavigation },
      { text: '5. Handover checklist automatically generates agreement PDF.', icon: FiFileText },
      { text: '6. Return ride, settle remaining 75%, and close booking.', icon: FiCheckCircle },
    ]
  },
  identityVerification: {
    title: 'Identity Verification',
    icon: FiShield,
    description: 'Privacy-safe protocols ensuring authenticity.',
    points: [
      { text: 'Renter must physically present original Aadhaar card at pickup.', icon: FiShield },
      { text: 'Owner verified online via RC verification checks.', icon: FiCheckCircle },
      { text: 'Optional original ID hold allowed only if mutually agreed.', icon: FiUser },
      { text: 'All legal documents are securely stored in private databases.', icon: FiShield }
    ]
  },
  vehicleVerification: {
    title: 'Vehicle Verification',
    icon: FiCheckCircle,
    description: 'Platform verification to maintain vehicle quality.',
    points: [
      { text: 'Manual admin audits of registration cards (RC) before approval.', icon: FiShield },
      { text: 'Mandatory active third-party vehicle insurance checks.', icon: FiDollarSign },
      { text: 'Detailed pre-handover photo captures for every rental.', icon: FiCamera },
      { text: 'Verification rules block list edits if safety checks fail.', icon: FiAlertTriangle }
    ]
  },
  ownerResponsibilities: {
    title: 'Owner Responsibilities',
    icon: FiUser,
    description: 'Standards for maintaining listings and safety.',
    points: [
      { text: 'Maintain brakes, lights, tyres, and helmet safety items.', icon: FiCheckCircle },
      { text: 'Provide accurate locations, pricing, and timing records.', icon: FiNavigation },
      { text: 'Capture accurate pre-handover damage and fuel photos.', icon: FiCamera },
      { text: 'Keep transport registrations and insurance updated.', icon: FiBookOpen }
    ]
  },
  renterResponsibilities: {
    title: 'Renter Responsibilities',
    icon: FiNavigation,
    description: 'Rider expectations during rental slots.',
    points: [
      { text: 'Hold valid Indian driving license (two-wheeler class).', icon: FiShield },
      { text: 'Always wear safety helmets (renter + pillion).', icon: FiCheckCircle },
      { text: 'Observe traffic laws, speed caps, and avoid stunts.', icon: FiNavigation },
      { text: 'Report accidents, damages, or challans immediately.', icon: FiAlertTriangle }
    ]
  },
  damagePolicy: {
    title: 'Damage & Accident Policy',
    icon: FiAlertTriangle,
    description: 'Transparent resolution for disputes and repairs.',
    points: [
      { text: 'Renters are financially liable for damage during bookings.', icon: FiDollarSign },
      { text: 'Compare handover vs return photos to settle disputes.', icon: FiCamera },
      { text: 'Agreement PDFs serve as digital legal evidence logs.', icon: FiBookOpen },
      { text: 'All traffic challans generated during booking must be paid.', icon: FiAlertTriangle }
    ]
  },
  cancellationPolicy: {
    title: 'Cancellation & Refund Policy',
    icon: FiDollarSign,
    description: 'Clear rules for cancellations and refunds.',
    points: [
      { text: 'Owner cancels booking: 100% refund of advance payment.', icon: FiCheckCircle },
      { text: 'Renter cancels 1+ days early (booked 2+ days early): 15% refund.', icon: FiDollarSign },
      { text: 'Renter cancels within 24 hours of start: non-refundable.', icon: FiX },
      { text: 'Refund processing completes in 3–5 working days.', icon: FiCheckCircle }
    ]
  },
  communityGuidelines: {
    title: 'Community Guidelines',
    icon: FiBookOpen,
    description: 'Code of conduct for platform users.',
    points: [
      { text: 'Strict ban on document forgery or fake IDs.', icon: FiAlertTriangle },
      { text: 'No third-party driver transfers without owner approval.', icon: FiUser },
      { text: 'Zero tolerance for drug transport or illegal use.', icon: FiShield },
      { text: 'Comply with checklist gates and digital agreement rules.', icon: FiCheckCircle }
    ]
  },
  safetyStandards: {
    title: 'Safety Standards',
    icon: FiShield,
    description: 'Our ongoing commitment to rider protection.',
    points: [
      { text: 'Verified badging on profiles indicating identity verification.', icon: FiCheckCircle },
      { text: 'Mandatory helmet availability check before ride activation.', icon: FiShield },
      { text: 'Encrypted document links utilizing secure Storage.', icon: FiShield },
      { text: 'Active platform moderation checks on vehicle status.', icon: FiUser }
    ]
  }
}

export default function InfoModal({ isOpen, onClose, type }) {
  if (!type || !modalContent[type]) return null;

  const content = modalContent[type];
  const MainIcon = content.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10"
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[150px] bg-brand/20 blur-[80px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="relative p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center border border-brand/20">
                  <MainIcon className="text-brand text-xl" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">{content.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                <FiX size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 relative">
              <p className="text-white/60 text-sm mb-6 leading-relaxed">
                {content.description}
              </p>

              <ul className="space-y-4">
                {content.points.map((point, index) => {
                  const PointIcon = point.icon;
                  return (
                    <motion.li 
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      className="flex items-start gap-3 group"
                    >
                      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-brand/10 group-hover:border-brand/30 transition-colors">
                        <PointIcon className="text-white/40 text-xs group-hover:text-brand transition-colors" />
                      </div>
                      <span className="text-sm text-white/80 leading-relaxed group-hover:text-white transition-colors">
                        {point.text}
                      </span>
                    </motion.li>
                  )
                })}
              </ul>

              <button
                onClick={onClose}
                className="w-full mt-8 btn-primary py-3 rounded-xl font-semibold shadow-[0_0_20px_rgba(255,107,0,0.15)] hover:shadow-[0_0_25px_rgba(255,107,0,0.3)] transition-all"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
