import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowRight, FiShield, FiStar, FiClock } from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine, RiMoneyRupeeCircleLine } from 'react-icons/ri'
import { HiLocationMarker } from 'react-icons/hi'
import PageWrapper from '../components/PageWrapper'

/* ── Animation variants ───────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' },
  }),
}

/* ── Data ─────────────────────────────────────────────── */

const howItWorks = [
  {
    step: '01',
    title: 'Browse & Choose',
    desc: 'Explore bikes and scooties available near you in Dibrugarh. Filter by price, type, or availability.',
    icon: RiMotorbikeLine,
  },
  {
    step: '02',
    title: 'Book Instantly',
    desc: 'Select your dates, upload your driving licence, and confirm your booking in minutes.',
    icon: FiClock,
  },
  {
    step: '03',
    title: 'Ride & Return',
    desc: 'Pick up the vehicle, enjoy your ride, and return it at the agreed time. Simple as that.',
    icon: HiLocationMarker,
  },
]

const features = [
  {
    icon: FiShield,
    title: 'Verified Vehicles',
    desc: 'Every vehicle is reviewed and approved by our team before being listed.',
  },
  {
    icon: FiStar,
    title: 'Trusted Owners',
    desc: 'Vehicle owners are verified locals with ratings from real users.',
  },
  {
    icon: RiMoneyRupeeCircleLine,
    title: 'Fair Pricing',
    desc: 'Transparent pricing with no hidden fees. Pay exactly what you see.',
  },
  {
    icon: RiEBikeLine,
    title: 'All Vehicle Types',
    desc: 'From sporty bikes to comfortable scooties — we have it all.',
  },
]


/* ── Component ────────────────────────────────────────── */
export default function Home() {
  return (
    <PageWrapper>
      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand/5 rounded-full blur-3xl" />
        </div>

        <div className="container-main relative z-10 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Pill badge */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0}
              className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20
                         text-brand text-sm font-medium px-4 py-1.5 rounded-full mb-8"
            >
              <span className="w-2 h-2 bg-brand rounded-full animate-pulse-slow" />
              Now live in Dibrugarh, Assam
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-5xl sm:text-6xl md:text-7xl font-black leading-tight tracking-tight"
            >
              Rent Bikes &amp;{' '}
              <span className="text-gradient">Scooties</span>
              <br />
              in Dibrugarh
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="mt-6 text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
            >
              The easiest way to rent a two-wheeler in Dibrugarh. Browse verified vehicles,
              book instantly, and hit the road — starting at ₹49/hr.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10"
            >
              <Link to="/explore" className="btn-primary flex items-center gap-2 text-base px-8 py-3.5">
                Book a Ride
                <FiArrowRight />
              </Link>
              <Link to="/auth/signup" className="btn-secondary flex items-center gap-2 text-base px-8 py-3.5">
                List Your Vehicle
              </Link>
            </motion.div>


          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-6 h-10 border-2
                     border-white/20 rounded-full flex items-start justify-center pt-2"
        >
          <div className="w-1 h-2 bg-white/40 rounded-full" />
        </motion.div>
      </section>

      {/* ── Vehicle Type Showcase ───────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container-main">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="section-title">What do you want to ride?</h2>
            <p className="section-sub">Choose from a range of verified two-wheelers</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              {
                type: 'Bikes',
                desc: 'Powerful bikes for longer rides and highways',
                icon: RiMotorbikeLine,
                color: 'from-orange-500/20 to-red-500/10',
                to: '/explore?type=bike',
                examples: ['Royal Enfield', 'Honda CB', 'Bajaj Pulsar'],
              },
              {
                type: 'Scooties',
                desc: 'Smooth scooties perfect for city rides',
                icon: RiEBikeLine,
                color: 'from-blue-500/20 to-purple-500/10',
                to: '/explore?type=scooty',
                examples: ['Honda Activa', 'TVS Jupiter', 'Suzuki Access'],
              },
            ].map((item, i) => (
              <motion.div
                key={item.type}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i}
              >
                <Link
                  to={item.to}
                  className={`block card card-hover bg-gradient-to-br ${item.color}
                              border border-white/5 p-8 group`}
                >
                  <item.icon className="text-5xl text-brand mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-2xl font-bold mb-2">{item.type}</h3>
                  <p className="text-white/50 text-sm mb-5">{item.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.examples.map((ex) => (
                      <span key={ex} className="badge bg-white/5 text-white/50 text-xs">{ex}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-brand text-sm font-semibold mt-6 group-hover:gap-3 transition-all">
                    Explore {item.type} <FiArrowRight />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ───────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28 bg-surface/40">
        <div className="container-main">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="section-title">How LUPU works</h2>
            <p className="section-sub">Ride in three simple steps</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

            {howItWorks.map((step, i) => (
              <motion.div
                key={step.step}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i}
                className="relative text-center"
              >
                <div className="w-20 h-20 bg-surface-2 border border-white/10 rounded-2xl
                               flex items-center justify-center mx-auto mb-5 relative z-10">
                  <step.icon className="text-brand text-3xl" />
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-brand rounded-full
                                   text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link to="/explore" className="btn-primary inline-flex items-center gap-2">
              Start Exploring <FiArrowRight />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container-main">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="section-title">Why choose LUPU?</h2>
            <p className="section-sub">Built for trust, speed, and local convenience</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                custom={i}
                className="card card-hover p-6"
              >
                <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="text-brand text-2xl" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Owner CTA ──────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container-main">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="card p-8 md:p-12 bg-gradient-to-br from-brand/15 to-brand/5
                       border-brand/20 text-center md:text-left
                       md:flex md:items-center md:justify-between gap-8"
          >
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Own a bike or scooty?
              </h2>
              <p className="text-white/50 text-lg max-w-xl">
                Put your idle vehicle to work. Earn up to ₹15,000/month by listing it
                on LUPU. Free to list, no commission until you earn.
              </p>
            </div>
            <div className="mt-6 md:mt-0 shrink-0">
              <Link
                to="/auth/signup"
                className="btn-primary inline-flex items-center gap-2 text-base px-8 py-4"
              >
                List Your Vehicle <FiArrowRight />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PageWrapper>
  )
}
