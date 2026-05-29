import { motion } from 'framer-motion'
import { FiMapPin, FiKey, FiSmile, FiStar, FiArrowRight } from 'react-icons/fi'
import { RiMotorbikeLine, RiEBikeLine, RiUserHeartLine } from 'react-icons/ri'
import { HiOutlineLightBulb } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import PageWrapper from '../components/PageWrapper'

/* ── Animation variants ─────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: 'easeOut' },
  }),
}

/* ── Steps data ──────────────────────────────────────── */
const steps = [
  {
    num: '01',
    icon: RiMotorbikeLine,
    title: 'Owners list their vehicles',
    desc: 'Got a bike or scooty sitting idle? List it in minutes and let someone make good use of it.',
  },
  {
    num: '02',
    icon: FiMapPin,
    title: 'Users explore nearby rides',
    desc: 'Open the app, see what\'s available near you, and pick something that fits your plan.',
  },
  {
    num: '03',
    icon: FiKey,
    title: 'Booking happens easily',
    desc: 'Choose your time, book it, and connect with the owner. Done. No complicated steps.',
  },
  {
    num: '04',
    icon: FiSmile,
    title: 'Ride safely',
    desc: 'Go wherever you need to go. Everyone on LUPU is part of a real, trusted community.',
  },
  {
    num: '05',
    icon: FiStar,
    title: 'Return the vehicle',
    desc: 'Bring it back on time, drop a quick review if you want. That\'s the whole thing.',
  },
]

/* ── Team data ──────────────────────────────────────── */
const team = [
  { name: 'Ruhan Das',         initials: 'RD', hue: 22  },
  { name: 'Ankit Dutta',       initials: 'AD', hue: 200 },
  { name: 'Tonmoy Dihingia',   initials: 'TD', hue: 280 },
  { name: 'Abhigyan Handique', initials: 'AH', hue: 150 },
]

/* ── Why section items ──────────────────────────────── */
const whyItems = [
  {
    icon: RiUserHeartLine,
    text: 'A lot of people — students, workers, daily commuters — just need a bike for a few hours. Finding one isn\'t always easy.',
  },
  {
    icon: RiEBikeLine,
    text: 'At the same time, so many bikes and scooties just sit parked all day doing nothing.',
  },
  {
    icon: HiOutlineLightBulb,
    text: 'LUPU came out of that simple realisation. Connect the two. Make it easy. Keep it real.',
  },
]

