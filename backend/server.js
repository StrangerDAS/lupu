/**
 * LUPU — Mock API Server
 *
 * A fully functional mock Express server that provides realistic API responses
 * for the frontend to work without a real MongoDB backend.
 *
 * Run: node server.js
 * All data is in-memory and resets on restart.
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import Razorpay from 'razorpay'

const app = express()
const PORT = process.env.PORT || 5001
const JWT_SECRET = 'uniride-dev-secret-key'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET',
})

// ── Middleware ──────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── In-Memory Data Store ───────────────────────────────────
const users = [
  { _id: 'u1', name: 'Admin', email: 'admin@lupu.in', phone: '9876543210', role: 'admin', isRider: true, isOwner: true, otpVerified: true, createdAt: '2024-01-15' },
  { _id: 'u2', name: 'Rahul Gogoi', email: 'rahul@lupu.in', phone: '9876543211', role: 'owner', isRider: true, isOwner: true, otpVerified: true, createdAt: '2024-02-15' },
  { _id: 'u3', name: 'Priya Borah', email: 'priya@lupu.in', phone: '9876543212', role: 'user', isRider: true, isOwner: false, otpVerified: true, createdAt: '2024-03-01' },
  { _id: 'u4', name: 'Anjali Das', email: 'anjali@lupu.in', phone: '9876543213', role: 'user', isRider: true, isOwner: false, otpVerified: true, createdAt: '2024-04-10' },
]

// ── OTP Store (in-memory, expires after 5 min) ────────────
const otpStore = new Map()  // key: userId|type → { code, expiresAt, attempts }
const OTP_EXPIRY_MS = 5 * 60 * 1000
const MAX_OTP_ATTEMPTS = 5

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function storeOTP(key, code) {
  otpStore.set(key, { code, expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0 })
}

function verifyOTP(key, code) {
  const entry = otpStore.get(key)
  if (!entry) return { valid: false, message: 'OTP not found. Please request a new one.' }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key)
    return { valid: false, message: 'OTP expired. Please request a new one.' }
  }
  entry.attempts++
  if (entry.attempts > MAX_OTP_ATTEMPTS) {
    otpStore.delete(key)
    return { valid: false, message: 'Too many attempts. Please request a new OTP.' }
  }
  if (entry.code !== code) {
    return { valid: false, message: 'Incorrect OTP. Please try again.' }
  }
  otpStore.delete(key)
  return { valid: true }
}

const vehicles = [
  {
    _id: '1',
    name: 'Royal Enfield Classic 350',
    type: 'bike',
    pricePerHour: 120,
    pricePerDay: 800,
    status: 'approved',
    isLive: true,
    rating: 4.8,
    totalReviews: 24,
    location: 'AT Road, Dibrugarh',
    description:
      'A well-maintained Royal Enfield Classic 350. Full-service history available. Helmet included. Perfect for long rides and city commuting.',
    specs: { year: 2022, cc: 350, fuel: 'Petrol', transmission: 'Manual' },
    images: [],
    ownerId: { _id: 'u2', name: 'Rahul Gogoi', rating: 4.9, totalTrips: 47 },
    owner: { name: 'Rahul Gogoi', rating: 4.9, totalTrips: 47 },
  },
  {
    _id: '2',
    name: 'Honda Activa 6G',
    type: 'scooty',
    pricePerHour: 55,
    pricePerDay: 350,
    status: 'approved',
    isLive: true,
    rating: 4.6,
    totalReviews: 18,
    location: 'Chowkidinghee, Dibrugarh',
    description: 'Reliable Honda Activa — ideal for city errands and college commutes.',
    specs: { year: 2023, cc: 110, fuel: 'Petrol', transmission: 'Automatic' },
    images: [],
    ownerId: { _id: 'u3', name: 'Priya Borah', rating: 4.7, totalTrips: 31 },
    owner: { name: 'Priya Borah', rating: 4.7, totalTrips: 31 },
  },
  {
    _id: '3',
    name: 'Bajaj Pulsar NS200',
    type: 'bike',
    pricePerHour: 100,
    pricePerDay: 650,
    status: 'approved',
    isLive: false,
    rating: 4.5,
    totalReviews: 9,
    location: 'Graham Bazar, Dibrugarh',
    description: 'Sporty Pulsar NS200 in great condition. Good for highway and city rides.',
    specs: { year: 2021, cc: 200, fuel: 'Petrol', transmission: 'Manual' },
    images: [],
    ownerId: { _id: 'u2', name: 'Bikash Saikia', rating: 4.5, totalTrips: 12 },
    owner: { name: 'Bikash Saikia', rating: 4.5, totalTrips: 12 },
  },
  {
    _id: '4',
    name: 'TVS Jupiter',
    type: 'scooty',
    pricePerHour: 49,
    pricePerDay: 300,
    status: 'approved',
    isLive: true,
    rating: 4.7,
    totalReviews: 31,
    location: 'Lahoal, Dibrugarh',
    description: 'Comfortable TVS Jupiter with storage basket. Great for daily use.',
    specs: { year: 2022, cc: 110, fuel: 'Petrol', transmission: 'Automatic' },
    images: [],
    ownerId: { _id: 'u4', name: 'Anjali Das', rating: 4.8, totalTrips: 22 },
    owner: { name: 'Anjali Das', rating: 4.8, totalTrips: 22 },
  },
  {
    _id: '5',
    name: 'Yamaha FZ-S V3',
    type: 'bike',
    pricePerHour: 90,
    pricePerDay: 580,
    status: 'approved',
    isLive: true,
    rating: 4.4,
    totalReviews: 7,
    location: 'Barbari, Dibrugarh',
    description: 'Yamaha FZ-S V3 with fuel injection. Smooth and fuel-efficient.',
    specs: { year: 2022, cc: 149, fuel: 'Petrol', transmission: 'Manual' },
    images: [],
    ownerId: { _id: 'u2', name: 'Dipak Hazarika', rating: 4.3, totalTrips: 9 },
    owner: { name: 'Dipak Hazarika', rating: 4.3, totalTrips: 9 },
  },
  {
    _id: '6',
    name: 'Suzuki Access 125',
    type: 'scooty',
    pricePerHour: 60,
    pricePerDay: 380,
    status: 'approved',
    isLive: true,
    rating: 4.9,
    totalReviews: 42,
    location: 'AT Road, Dibrugarh',
    description: 'Premium Suzuki Access 125. Smooth, powerful, and comfortable for any ride.',
    specs: { year: 2023, cc: 124, fuel: 'Petrol', transmission: 'Automatic' },
    images: [],
    ownerId: { _id: 'u2', name: 'Mrinali Gogoi', rating: 4.9, totalTrips: 55 },
    owner: { name: 'Mrinali Gogoi', rating: 4.9, totalTrips: 55 },
  },
  {
    _id: '7',
    name: 'KTM Duke 200',
    type: 'bike',
    pricePerHour: 150,
    pricePerDay: 950,
    status: 'approved',
    isLive: false,
    rating: 4.3,
    totalReviews: 5,
    location: 'Chowkidinghee, Dibrugarh',
    description: 'Aggressive KTM Duke 200 for thrill seekers. Excellent road performance.',
    specs: { year: 2021, cc: 200, fuel: 'Petrol', transmission: 'Manual' },
    images: [],
    ownerId: { _id: 'u2', name: 'Kabir Ahmed', rating: 4.2, totalTrips: 6 },
    owner: { name: 'Kabir Ahmed', rating: 4.2, totalTrips: 6 },
  },
  {
    _id: '8',
    name: 'Honda Dio',
    type: 'scooty',
    pricePerHour: 50,
    pricePerDay: 320,
    status: 'approved',
    isLive: true,
    rating: 4.6,
    totalReviews: 16,
    location: 'Graham Bazar, Dibrugarh',
    description: 'Stylish Honda Dio. Lightweight and easy to manoeuvre.',
    specs: { year: 2023, cc: 110, fuel: 'Petrol', transmission: 'Automatic' },
    images: [],
    ownerId: { _id: 'u2', name: 'Rupali Saikia', rating: 4.7, totalTrips: 18 },
    owner: { name: 'Rupali Saikia', rating: 4.7, totalTrips: 18 },
  },
  {
    _id: 'v-pending-1',
    name: 'Hero Splendor Plus',
    type: 'bike',
    pricePerHour: 40,
    pricePerDay: 250,
    status: 'pending',
    isLive: false,
    rating: 0,
    totalReviews: 0,
    location: 'Mohanbari, Dibrugarh',
    description: 'Budget-friendly Hero Splendor. Perfect for city commuting.',
    specs: { year: 2023, cc: 100, fuel: 'Petrol', transmission: 'Manual' },
    images: [],
    ownerId: { _id: 'u2', name: 'Rahul Gogoi' },
    owner: { name: 'Rahul Gogoi' },
  },
  {
    _id: 'v-pending-2',
    name: 'TVS Ntorq 125',
    type: 'scooty',
    pricePerHour: 65,
    pricePerDay: 420,
    status: 'pending',
    isLive: false,
    rating: 0,
    totalReviews: 0,
    location: 'AT Road, Dibrugarh',
    description: 'Sporty TVS Ntorq with Bluetooth connectivity and race-tuned FI engine.',
    specs: { year: 2024, cc: 124, fuel: 'Petrol', transmission: 'Automatic' },
    images: [],
    ownerId: { _id: 'u3', name: 'Priya Borah' },
    owner: { name: 'Priya Borah' },
  },
]

const accessories = [
  { _id: 'a1', name: 'Full-Face Helmet', category: 'accessory', pricePerDay: 50, description: 'ISI-certified full-face helmet. Visor included.', availability: true, ownerId: { _id: 'u2', name: 'Rahul Gogoi' }, rating: 4.8, totalReviews: 15, location: 'AT Road, Dibrugarh', images: [] },
  { _id: 'a2', name: 'Riding Gloves', category: 'accessory', pricePerDay: 30, description: 'Touch-screen compatible riding gloves. Good grip.', availability: true, ownerId: { _id: 'u2', name: 'Rahul Gogoi' }, rating: 4.5, totalReviews: 8, location: 'AT Road, Dibrugarh', images: [] },
  { _id: 'a3', name: 'Rain Jacket (Waterproof)', category: 'accessory', pricePerDay: 60, description: 'Lightweight waterproof rain jacket for monsoon rides.', availability: true, ownerId: { _id: 'u3', name: 'Priya Borah' }, rating: 4.6, totalReviews: 12, location: 'Chowkidinghee, Dibrugarh', images: [] },
  { _id: 'a4', name: 'Phone Mount (Handlebar)', category: 'accessory', pricePerDay: 20, description: 'Universal handlebar phone mount with anti-vibration.', availability: true, ownerId: { _id: 'u2', name: 'Rahul Gogoi' }, rating: 4.7, totalReviews: 20, location: 'Graham Bazar, Dibrugarh', images: [] },
  { _id: 'a5', name: 'Knee Guards (Pair)', category: 'accessory', pricePerDay: 40, description: 'Hard-shell knee guards for safe riding.', availability: true, ownerId: { _id: 'u4', name: 'Anjali Das' }, rating: 4.4, totalReviews: 6, location: 'Lahoal, Dibrugarh', images: [] },
  { _id: 'a6', name: 'Bungee Cord Net', category: 'accessory', pricePerDay: 15, description: 'Elastic cargo net for securing luggage on bikes.', availability: true, ownerId: { _id: 'u2', name: 'Rahul Gogoi' }, rating: 4.3, totalReviews: 9, location: 'AT Road, Dibrugarh', images: [] },
]

const bookings = [
  { _id: 'b1', userId: { _id: 'u3', name: 'Priya Borah' }, items: [{ itemId: '2', name: 'Honda Activa 6G', type: 'vehicle', price: 350 }], startTime: '2024-05-10T09:00:00Z', endTime: '2024-05-10T18:00:00Z', status: 'completed', totalAmount: 495, agreementAccepted: true, agreementTimestamp: '2024-05-10T08:30:00Z' },
  { _id: 'b2', userId: { _id: 'u3', name: 'Priya Borah' }, items: [{ itemId: '1', name: 'Royal Enfield Classic 350', type: 'vehicle', price: 800 }, { itemId: 'a1', name: 'Full-Face Helmet', type: 'accessory', price: 50 }], startTime: '2024-06-01T10:00:00Z', endTime: '2024-06-02T10:00:00Z', status: 'confirmed', totalAmount: 850, agreementAccepted: true, agreementTimestamp: '2024-06-01T09:00:00Z' },
  { _id: 'b3', userId: { _id: 'u4', name: 'Anjali Das' }, items: [{ itemId: '1', name: 'Royal Enfield Classic 350', type: 'vehicle', price: 800 }], startTime: '2024-06-12T10:00:00Z', endTime: '2024-06-13T10:00:00Z', status: 'completed', totalAmount: 800, agreementAccepted: true, agreementTimestamp: '2024-06-12T09:00:00Z' },
]

let nextVehicleId = 100
let nextBookingId = 100
let nextAccessoryId = 100

// ── Auth Helpers ───────────────────────────────────────────
function generateToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET)
    req.user = users.find((u) => u._id === decoded.id)
    if (!req.user) return res.status(401).json({ message: 'User not found' })
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

function safeUser(u) {
  const { password, ...rest } = u
  return rest
}

// ── KYC Removed ──
function kycRequired(req, res, next) {
  next()
}

// ── Auth Routes ────────────────────────────────────────────

app.post('/api/auth/send-otp', (req, res) => {
  const { identifier } = req.body
  if (!identifier) return res.status(400).json({ message: 'Email or phone required' })
  
  const key = identifier
  const existing = otpStore.get(key)
  if (existing && (existing.expiresAt - OTP_EXPIRY_MS + 60000) > Date.now()) {
    return res.status(429).json({ message: 'OTP already sent. Please wait.' })
  }
  
  const code = generateOTP()
  storeOTP(key, code)
  console.log(`  🔐 OTP for ${identifier}: ${code}`)
  res.json({ message: 'OTP sent successfully', _dev_otp: code })
})

app.post('/api/auth/signup', (req, res) => {
  const { identifier, otp, name, role = 'user' } = req.body
  if (!name || !identifier || !otp) {
    return res.status(400).json({ message: 'All fields are required' })
  }
  if (users.find((u) => u.email === identifier || u.phone === identifier)) {
    return res.status(409).json({ message: 'Account already exists' })
  }
  
  const result = verifyOTP(identifier, otp)
  if (!result.valid) return res.status(400).json({ message: result.message })

  const isEmail = identifier.includes('@')
  const newUser = {
    _id: `u${Date.now()}`,
    name, 
    email: isEmail ? identifier : undefined,
    phone: !isEmail ? identifier : undefined,
    role: ['user', 'owner'].includes(role) ? role : 'user',
    isRider: true,
    isOwner: role === 'owner',
    otpVerified: true,
    createdAt: new Date().toISOString(),
  }
  users.push(newUser)
  const token = generateToken(newUser)
  res.status(201).json({ user: safeUser(newUser), token })
})

app.post('/api/auth/login', (req, res) => {
  const { identifier, otp } = req.body
  if (!identifier || !otp) return res.status(400).json({ message: 'Identifier and OTP required' })

  const user = users.find((u) => u.email === identifier || u.phone === identifier)
  if (!user) {
    return res.status(404).json({ message: 'User not found. Please sign up.' })
  }

  const result = verifyOTP(identifier, otp)
  if (!result.valid) return res.status(400).json({ message: result.message })

  user.otpVerified = true
  const token = generateToken(user)
  res.json({ user: safeUser(user), token })
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(safeUser(req.user))
})

// ── Role Activation Routes ────────────────────────────────
app.post('/api/user/activate-owner', authMiddleware, (req, res) => {
  req.user.isOwner = true
  if (req.user.role === 'user') req.user.role = 'owner'
  res.json({ message: 'Owner role activated!', user: safeUser(req.user) })
})

app.post('/api/user/activate-rider', authMiddleware, (req, res) => {
  req.user.isRider = true
  res.json({ message: 'Rider role activated!', user: safeUser(req.user) })
})

// ── Unified Items API ─────────────────────────────────────
app.get('/api/items', (req, res) => {
  const { type } = req.query
  const vehicleItems = vehicles.filter(v => v.status === 'approved').map(v => ({ ...v, category: 'vehicle' }))
  const accessoryItems = accessories.filter(a => a.availability).map(a => ({ ...a, category: 'accessory' }))
  if (type === 'vehicle') return res.json({ items: vehicleItems })
  if (type === 'accessory') return res.json({ items: accessoryItems })
  res.json({ items: [...vehicleItems, ...accessoryItems] })
})

app.get('/api/items/:id', (req, res) => {
  const v = vehicles.find(v => v._id === req.params.id)
  if (v) return res.json({ ...v, category: 'vehicle' })
  const a = accessories.find(a => a._id === req.params.id)
  if (a) return res.json({ ...a, category: 'accessory' })
  res.status(404).json({ message: 'Item not found' })
})

app.post('/api/items', authMiddleware, kycRequired, (req, res) => {
  if (!req.user.isOwner) return res.status(403).json({ message: 'Activate owner role first.' })
  const { name, type, pricePerDay, description, location } = req.body
  if (type === 'accessory') {
    const item = { _id: `a${nextAccessoryId++}`, name: name || 'Unnamed', category: 'accessory', pricePerDay: Number(pricePerDay) || 30, description: description || '', availability: true, ownerId: { _id: req.user._id, name: req.user.name }, rating: 0, totalReviews: 0, location: location || 'Dibrugarh', images: [] }
    accessories.push(item)
    return res.status(201).json(item)
  }
  res.status(400).json({ message: 'Use /api/vehicles for vehicle listings.' })
})

// ── Vehicle Routes ─────────────────────────────────────────
app.get('/api/vehicles', (req, res) => {
  const approved = vehicles.filter((v) => v.status === 'approved')
  res.json({ vehicles: approved })
})

app.get('/api/vehicles/my', authMiddleware, (req, res) => {
  const owned = vehicles.filter(
    (v) => v.ownerId?._id === req.user._id || v.ownerId === req.user._id
  )
  res.json({ vehicles: owned })
})

app.get('/api/vehicles/:id', (req, res) => {
  const v = vehicles.find((v) => v._id === req.params.id)
  if (!v) return res.status(404).json({ message: 'Vehicle not found' })
  res.json(v)
})

app.post('/api/vehicles', authMiddleware, kycRequired, (req, res) => {
  const { name, type, pricePerHour, pricePerDay, location, description, year } = req.body
  const newVehicle = {
    _id: `v${nextVehicleId++}`,
    name: name || 'Unnamed Vehicle',
    type: type || 'bike',
    pricePerHour: Number(pricePerHour) || 50,
    pricePerDay: Number(pricePerDay) || 300,
    status: 'pending',
    isLive: true,
    rating: 0,
    totalReviews: 0,
    location: location || 'Dibrugarh',
    description: description || '',
    specs: { year: Number(year) || 2024, fuel: 'Petrol', transmission: type === 'scooty' ? 'Automatic' : 'Manual' },
    images: [],
    ownerId: { _id: req.user._id, name: req.user.name },
    owner: { name: req.user.name, rating: 4.5, totalTrips: 0 },
  }
  vehicles.push(newVehicle)
  res.status(201).json(newVehicle)
})

app.put('/api/vehicles/:id', authMiddleware, (req, res) => {
  const idx = vehicles.findIndex((v) => v._id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'Vehicle not found' })
  vehicles[idx] = { ...vehicles[idx], ...req.body }
  res.json(vehicles[idx])
})

// ── Toggle Vehicle LIVE/OFFLINE status (owner only) ──────
app.patch('/api/vehicles/:id/toggle-status', authMiddleware, (req, res) => {
  const v = vehicles.find((v) => v._id === req.params.id)
  if (!v) return res.status(404).json({ message: 'Vehicle not found' })
  // Only the owner can toggle
  const ownerId = v.ownerId?._id || v.ownerId
  if (ownerId !== req.user._id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only the vehicle owner can change status' })
  }
  v.isLive = !v.isLive
  console.log(`  🔄 Vehicle ${v.name} is now ${v.isLive ? 'LIVE 🟢' : 'OFFLINE 🔴'}`)
  res.json(v)
})

app.delete('/api/vehicles/:id', authMiddleware, (req, res) => {
  const idx = vehicles.findIndex((v) => v._id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'Vehicle not found' })
  vehicles.splice(idx, 1)
  res.json({ message: 'Vehicle deleted' })
})

// ── Booking Routes ─────────────────────────────────────────
app.post('/api/bookings', authMiddleware, kycRequired, (req, res) => {
  const { items: bookingItems, startTime, endTime, agreementAccepted, vehicleId } = req.body
  // Enforce rental agreement
  if (!agreementAccepted) {
    return res.status(400).json({ message: 'You must accept the rental agreement to proceed.' })
  }
  const ms = new Date(endTime) - new Date(startTime)
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
  const hours = Math.ceil(ms / (1000 * 60 * 60))
  // Support both legacy single-vehicle and new multi-item
  let resolvedItems = []
  if (bookingItems && Array.isArray(bookingItems) && bookingItems.length > 0) {
    for (const bi of bookingItems) {
      const v = vehicles.find(x => x._id === bi.itemId)
      const a = accessories.find(x => x._id === bi.itemId)
      const item = v || a
      if (!item) continue
      const price = v ? (hours * (v.pricePerHour || 0)) : (days * (a.pricePerDay || 0))
      resolvedItems.push({ itemId: item._id, name: item.name || v?.name, type: v ? 'vehicle' : 'accessory', price })
    }
  } else if (vehicleId) {
    const v = vehicles.find(x => x._id === vehicleId)
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    resolvedItems.push({ itemId: v._id, name: v.name, type: 'vehicle', price: hours * v.pricePerHour })
  }
  if (resolvedItems.length === 0) return res.status(400).json({ message: 'No valid items selected.' })
  const totalAmount = resolvedItems.reduce((s, i) => s + i.price, 0)
  const booking = {
    _id: `b${nextBookingId++}`,
    userId: { _id: req.user._id, name: req.user.name },
    items: resolvedItems,
    startTime, endTime,
    status: 'confirmed',
    totalAmount,
    agreementAccepted: true,
    agreementTimestamp: new Date().toISOString(),
  }
  bookings.push(booking)
  res.status(201).json(booking)
})

app.get('/api/bookings/my', authMiddleware, (req, res) => {
  const userBookings = bookings.filter((b) => b.userId?._id === req.user._id)
  res.json({ bookings: userBookings })
})

app.get('/api/bookings', authMiddleware, (req, res) => {
  if (req.user.role === 'admin') {
    return res.json({ bookings })
  }
  // For owners, return bookings on their vehicles
  const ownerVehicleIds = vehicles
    .filter((v) => v.ownerId?._id === req.user._id)
    .map((v) => v._id)
  const ownerBookings = bookings.filter((b) => ownerVehicleIds.includes(b.vehicleId?._id))
  res.json({ bookings: ownerBookings })
})

app.get('/api/bookings/:id', authMiddleware, (req, res) => {
  const b = bookings.find((b) => b._id === req.params.id)
  if (!b) return res.status(404).json({ message: 'Booking not found' })
  res.json(b)
})

app.patch('/api/bookings/:id/cancel', authMiddleware, (req, res) => {
  const b = bookings.find((b) => b._id === req.params.id)
  if (!b) return res.status(404).json({ message: 'Booking not found' })
  b.status = 'cancelled'
  res.json(b)
})

// ── User Routes ────────────────────────────────────────────
app.get('/api/users/profile', authMiddleware, (req, res) => {
  res.json(safeUser(req.user))
})

app.put('/api/users/profile', authMiddleware, (req, res) => {
  const idx = users.findIndex((u) => u._id === req.user._id)
  const { name, email, phone } = req.body
  if (name) users[idx].name = name
  if (email) users[idx].email = email
  if (phone) users[idx].phone = phone
  res.json({ user: safeUser(users[idx]) })
})

app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
  res.json({ users: users.map(safeUser) })
})

app.patch('/api/users/:id/role', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
  const user = users.find((u) => u._id === req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found' })
  user.role = req.body.role
  res.json(safeUser(user))
})

app.delete('/api/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
  const idx = users.findIndex((u) => u._id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'User not found' })
  users.splice(idx, 1)
  res.json({ message: 'User deleted' })
})

// ── Admin Routes ───────────────────────────────────────────
app.get('/api/admin/stats', authMiddleware, (req, res) => {
  res.json({
    users: users.length,
    vehicles: vehicles.filter((v) => v.status === 'approved').length,
    bookings: bookings.length,
    pendingListings: vehicles.filter((v) => v.status === 'pending').length,
  })
})

app.patch('/api/admin/vehicles/:id/approve', authMiddleware, (req, res) => {
  const v = vehicles.find((v) => v._id === req.params.id)
  if (!v) return res.status(404).json({ message: 'Vehicle not found' })
  v.status = 'approved'
  res.json(v)
})

app.patch('/api/admin/vehicles/:id/reject', authMiddleware, (req, res) => {
  const v = vehicles.find((v) => v._id === req.params.id)
  if (!v) return res.status(404).json({ message: 'Vehicle not found' })
  v.status = 'rejected'
  res.json(v)
})

// ── Razorpay Payment Order Creation ────────────────────────
app.post('/api/payments/create-order', authMiddleware, async (req, res) => {
  const { amount, receipt, notes } = req.body
  if (!amount) {
    return res.status(400).json({ message: 'Amount is required' })
  }
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID'
    if (!keyId || keyId.startsWith('YOUR_') || keyId === '') {
      const mockOrder = {
        id: `order_mock_${Date.now()}`,
        entity: 'order',
        amount: Math.round(amount * 100),
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency: 'INR',
        receipt: receipt || `rcpt_${Date.now()}`,
        status: 'created',
        attempts: 0,
        notes: notes || {},
        created_at: Math.floor(Date.now() / 1000),
        isMock: true
      }
      return res.status(200).json(mockOrder)
    }

    const options = {
      amount: Math.round(amount * 100), // amount in paisa
      currency: 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {}
    }
    const order = await razorpay.orders.create(options)
    res.status(200).json(order)
  } catch (error) {
    console.error('Error creating Razorpay order:', error)
    res.status(500).json({ message: 'Failed to create order', error: error.message })
  }
})

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('')
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log('  ║                                              ║')
  console.log(`  ║   🏍️  LUPU API Server → http://localhost:${PORT}  ║`)
  console.log('  ║                                              ║')
  console.log('  ║   Test accounts:                             ║')
  console.log('  ║   admin@lupu.in  / admin123  (Admin)        ║')
  console.log('  ║   rahul@lupu.in  / owner123  (Owner)        ║')
  console.log('  ║   priya@lupu.in  / user1234  (User)         ║')
  console.log('  ║                                              ║')
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
})
