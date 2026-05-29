import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RiMotorbikeLine } from 'react-icons/ri'
import { FiInstagram, FiTwitter, FiFacebook } from 'react-icons/fi'

const footerLinks = {
  Platform: [
    { label: 'Explore Vehicles', modalType: 'explore' },
    { label: 'List Your Vehicle', modalType: 'list' },
    { label: 'How it Works', modalType: 'howItWorks' },
  ],
  Company: [
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/#contact' },
    { label: 'Safety', to: '/#safety' },
  ],
  Legal: [
    { label: 'Legal Center', to: '/legal' },
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Service', to: '/terms' },
  ]
}

import InfoModal from './InfoModal'

export default function Footer() {
  const [modalState, setModalState] = useState({ isOpen: false, type: null })

  const openModal = (type) => {
    setModalState({ isOpen: true, type })
  }

  const closeModal = () => {
    setModalState({ ...modalState, isOpen: false })
  }

  return (
    <footer className="bg-surface border-t border-white/5 mt-auto">
      <div className="container-main py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
                <RiMotorbikeLine className="text-white text-xl" />
              </div>
              <span className="text-xl font-bold">
                lupu<span className="text-brand">.</span>
              </span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed">
              Peer-to-peer bike &amp; scooty rentals in Dibrugarh, Assam.
              Affordable, safe, and hassle-free.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {[FiInstagram, FiTwitter, FiFacebook].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center
                             text-white/40 hover:text-brand hover:bg-surface-3 transition"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-sm font-semibold text-white/30 uppercase tracking-widest mb-4">
                {heading}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.modalType ? (
                      <button
                        onClick={() => openModal(link.modalType)}
                        className="text-sm text-white/50 hover:text-brand transition text-left"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-sm text-white/50 hover:text-white transition"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Info Modal */}
        <InfoModal 
          isOpen={modalState.isOpen} 
          onClose={closeModal} 
          type={modalState.type} 
        />

        <div className="divider mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} LUPU Technologies. All rights reserved.
          </p>
          <p className="text-white/20 text-xs">Made with ❤️ in Dibrugarh, Assam</p>
        </div>
      </div>
    </footer>
  )
}
