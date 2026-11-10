import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiDownload, FiX, FiCheckCircle, FiHelpCircle, FiSmartphone, FiShield } from 'react-icons/fi'
import { IoLogoAndroid } from 'react-icons/io5'
import { Link } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { appAPI } from '../api/endpoints'
import toast from 'react-hot-toast'

const DISMISS_KEY = 'lupu_android_prompt_dismissed_until'

export default function AndroidAppPrompt() {
  const { user } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [appInfo, setAppInfo] = useState({
    version: '1.0.0',
    sizeMb: '74.7 MB',
    filename: 'LUPU-Rental.apk',
    downloadUrl: '/lupu-release.apk',
  })

  // Detect Android or test mode query param
  const isAndroid = () => {
    if (typeof window === 'undefined') return false
    const search = window.location.search || ''
    const isTest = search.includes('test_android=true') || search.includes('download_prompt=true')
    const isAndroidDevice = /Android/i.test(navigator.userAgent)
    return isAndroidDevice || isTest
  }

  useEffect(() => {
    // Display when on an Android device (or test mode), for both guests and authenticated users
    if (!isAndroid()) {
      setVisible(false)
      return
    }

    // Check if user dismissed recently (unless they just logged in)
    try {
      const justLoggedIn = sessionStorage.getItem('lupu_just_logged_in_android') === 'true'
      if (justLoggedIn) {
        sessionStorage.removeItem('lupu_just_logged_in_android')
        localStorage.removeItem(DISMISS_KEY)
      } else {
        const dismissedUntil = localStorage.getItem(DISMISS_KEY)
        if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
          setVisible(false)
          return
        }
      }
    } catch {
      // ignore localStorage errors
    }

    // Fetch dynamic metadata if available
    appAPI.getInfo()
      .then((res) => {
        if (res.data?.available) {
          setAppInfo((prev) => ({ ...prev, ...res.data }))
        }
      })
      .catch(() => {
        // Fallback to default metadata
      })

    // Slight delay so the page loads smoothly
    const timer = setTimeout(() => {
      setVisible(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [user])

  const handleDismiss = (days = 3) => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, (Date.now() + days * 24 * 60 * 60 * 1000).toString())
    } catch {
      // ignore
    }
  }

  const triggerDownload = () => {
    setDownloading(true)
    toast.success('Starting APK download… Tap file to install when finished!', {
      icon: '📱',
      duration: 5000,
    })

    // Trigger download via hidden anchor
    const link = document.createElement('a')
    link.href = '/lupu-release.apk'
    link.download = 'LUPU-Rental.apk'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloading(false)
      // Open guide modal so the user knows what to do when APK finishes downloading
      setShowGuideModal(true)
    }, 1500)
  }

  if (!visible && !showGuideModal) return null

  return (
    <>
      {/* ── Floating Android Smart App Banner ─────────────────────── */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 260 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-50 pointer-events-auto"
          >
            <div className="relative overflow-hidden rounded-2xl bg-[#0f0f12]/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-4 sm:p-5 text-white">
              {/* Subtle orange accent glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#FF5C00]/20 rounded-full blur-2xl pointer-events-none" />

              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(3)}
                aria-label="Dismiss app prompt"
                className="absolute top-3 right-3 text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
              >
                <FiX size={18} />
              </button>

              <div className="flex items-start gap-3.5">
                {/* LUPU App Icon with Android badge */}
                <div className="relative shrink-0">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-[#1b1b22] to-[#272732] border border-white/10 flex items-center justify-center shadow-lg p-2.5">
                    <img
                      src="/logo-icon.svg"
                      alt="LUPU App Icon"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.onerror = null
                        e.target.src = '/android-chrome-192x192.png'
                      }}
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#3DDC84] rounded-full border-2 border-[#0f0f12] flex items-center justify-center text-black shadow">
                    <IoLogoAndroid size={12} />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base tracking-tight text-white">
                      LUPU for Android
                    </span>
                    <span className="text-[10px] font-semibold bg-[#FF5C00]/20 text-[#FF5C00] border border-[#FF5C00]/30 px-1.5 py-0.5 rounded-full">
                      v{appInfo.version}
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mt-1 leading-snug">
                    Get faster vehicle unlocks, live ride tracking &amp; instant notifications on your phone.
                  </p>
                  <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3DDC84]" />
                    {appInfo.sizeMb} • Direct APK Download
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2.5 pt-3 border-t border-white/5">
                <button
                  onClick={triggerDownload}
                  disabled={downloading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5C00] to-[#FF7A00] text-white font-semibold text-xs sm:text-sm hover:brightness-110 active:scale-[0.98] transition shadow-[0_4px_14px_rgba(255,92,0,0.35)] disabled:opacity-50"
                >
                  <FiDownload size={15} />
                  {downloading ? 'Downloading…' : 'Download APK'}
                </button>

                <button
                  onClick={() => setShowGuideModal(true)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium border border-white/5 transition"
                >
                  <FiHelpCircle size={14} />
                  <span>How to install</span>
                </button>
              </div>

              {/* Footer link to dedicated page */}
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/40">
                <Link
                  to="/download"
                  onClick={() => setVisible(false)}
                  className="hover:text-[#FF5C00] transition"
                >
                  View full download details →
                </Link>
                <button
                  onClick={() => handleDismiss(30)}
                  className="hover:text-white/60 transition underline"
                >
                  Don't show again
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Android Installation Instructions Modal ───────────────── */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121217] border border-white/10 rounded-2xl p-6 text-white shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#3DDC84]/15 border border-[#3DDC84]/30 flex items-center justify-center text-[#3DDC84]">
                    <IoLogoAndroid size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">How to Install LUPU APK</h3>
                    <p className="text-xs text-white/50">Follow these 4 quick steps on your Android device</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Steps list */}
              <div className="py-4 space-y-3.5 text-sm">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-[#FF5C00]/20 text-[#FF5C00] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-white">Download the APK file</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Tap the <strong className="text-white">Download APK</strong> button. Your browser will download <code className="text-[#FF5C00] bg-black/40 px-1 py-0.5 rounded">LUPU-Rental.apk</code> (~{appInfo.sizeMb}).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-[#FF5C00]/20 text-[#FF5C00] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-white">Open the downloaded file</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Pull down your Android notification panel and tap on the finished download notification, or locate it in your <strong className="text-white">Files / Downloads</strong> app.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-[#FF5C00]/20 text-[#FF5C00] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-white">Allow "Install Unknown Apps"</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      If Android prompts <em className="text-white/80">"For your security, your phone is not allowed to install unknown apps from this source"</em>, tap <strong className="text-white">Settings</strong> and toggle on <strong className="text-[#3DDC84]">Allow from this source</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-[#FF5C00]/20 text-[#FF5C00] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-white">Tap "Install" and Launch</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Tap <strong className="text-white">Install</strong>. Once completed, open LUPU and sign in with your registered account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Safety badge */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#3DDC84]/10 border border-[#3DDC84]/20 text-xs text-[#3DDC84] mb-4">
                <FiShield size={16} className="shrink-0" />
                <span>100% Virus-Free &amp; Verified Official Release directly from LUPU.</span>
              </div>

              {/* Modal footer */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                <button
                  onClick={triggerDownload}
                  disabled={downloading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF5C00] text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
                >
                  <FiDownload size={16} />
                  {downloading ? 'Downloading…' : 'Download APK Now'}
                </button>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
