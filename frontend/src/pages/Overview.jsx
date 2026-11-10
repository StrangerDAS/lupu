import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowRight, FiDownload } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import { IoLogoAndroid } from 'react-icons/io5'
import PageWrapper from '../components/PageWrapper'

export default function Overview() {
  const navigate = useNavigate()

  return (
    <PageWrapper className="min-h-screen bg-black flex flex-col items-center justify-between relative overflow-hidden text-white">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Top Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 z-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/30">
            <RiMotorbikeLine className="text-white text-xl" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            lupu<span className="text-brand">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/explore"
            className="text-sm font-medium text-white/70 hover:text-white transition px-3 py-2 hidden sm:block"
          >
            Explore
          </Link>
          <Link
            to="/download"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-semibold text-white transition"
          >
            <IoLogoAndroid className="text-[#3DDC84] text-base" />
            <span>Get Android App</span>
          </Link>
          <Link
            to="/auth/login"
            className="text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full bg-brand text-white hover:brightness-110 transition"
          >
            Log In
          </Link>
        </div>
      </header>

      {/* Center Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 flex flex-col items-center text-center px-4 my-auto py-12"
      >
        {/* Android App Announcement Pill */}
        <Link
          to="/download"
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-brand/40 text-xs sm:text-sm font-medium text-white/80 hover:text-white mb-6 transition"
        >
          <span className="w-2 h-2 rounded-full bg-[#3DDC84] animate-pulse" />
          <IoLogoAndroid className="text-[#3DDC84] text-base" />
          <span>Official LUPU Android App is here!</span>
          <span className="text-brand group-hover:translate-x-0.5 transition-transform">Download APK →</span>
        </Link>

        <div className="w-20 h-20 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/30 mb-8">
          <RiMotorbikeLine className="text-white text-4xl" />
        </div>

        <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight">
          LUPU
        </h1>

        <h2 className="text-2xl md:text-3xl text-white/90 font-medium mb-4">
          Rent. Ride. Earn.
        </h2>

        <p className="text-white/50 text-lg md:text-xl max-w-md mx-auto mb-10">
          Your local bike &amp; scooty rental platform in Dibrugarh
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center">
          <motion.button
            onClick={() => navigate('/auth/login')}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 text-base sm:text-lg rounded-full shadow-lg shadow-brand/20 cursor-pointer"
          >
            Get Started <FiArrowRight />
          </motion.button>

          <Link
            to="/download"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-4 rounded-full bg-white/10 hover:bg-white/15 text-white/90 hover:text-white border border-white/15 text-base font-medium transition cursor-pointer"
          >
            <IoLogoAndroid className="text-[#3DDC84] text-xl" />
            <span>Download App (APK)</span>
          </Link>
        </div>
      </motion.div>

      {/* Footer minimal info */}
      <footer className="w-full py-6 text-center text-xs text-white/30 z-20">
        © {new Date().getFullYear()} LUPU Mobility • Peer-to-peer two-wheeler rentals in Dibrugarh, Assam
      </footer>
    </PageWrapper>
  )
}
