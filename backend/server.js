/**
 * LUPU — Production API Server
 *
 * Phase 1.1: MongoDB-backed Express server.
 * All data is persisted in MongoDB. Seeded on first boot if collections empty.
 *
 * Run: node server.js
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import Razorpay from 'razorpay'

import User from './models/User.js'
import Vehicle from './models/Vehicle.js'
import Booking from './models/Booking.js'
import Accessory from './models/Accessory.js'
import { seedDatabase } from './seed.js'

const app = express()
const PORT = process.env.PORT || 5001
const JWT_SECRET = process.env.JWT_SECRET || 'lupu-dev-fallback-secret'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lupu'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET',
})

// ── Middleware ──────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Request logger ─────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`  → ${req.method} ${req.path}`)
  next()
})

// ── OTP Store (in-memory, expires after 5 min) ────────────
// Acceptable for Phase 1.1 — Phase 1.2 can move this to Redis
const otpStore = new Map()
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

// ── Auth Helpers ───────────────────────────────────────────
function generateToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET)
    const user = await User.findById(decoded.id).lean()
    if (!user) return res.status(401).json({ message: 'User not found' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

function safeUser(u) {
  // eslint-disable-next-line no-unused-vars
  const { password, __v, ...rest } = u
  return rest
}

// KYC placeholder — not enforced in Phase 1.1
function kycRequired(_req, _res, next) {
  next()
}

// ── Auth Routes ────────────────────────────────────────────

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) return res.status(400).json({ message: 'Email or phone required' })

    const existing = otpStore.get(identifier)
    if (existing && existing.expiresAt - OTP_EXPIRY_MS + 60000 > Date.now()) {
      return res.status(429).json({ message: 'OTP already sent. Please wait 60 seconds.' })
    }

    const code = generateOTP()
    storeOTP(identifier, code)
    console.log(`  🔐 OTP for ${identifier}: ${code}`)
    const response = { message: 'OTP sent successfully' }
    if (process.env.NODE_ENV !== 'production') response._dev_otp = code
    res.json(response)
  } catch (err) {
    console.error('send-otp error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { identifier, otp, name, role = 'user' } = req.body
    if (!name || !identifier || !otp) {
      return res.status(400).json({ message: 'Name, identifier, and OTP are required' })
    }

    const isEmail = identifier.includes('@')
    const query = isEmail ? { email: identifier } : { phone: identifier }
    const exists = await User.findOne(query)
    if (exists) return res.status(409).json({ message: 'Account already exists. Please log in.' })

    const result = verifyOTP(identifier, otp)
    if (!result.valid) return res.status(400).json({ message: result.message })

    const newUser = await User.create({
      name,
      email: isEmail ? identifier : undefined,
      phone: !isEmail ? identifier : undefined,
      role: ['user', 'owner'].includes(role) ? role : 'user',
      isRider: true,
      isOwner: role === 'owner',
      otpVerified: true,
    })

    const token = generateToken(newUser)
    res.status(201).json({ user: safeUser(newUser.toObject()), token })
  } catch (err) {
    console.error('signup error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Account already exists. Please log in.' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, otp } = req.body
    if (!identifier || !otp) {
      return res.status(400).json({ message: 'Identifier and OTP are required' })
    }

    const isEmail = identifier.includes('@')
    const query = isEmail ? { email: identifier } : { phone: identifier }
    const user = await User.findOne(query)
    if (!user) return res.status(404).json({ message: 'User not found. Please sign up.' })

    const result = verifyOTP(identifier, otp)
    if (!result.valid) return res.status(400).json({ message: result.message })

    await User.findByIdAndUpdate(user._id, { otpVerified: true })
    const updatedUser = await User.findById(user._id).lean()

    const token = generateToken(updatedUser)
    res.json({ user: safeUser(updatedUser), token })
  } catch (err) {
    console.error('login error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(safeUser(req.user))
})

app.post('/api/auth/verify-contact', authMiddleware, async (req, res) => {
  try {
    const { identifier, otp } = req.body
    if (!identifier || !otp) return res.status(400).json({ message: 'Identifier and OTP required' })

    const validOtp = otpStore.get(identifier)
    if (!validOtp || validOtp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' })
    }

    otpStore.delete(identifier)

    const isEmail = identifier.includes('@')
    const updates = isEmail ? { emailVerified: true } : { phoneVerified: true, phone: identifier }
    
    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, { new: true, lean: true })
    res.json({ message: 'Contact verified successfully', user: safeUser(updatedUser) })
  } catch (err) {
    console.error('Verify contact error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Role Activation Routes ────────────────────────────────

app.post('/api/user/activate-owner', authMiddleware, async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { isOwner: true, role: req.user.role === 'user' ? 'owner' : req.user.role },
      { new: true, lean: true }
    )
    res.json({ message: 'Owner role activated!', user: safeUser(updated) })
  } catch (err) {
    console.error('activate-owner error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/user/activate-rider', authMiddleware, async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { isRider: true },
      { new: true, lean: true }
    )
    res.json({ message: 'Rider role activated!', user: safeUser(updated) })
  } catch (err) {
    console.error('activate-rider error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Unified Items API ─────────────────────────────────────

app.get('/api/items', async (req, res) => {
  try {
    const { type } = req.query
    if (type === 'vehicle') {
      const vehicles = await Vehicle.find({ status: 'approved' }).lean()
      return res.json({ items: vehicles.map(v => ({ ...v, category: 'vehicle' })) })
    }
    if (type === 'accessory') {
      const accessories = await Accessory.find({ availability: true }).lean()
      return res.json({ items: accessories.map(a => ({ ...a, category: 'accessory' })) })
    }
    const [vehicles, accessories] = await Promise.all([
      Vehicle.find({ status: 'approved' }).lean(),
      Accessory.find({ availability: true }).lean(),
    ])
    const items = [
      ...vehicles.map(v => ({ ...v, category: 'vehicle' })),
      ...accessories.map(a => ({ ...a, category: 'accessory' })),
    ]
    res.json({ items })
  } catch (err) {
    console.error('GET /api/items error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params
    // Try Vehicle first, then Accessory
    if (mongoose.Types.ObjectId.isValid(id)) {
      const v = await Vehicle.findById(id).lean()
      if (v) return res.json({ ...v, category: 'vehicle' })
      const a = await Accessory.findById(id).lean()
      if (a) return res.json({ ...a, category: 'accessory' })
    }
    res.status(404).json({ message: 'Item not found' })
  } catch (err) {
    console.error('GET /api/items/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/items', authMiddleware, kycRequired, async (req, res) => {
  try {
    if (!req.user.isOwner) {
      return res.status(403).json({ message: 'Activate owner role first.' })
    }
    const { name, type, pricePerDay, description, location } = req.body
    if (type === 'accessory') {
      const item = await Accessory.create({
        name: name || 'Unnamed',
        category: 'accessory',
        pricePerDay: Number(pricePerDay) || 30,
        description: description || '',
        availability: true,
        ownerId: req.user._id,
        owner: { name: req.user.name },
        location: location || 'Dibrugarh',
        images: [],
      })
      return res.status(201).json(item.toObject())
    }
    res.status(400).json({ message: 'Use /api/vehicles for vehicle listings.' })
  } catch (err) {
    console.error('POST /api/items error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Vehicle Routes ─────────────────────────────────────────

app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ status: 'approved' }).lean()
    res.json({ vehicles })
  } catch (err) {
    console.error('GET /api/vehicles error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/vehicles/my', authMiddleware, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ ownerId: req.user._id }).lean()
    res.json({ vehicles })
  } catch (err) {
    console.error('GET /api/vehicles/my error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const v = await Vehicle.findById(req.params.id).lean()
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(v)
  } catch (err) {
    console.error('GET /api/vehicles/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/vehicles', authMiddleware, kycRequired, async (req, res) => {
  try {
    if (!req.user.isOwner) {
      return res.status(403).json({ message: 'Activate owner role first.' })
    }
    const { name, type, pricePerHour, pricePerDay, location, description, year } = req.body
    if (!name || !type || !pricePerHour || !location) {
      return res.status(400).json({ message: 'name, type, pricePerHour, and location are required' })
    }
    const newVehicle = await Vehicle.create({
      name,
      type: type || 'bike',
      pricePerHour: Number(pricePerHour) || 50,
      pricePerDay: Number(pricePerDay) || 300,
      status: 'pending',
      isLive: true,
      location: location || 'Dibrugarh',
      description: description || '',
      specs: {
        year: Number(year) || new Date().getFullYear(),
        fuel: 'Petrol',
        transmission: type === 'scooty' ? 'Automatic' : 'Manual',
      },
      images: [],
      ownerId: req.user._id,
      owner: { name: req.user.name, rating: 0, totalTrips: 0 },
    })
    res.status(201).json(newVehicle.toObject())
  } catch (err) {
    console.error('POST /api/vehicles error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.put('/api/vehicles/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const vehicle = await Vehicle.findById(req.params.id)
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })

    const ownerId = vehicle.ownerId?.toString()
    if (ownerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: not your vehicle' })
    }

    // Prevent status from being changed via this route (use admin routes instead)
    const { status, ownerId: _ownerId, ...updateFields } = req.body
    const updated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true, lean: true }
    )
    res.json(updated)
  } catch (err) {
    console.error('PUT /api/vehicles/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/vehicles/:id/toggle-status', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const vehicle = await Vehicle.findById(req.params.id)
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })

    const ownerId = vehicle.ownerId?.toString()
    if (ownerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the vehicle owner can change status' })
    }

    vehicle.isLive = !vehicle.isLive
    await vehicle.save()
    console.log(`  🔄 Vehicle ${vehicle.name} is now ${vehicle.isLive ? 'LIVE 🟢' : 'OFFLINE 🔴'}`)
    res.json(vehicle.toObject())
  } catch (err) {
    console.error('PATCH toggle-status error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.delete('/api/vehicles/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const vehicle = await Vehicle.findById(req.params.id)
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })

    const ownerId = vehicle.ownerId?.toString()
    if (ownerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: not your vehicle' })
    }

    await Vehicle.findByIdAndDelete(req.params.id)
    res.json({ message: 'Vehicle deleted' })
  } catch (err) {
    console.error('DELETE /api/vehicles/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Booking Routes ─────────────────────────────────────────

app.post('/api/bookings', authMiddleware, kycRequired, async (req, res) => {
  try {
    const { items: bookingItems, startTime, endTime, agreementAccepted, vehicleId } = req.body

    if (!agreementAccepted) {
      return res.status(400).json({ message: 'You must accept the rental agreement to proceed.' })
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'startTime and endTime are required.' })
    }

    const ms = new Date(endTime) - new Date(startTime)
    if (ms <= 0) {
      return res.status(400).json({ message: 'endTime must be after startTime.' })
    }
    const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
    const hours = Math.ceil(ms / (1000 * 60 * 60))

    let resolvedItems = []

    if (bookingItems && Array.isArray(bookingItems) && bookingItems.length > 0) {
      for (const bi of bookingItems) {
        // Try Vehicle first, then Accessory
        let item = null
        let itemType = null
        let price = 0

        if (mongoose.Types.ObjectId.isValid(bi.itemId)) {
          const v = await Vehicle.findById(bi.itemId).lean()
          if (v) {
            item = v
            itemType = 'vehicle'
            price = hours * (v.pricePerHour || 0)
          } else {
            const a = await Accessory.findById(bi.itemId).lean()
            if (a) {
              item = a
              itemType = 'accessory'
              price = days * (a.pricePerDay || 0)
            }
          }
        }

        if (!item) continue
        resolvedItems.push({
          itemId: item._id.toString(),
          name: item.name,
          type: itemType,
          price,
        })
      }
    } else if (vehicleId) {
      // Legacy single-vehicle support
      if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
        return res.status(404).json({ message: 'Vehicle not found' })
      }
      const v = await Vehicle.findById(vehicleId).lean()
      if (!v) return res.status(404).json({ message: 'Vehicle not found' })
      resolvedItems.push({
        itemId: v._id.toString(),
        name: v.name,
        type: 'vehicle',
        price: hours * v.pricePerHour,
      })
    }

    if (resolvedItems.length === 0) {
      return res.status(400).json({ message: 'No valid items selected.' })
    }

    const totalAmount = resolvedItems.reduce((s, i) => s + i.price, 0)
    const booking = await Booking.create({
      userId: req.user._id,
      items: resolvedItems,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'confirmed',
      totalAmount,
      agreementAccepted: true,
      agreementTimestamp: new Date(),
    })

    // Populate userId for response shape compatibility
    const populated = await Booking.findById(booking._id).populate('userId', 'name').lean()
    res.status(201).json(populated)
  } catch (err) {
    console.error('POST /api/bookings error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/bookings/my', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ bookings })
  } catch (err) {
    console.error('GET /api/bookings/my error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const bookings = await Booking.find()
        .populate('userId', 'name')
        .sort({ createdAt: -1 })
        .lean()
      return res.json({ bookings })
    }

    // For owners — bookings that contain their vehicles
    const ownerVehicles = await Vehicle.find({ ownerId: req.user._id }, '_id').lean()
    const ownerVehicleIds = ownerVehicles.map(v => v._id.toString())
    const bookings = await Booking.find({
      'items.itemId': { $in: ownerVehicleIds },
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ bookings })
  } catch (err) {
    console.error('GET /api/bookings error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const b = await Booking.findById(req.params.id).populate('userId', 'name').lean()
    if (!b) return res.status(404).json({ message: 'Booking not found' })
    res.json(b)
  } catch (err) {
    console.error('GET /api/bookings/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/bookings/:id/cancel', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const b = await Booking.findById(req.params.id)
    if (!b) return res.status(404).json({ message: 'Booking not found' })

    if (b.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: not your booking' })
    }
    if (b.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' })
    }

    b.status = 'cancelled'
    await b.save()
    res.json(b.toObject())
  } catch (err) {
    console.error('PATCH /api/bookings/:id/cancel error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── User Routes ────────────────────────────────────────────

app.get('/api/users/profile', authMiddleware, (req, res) => {
  res.json(safeUser(req.user))
})

app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone, avatar, college, address, notificationPreferences } = req.body
    const updates = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (avatar !== undefined) updates.avatar = avatar
    if (college !== undefined) updates.college = college
    if (address !== undefined) updates.address = address
    if (notificationPreferences !== undefined) updates.notificationPreferences = notificationPreferences

    const updated = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
      lean: true,
    })
    res.json({ user: safeUser(updated) })
  } catch (err) {
    console.error('PUT /api/users/profile error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email or phone already in use.' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/users/kyc', authMiddleware, async (req, res) => {
  try {
    const { collegeIdUrl, governmentIdUrl } = req.body
    if (!collegeIdUrl && !governmentIdUrl) {
      return res.status(400).json({ message: 'At least one ID is required' })
    }
    const updates = {
      kycStatus: 'pending',
      kycRejectionReason: null
    }
    if (collegeIdUrl) updates.collegeIdUrl = collegeIdUrl
    if (governmentIdUrl) updates.governmentIdUrl = governmentIdUrl
    
    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true, lean: true })
    res.json({ message: 'KYC submitted successfully', user: safeUser(updated) })
  } catch (err) {
    console.error('KYC submit error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    const users = await User.find().lean()
    res.json({ users: users.map(safeUser) })
  } catch (err) {
    console.error('GET /api/users error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/users/:id/role', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' })
    }
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true, runValidators: true, lean: true }
    )
    if (!updated) return res.status(404).json({ message: 'User not found' })
    res.json(safeUser(updated))
  } catch (err) {
    console.error('PATCH /api/users/:id/role error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' })
    }
    const deleted = await User.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ message: 'User not found' })
    res.json({ message: 'User deleted' })
  } catch (err) {
    console.error('DELETE /api/users/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/admin/users/:id/kyc', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    const { status, reason } = req.body
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    const updates = { kycStatus: status }
    if (status === 'rejected') updates.kycRejectionReason = reason || 'Your documents were rejected.'
    else updates.kycRejectionReason = null
    
    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true, lean: true })
    if (!updated) return res.status(404).json({ message: 'User not found' })
    res.json({ message: `KYC ${status}`, user: safeUser(updated) })
  } catch (err) {
    console.error('Admin KYC update error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Admin Routes ───────────────────────────────────────────

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    const [totalUsers, totalVehicles, totalBookings, pendingListings] = await Promise.all([
      User.countDocuments(),
      Vehicle.countDocuments({ status: 'approved' }),
      Booking.countDocuments(),
      Vehicle.countDocuments({ status: 'pending' }),
    ])
    res.json({ users: totalUsers, vehicles: totalVehicles, bookings: totalBookings, pendingListings })
  } catch (err) {
    console.error('GET /api/admin/stats error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/admin/vehicles/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const v = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true, lean: true }
    )
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(v)
  } catch (err) {
    console.error('PATCH approve error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/admin/vehicles/:id/reject', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const v = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true, lean: true }
    )
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(v)
  } catch (err) {
    console.error('PATCH reject error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Razorpay Payment Order Creation ────────────────────────

app.post('/api/payments/create-order', authMiddleware, async (req, res) => {
  const { amount, receipt, notes } = req.body
  if (!amount) {
    return res.status(400).json({ message: 'Amount is required' })
  }
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || ''
    if (!keyId || keyId.startsWith('YOUR_') || keyId === '') {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ message: 'Razorpay key not configured for production' })
      }
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
        isMock: true,
      }
      return res.status(200).json(mockOrder)
    }
    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: notes || {},
    }
    const order = await razorpay.orders.create(options)
    res.status(200).json(order)
  } catch (error) {
    console.error('Razorpay order error:', error)
    res.status(500).json({ message: 'Failed to create order', error: error.message })
  }
})

// ── Health Check ───────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  const mongoStatus = mongoose.connection.readyState
  const statusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: statusMap[mongoStatus] || 'unknown',
  })
})

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` })
})

// ── Global error handler ───────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: 'Internal server error' })
})



// ── Start ──────────────────────────────────────────────────
async function start() {
  try {
    console.log('')
    console.log('  🔌 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log(`  ✅ MongoDB connected: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`)

    await seedDatabase()

    app.listen(PORT, () => {
      console.log('')
      console.log('  ╔══════════════════════════════════════════════════╗')
      console.log('  ║                                                  ║')
      console.log(`  ║   🏍️  LUPU API  →  http://localhost:${PORT}          ║`)
      console.log('  ║   📦  Storage   →  MongoDB (persistent)          ║')
      console.log('  ║   🔑  Auth      →  OTP (in-memory, 5 min TTL)   ║')
      console.log('  ║                                                  ║')
      console.log('  ╚══════════════════════════════════════════════════╝')
      console.log('')
    })
  } catch (err) {
    console.error('  ❌ Failed to connect to MongoDB:', err.message)
    console.error('  💡 Check that MongoDB is running or update MONGODB_URI in .env')
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close()
  console.log('\n  👋 MongoDB disconnected. Server stopped.')
  process.exit(0)
})

start()
