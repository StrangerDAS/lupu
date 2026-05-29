import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowRight } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import PageWrapper from '../components/PageWrapper'

export default function Overview() {
  const navigate = useNavigate()

  return (
    <PageWrapper className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 flex flex-col items-center text-center px-4"
      >
        <div className="w-20 h-20 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/30 mb-8">
          <RiMotorbikeLine className="text-white text-4xl" />
        </div>

        <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight">
          LUPU
        </h1>

        <h2 className="text-2xl md:text-3xl text-white/90 font-medium mb-4">
          Rent. Ride. Earn.
        </h2>

        <p className="text-white/50 text-lg md:text-xl max-w-md mx-auto mb-12">
          Your local vehicle & accessory rental platform
        </p>

        <motion.button
          onClick={() => navigate('/auth/login')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn-primary flex items-center gap-2 px-8 py-4 text-lg rounded-full shadow-lg shadow-brand/20"
        >
          Get Started <FiArrowRight />
        </motion.button>
      </motion.div>
    </PageWrapper>
  )
}
