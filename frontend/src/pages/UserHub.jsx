import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiPlusCircle } from 'react-icons/fi'

export default function UserHub() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark">

      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[500px] bg-brand/20 blur-[150px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 text-center max-w-2xl mx-auto mb-16"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4 text-white drop-shadow-xl">
          LUPU
        </h1>
        <p className="text-xl md:text-2xl font-medium text-brand mb-4">
          Rent bikes, scooters, and accessories easily around your city.
        </p>
        <p className="text-white/60 text-base md:text-lg max-w-lg mx-auto leading-relaxed">
          Choose whether you want to rent a vehicle or earn money by listing your own rides and accessories.
        </p>
      </motion.div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">

        {/* RENT A VEHICLE CARD */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ scale: 1.03, y: -5 }}
          className="group relative cursor-pointer"
          onClick={() => navigate('/explore')}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-br from-brand via-orange-500 to-transparent rounded-3xl blur opacity-30 group-hover:opacity-70 transition duration-500" />
          <div className="relative h-full flex flex-col p-8 bg-[#111111]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6 border border-brand/20 group-hover:bg-brand/20 transition-colors">
              <FiSearch className="w-8 h-8 text-brand" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Rent a Vehicle</h3>
            <p className="text-white/50 text-lg mb-8 flex-grow">
              Explore bikes, scooters, and accessories available near you.
            </p>
            <button className="w-full btn-primary py-4 text-lg font-semibold rounded-xl flex items-center justify-center gap-2">
              Explore Rentals
            </button>
          </div>
        </motion.div>

        {/* POST YOUR RIDE CARD */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          whileHover={{ scale: 1.03, y: -5 }}
          className="group relative cursor-pointer"
          onClick={() => navigate('/owner/setup')}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-bl from-purple-500 via-brand to-transparent rounded-3xl blur opacity-20 group-hover:opacity-60 transition duration-500" />
          <div className="relative h-full flex flex-col p-8 bg-[#111111]/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
              <FiPlusCircle className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-3 tracking-tight">Post Your Ride</h3>
            <p className="text-white/50 text-lg mb-8 flex-grow">
              Earn money by listing your bike, scooty, helmet, or accessories.
            </p>
            <button className="w-full bg-white text-black hover:bg-gray-200 transition-colors py-4 text-lg font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              Start Listing
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
