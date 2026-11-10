import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FiDownload,
  FiCheckCircle,
  FiShield,
  FiSmartphone,
  FiZap,
  FiBell,
  FiMapPin,
  FiHelpCircle,
  FiArrowRight,
  FiInfo,
} from 'react-icons/fi'
import { IoLogoAndroid } from 'react-icons/io5'
import { appAPI } from '../api/endpoints'
import toast from 'react-hot-toast'

export default function DownloadApp() {
  const [downloading, setDownloading] = useState(false)
  const [appInfo, setAppInfo] = useState({
    version: '1.0.0',
    sizeMb: '74.7 MB',
    filename: 'LUPU-Rental.apk',
    downloadUrl: '/api/app/download',
  })

  useEffect(() => {
    appAPI.getInfo()
      .then((res) => {
        if (res.data?.available) {
          setAppInfo(prev => ({ ...prev, ...res.data }))
        }
      })
      .catch(() => {})
  }, [])

  const handleDownload = () => {
    setDownloading(true)
    toast.success('Downloading LUPU Android APK…', {
      icon: '🚀',
      duration: 4000,
    })

    const link = document.createElement('a')
    link.href = appInfo.downloadUrl || '/api/app/download'
    link.download = appInfo.filename || 'LUPU-Rental.apk'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setDownloading(false)
    }, 2000)
  }

  const features = [
    {
      icon: FiZap,
      title: 'Faster Vehicle Unlocks',
      desc: 'Instant OTP passes and digital vehicle condition checklists directly on your phone.',
    },
    {
      icon: FiBell,
      title: 'Real-time Push Alerts',
      desc: 'Receive instant alerts for booking approvals, owner messages, and trip return reminders.',
    },
    {
      icon: FiMapPin,
      title: 'GPS Pickup Navigation',
      desc: 'Turn-by-turn navigation straight to the owner’s verified pickup and drop-off hubs in Dibrugarh.',
    },
    {
      icon: FiShield,
      title: '1-Tap SOS Assistance',
      desc: 'Instant access to Dibrugarh local emergency contacts and 24/7 roadside assistance.',
    },
  ]

  const installSteps = [
    {
      step: '1',
      title: 'Download the APK',
      desc: `Click the download button below. Your device will save ${appInfo.filename} (~${appInfo.sizeMb}).`,
    },
    {
      step: '2',
      title: 'Open Downloaded File',
      desc: 'Swipe down the notification shade and tap the download completion alert, or open your Downloads folder.',
    },
    {
      step: '3',
      title: 'Allow Unknown Sources',
      desc: 'If prompted by Chrome or Files, tap Settings and turn on "Allow from this source".',
    },
    {
      step: '4',
      title: 'Tap Install & Sign In',
      desc: 'Press Install. Once finished, launch LUPU and sign in with your email or Google account.',
    },
  ]

  const faqs = [
    {
      q: 'Why am I downloading an APK directly instead of Google Play Store?',
      a: 'Direct APK distribution lets us roll out new features, critical safety updates, and regional Dibrugarh improvements to our riders instantly without store review delays.',
    },
    {
      q: 'Is it completely safe to install this APK on my phone?',
      a: 'Yes, 100%. The APK is built, verified, and hosted directly on our official LUPU infrastructure. It contains zero third-party trackers or malware.',
    },
    {
      q: 'Will my active bookings and documents sync with the mobile app?',
      a: 'Yes! Simply sign in with the same email or Google account you use on this website. Your profile, bookings, vehicles, and verification status sync automatically.',
    },
    {
      q: 'What are the minimum Android system requirements?',
      a: 'LUPU supports Android 8.0 (Oreo) and above. You will need approximately 100 MB of free storage space for installation.',
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 sm:px-6">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#FF5C00]/15 blur-[140px] rounded-full" />
        <div className="absolute top-96 right-10 w-[300px] h-[300px] bg-[#3DDC84]/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        {/* ── Hero Section ────────────────────────────────────────── */}
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/90 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-[#3DDC84] animate-pulse" />
            <IoLogoAndroid className="text-[#3DDC84] text-sm" />
            Official Android Release v{appInfo.version}
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Ride faster with <span className="text-[#FF5C00]">LUPU</span> for Android
          </h1>

          <p className="mt-5 text-base sm:text-lg text-white/60 leading-relaxed max-w-2xl mx-auto">
            Experience the smoothest two-wheeler rentals in Dibrugarh. Book rides, verify documents, and get real-time trip alerts all in the palm of your hand.
          </p>

          {/* CTA Download Card */}
          <div className="mt-8 sm:mt-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#18181f] to-[#101014] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.7)] max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#1f1f28] to-[#2c2c3b] border border-white/10 flex items-center justify-center p-3 shadow-inner mb-4">
              <img
                src="/logo-icon.svg"
                alt="LUPU Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.src = '/android-chrome-192x192.png'
                }}
              />
            </div>

            <div className="text-xl font-bold text-white">LUPU Rental App</div>
            <div className="text-xs text-white/50 mt-1 flex items-center justify-center gap-2">
              <span>Version {appInfo.version}</span>
              <span>•</span>
              <span className="text-[#3DDC84] font-medium">{appInfo.sizeMb}</span>
              <span>•</span>
              <span>Android 8.0+</span>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="mt-6 w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF5C00] to-[#FF7A00] text-white font-bold text-base hover:brightness-110 active:scale-[0.99] transition shadow-[0_10px_25px_rgba(255,92,0,0.4)] disabled:opacity-60 cursor-pointer"
            >
              <FiDownload size={20} className={downloading ? 'animate-bounce' : ''} />
              <span>{downloading ? 'Downloading APK…' : 'Download LUPU APK'}</span>
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
              <FiShield className="text-[#3DDC84]" />
              <span>Safe &amp; Signed Package • Direct Download</span>
            </div>
          </div>
        </div>

        {/* ── Features Grid ───────────────────────────────────────── */}
        <div className="mt-20 sm:mt-24">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Built for on-the-go riders &amp; vehicle owners
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Everything you love about LUPU, optimized for high performance on Android.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-[#FF5C00]/30 transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FF5C00]/10 text-[#FF5C00] flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold text-base text-white">{f.title}</h3>
                <p className="text-xs text-white/60 mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 4-Step Installation Guide ───────────────────────────── */}
        <div className="mt-20 sm:mt-24 p-6 sm:p-10 rounded-3xl bg-[#121217] border border-white/10">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3DDC84]/10 text-[#3DDC84] text-xs font-semibold mb-3">
              <FiCheckCircle size={14} /> Quick Installation Guide
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold">How to install the APK on Android</h2>
            <p className="mt-2 text-sm text-white/50">
              Direct installation takes less than 30 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {installSteps.map((s) => (
              <div
                key={s.step}
                className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5C00] to-[#FF8C00] text-white font-bold text-sm flex items-center justify-center mb-3">
                    {s.step}
                  </div>
                  <h4 className="font-semibold text-white text-sm">{s.title}</h4>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Notice Box */}
          <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3 text-xs text-white/70">
            <FiInfo size={18} className="text-[#FF5C00] shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Note on "Unknown Sources": </strong>
              Android displays a security reminder whenever an app is installed outside Google Play. Since this APK comes directly from LUPU's official website, it is completely safe to allow installation.
            </div>
          </div>
        </div>

        {/* ── FAQs ────────────────────────────────────────────────── */}
        <div className="mt-20 sm:mt-24 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold">Frequently Asked Questions</h2>
            <p className="mt-2 text-sm text-white/50">Everything you need to know about the LUPU APK</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-white/[0.03] border border-white/5"
              >
                <h4 className="font-semibold text-white text-sm sm:text-base flex items-start gap-2">
                  <span className="text-[#FF5C00] font-bold">Q.</span>
                  {faq.q}
                </h4>
                <p className="text-xs sm:text-sm text-white/60 mt-2 pl-5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom CTA ──────────────────────────────────────────── */}
        <div className="mt-20 text-center py-12 px-6 rounded-3xl bg-gradient-to-r from-[#18181f] via-[#1f1b29] to-[#18181f] border border-white/10">
          <h3 className="text-2xl sm:text-3xl font-bold">Ready to ride?</h3>
          <p className="text-sm text-white/60 mt-2 max-w-md mx-auto">
            Get the app today and rent reliable two-wheelers anywhere in Dibrugarh.
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-6 inline-flex items-center gap-2 py-3.5 px-8 rounded-xl bg-[#FF5C00] hover:bg-[#ff6f1f] text-white font-semibold text-sm transition shadow-lg shadow-[#FF5C00]/30"
          >
            <FiDownload size={18} />
            <span>Download LUPU APK ({appInfo.sizeMb})</span>
          </button>
        </div>
      </div>
    </div>
  )
}