/* ── Component ──────────────────────────────────────── */
export default function About() {
  return (
    <PageWrapper>
      <div className="relative overflow-hidden">

        {/* ── Ambient background glows ────────────────── */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand/10 blur-[140px] rounded-full" />
          <div className="absolute top-[60%] left-0 w-[400px] h-[400px] bg-brand/5 blur-[120px] rounded-full" />
          <div className="absolute top-[40%] right-0 w-[300px] h-[300px] bg-purple-500/5 blur-[100px] rounded-full" />
        </div>

        <div className="container-main relative z-10 pt-28 pb-24 space-y-32">

          {/* ── Hero ──────────────────────────────────── */}
          <section className="max-w-3xl mx-auto text-center">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={0}
              className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20
                         text-brand text-sm font-medium px-4 py-1.5 rounded-full mb-8"
            >
              <span className="w-2 h-2 bg-brand rounded-full animate-pulse-slow" />
              Our Story
            </motion.div>

            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-5xl sm:text-6xl font-black leading-tight tracking-tight mb-6"
            >
              About <span className="text-gradient">LUPU</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="text-lg md:text-xl text-white/55 leading-relaxed"
            >
              LUPU was created to make renting vehicles easier, affordable, and more
              convenient for everyone. Many bikes and scooties stay unused for most of
              the day, while many people struggle to find simple transportation. LUPU
              helps connect both in an easy and trusted way.
            </motion.p>
          </section>

          {/* ── Why LUPU exists ──────────────────────── */}
          <section>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Why we built this</h2>
              <p className="text-white/45 text-lg">A simple problem that needed a simple fix.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {whyItems.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  custom={i}
                  className="glass rounded-2xl p-7 border border-white/5
                             hover:border-brand/25 hover:-translate-y-1
                             transition-all duration-300 group"
                >
                  <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center
                                  justify-center mb-5 group-hover:bg-brand/20 transition-colors">
                    <item.icon className="text-brand text-2xl" />
                  </div>
                  <p className="text-white/65 leading-relaxed text-[15px]">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── How LUPU Works ───────────────────────── */}
          <section>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-3">How LUPU Works</h2>
              <p className="text-white/45 text-lg">Five steps, zero confusion.</p>
            </motion.div>

            {/* Steps — alternating layout on desktop */}
            <div className="relative max-w-3xl mx-auto">
              {/* Vertical connector line */}
              <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-6 bottom-6
                              w-px bg-gradient-to-b from-transparent via-brand/20 to-transparent" />

              <div className="flex flex-col gap-8">
                {steps.map((step, i) => {
                  const isLeft = i % 2 === 0
                  return (
                    <motion.div
                      key={step.num}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="show"
                      viewport={{ once: true }}
                      custom={i * 0.5}
                      className={`flex items-center gap-6 md:gap-10 ${
                        isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
                      } flex-row`}
                    >
                      {/* Card */}
                      <div className={`flex-1 glass rounded-2xl p-6 border border-white/5
                                      hover:border-brand/25 hover:shadow-lg hover:shadow-brand/5
                                      transition-all duration-300 group ${
                                        isLeft ? 'md:text-right' : 'md:text-left'
                                      } text-left`}>
                        <div className={`flex items-center gap-3 mb-3 ${
                          isLeft ? 'md:flex-row-reverse' : ''
                        }`}>
                          <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center
                                          justify-center shrink-0 group-hover:bg-brand/20 transition-colors">
                            <step.icon className="text-brand text-lg" />
                          </div>
                          <h3 className="text-base font-bold text-white">{step.title}</h3>
                        </div>
                        <p className="text-white/50 text-sm leading-relaxed">{step.desc}</p>
                      </div>

                      {/* Number bubble — center anchor */}
                      <div className="hidden md:flex shrink-0 w-12 h-12 bg-brand rounded-full
                                      items-center justify-center text-white text-sm font-black
                                      shadow-lg shadow-brand/30 z-10 relative">
                        {step.num}
                      </div>

                      {/* Spacer for the other side */}
                      <div className="hidden md:block flex-1" />
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── Our Goal ──────────────────────────────── */}
          <section>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="max-w-2xl mx-auto text-center"
            >
              <div className="card p-10 md:p-14 bg-gradient-to-br from-brand/12 via-surface to-surface
                              border border-brand/20 rounded-3xl relative overflow-hidden">
                {/* Glow behind quote */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 bg-brand/10 blur-[80px] rounded-full" />
                </div>

                <RiMotorbikeLine className="text-brand text-5xl mx-auto mb-6 opacity-80 relative z-10" />

                <blockquote className="relative z-10 text-2xl md:text-3xl font-bold leading-snug text-white mb-5">
                  "Not everyone owns a vehicle. Not every vehicle gets used. LUPU
                  just makes both sides work for each other."
                </blockquote>

                <p className="text-white/40 text-sm relative z-10">
                  — The LUPU team
                </p>

                <div className="mt-8 relative z-10">
                  <Link to="/explore" className="btn-primary inline-flex items-center gap-2">
                    Explore Rides <FiArrowRight />
                  </Link>
                </div>
              </div>
            </motion.div>
          </section>

          {/* ── Meet the Team ─────────────────────────── */}
          <section>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Meet the Team</h2>
              <p className="text-white/45 text-lg">The four of us who built this from scratch.</p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-4xl mx-auto">
              {team.map((member, i) => (
                <motion.div
                  key={member.name}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  custom={i}
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="glass rounded-2xl p-6 text-center border border-white/5
                             hover:border-white/10 hover:shadow-xl hover:shadow-black/30
                             transition-colors duration-300 cursor-default group"
                >
                  {/* Avatar */}
                  <div
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
                               text-white font-black text-xl shadow-lg transition-transform
                               duration-300 group-hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg,
                        hsl(${member.hue}, 70%, 50%),
                        hsl(${member.hue + 30}, 60%, 35%))`,
                      boxShadow: `0 8px 24px hsl(${member.hue}, 60%, 40%, 0.3)`,
                    }}
                  >
                    {member.initials}
                  </div>

                  <p className="font-semibold text-white text-sm leading-snug">
                    {member.name}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </PageWrapper>
  )
}
