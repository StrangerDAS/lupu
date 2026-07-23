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
import mongoose from 'mongoose'
import Razorpay from 'razorpay'
import path from 'path'
import { fileURLToPath } from 'url'

import User from './models/User.js'
import Vehicle from './models/Vehicle.js'
import Booking from './models/Booking.js'
import Accessory from './models/Accessory.js'
import Payment from './models/Payment.js'
import Notification from './models/Notification.js'
import Email from './models/Email.js'
import Review from './models/Review.js'
import Report from './models/Report.js'
import Dispute from './models/Dispute.js'
import SOS from './models/SOS.js'
import { seedDatabase } from './seed.js'
import { attachVehicleAvailability, checkOverlap } from './utils/availability.js'
import { kycUpload, vehicleUpload } from './middleware/uploadMiddleware.js'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { rateLimiter } from './middleware/rateLimiter.js'
import { verifyFirebaseToken, requireMongoUser } from './middleware/authMiddleware.js'

// Role-based authorization helper
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import paymentRoutes from './routes/paymentRoutes.js'

const app = express()
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/payment', paymentRoutes)

const PORT = process.env.PORT || 5001

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lupu'

let razorpay = null
try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_RAZORPAY_KEY_SECRET',
  })
} catch (err) {
  console.error('Failed to initialize Razorpay SDK:', err.message)
}

// ── Middleware ──────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:4173',
      'https://lupu.in',
      'https://www.lupu.in'
    ]

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, curl, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: Origin '${origin}' not allowed`))
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions)) // Ensure OPTIONS preflight requests are handled correctly globally
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Request logger ─────────────────────────────────────────
app.use((req, _res, next) => {
  logger.debug(`→ ${req.method} ${req.path}`)
  next()
})

// ── Auth Helpers ───────────────────────────────────────────
function safeUser(u) {
  // eslint-disable-next-line no-unused-vars
  const { password, __v, ...rest } = u
  return rest
}

// KYC placeholder — not enforced yet; will enforce in a future sprint
function kycPlaceholder(_req, _res, next) {
  next()
}

// ── Auth Routes ────────────────────────────────────────────

// 1. Firebase Login / Sync Route
// The frontend calls this AFTER successful Firebase authentication
app.post('/api/auth/login', verifyFirebaseToken, async (req, res, next) => {
  try {
    const firebaseUser = req.firebaseUser // Set by middleware
    const { name, role } = req.body

    // The user might already exist (we checked in middleware, req.user might be set)
    let user = req.user

    if (!user) {
      // First time login - create the user profile in MongoDB
      user = new User({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: name || firebaseUser.name || 'LUPU User',
        role: role || 'user',
        isRider: true,
        isOwner: role === 'owner',
        emailVerified: firebaseUser.email_verified,
        ...(firebaseUser.phone_number && { phone: firebaseUser.phone_number }),
        lastLogin: new Date()
      })
      await user.save()
    } else {
      // Sync email verification status, firebaseUid, and lastLogin
      user.firebaseUid = firebaseUser.uid
      user.lastLogin = new Date()
      if (firebaseUser.email_verified && !user.emailVerified) {
        user.emailVerified = true
      }
      await user.save()
    }

    // Return the MongoDB user profile
    res.json({
      message: 'Login successful',
      user: safeUser(user.toObject())
    })
  } catch (err) {
    next(err)
  }
})

// 2. Auth ME route (validate session)
app.get('/api/auth/me', verifyFirebaseToken, requireMongoUser, (req, res) => {
  res.json({ user: safeUser(req.user.toObject()) })
})

// 3. Update Profile route
app.put('/api/auth/profile', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { name, phone } = req.body
    if (name) req.user.name = name
    if (phone) req.user.phone = phone
    await req.user.save()
    res.json({ user: safeUser(req.user.toObject()) })
  } catch (err) {
    next(err)
  }
})

// ── Role Activation Routes ────────────────────────────────

app.post('/api/user/activate-owner', verifyFirebaseToken, requireMongoUser, async (req, res) => {
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

app.post('/api/user/activate-rider', verifyFirebaseToken, requireMongoUser, async (req, res) => {
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

app.post('/api/items', verifyFirebaseToken, requireMongoUser, authorize('owner', 'admin'), kycPlaceholder, async (req, res, next) => {
  try {
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
    next(err)
  }
})

// ── Vehicle Routes ─────────────────────────────────────────

app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await Vehicle.aggregate([
      { $match: { verificationStatus: 'approved', isLive: true } },
      { $lookup: {
          from: 'bookings',
          let: { vId: '$_id' },
          pipeline: [
            { $match: {
                $expr: { $eq: ['$vehicleId', '$$vId'] },
                status: { $in: ['confirmed', 'ongoing', 'ready_for_pickup'] },
                endTime: { $gt: new Date() }
              }
            },
            { $sort: { startTime: 1 } }
          ],
          as: 'activeBookings'
      }}
    ])
    
    const vehiclesWithAvailability = vehicles.map(v => {
      const { activeBookings, ...vehicleData } = v
      return attachVehicleAvailability(vehicleData, activeBookings)
    })
    
    res.json({ vehicles: vehiclesWithAvailability })
  } catch (err) {
    console.error('GET /api/vehicles error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/vehicles/my', verifyFirebaseToken, requireMongoUser, async (req, res) => {
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
    const vehicles = await Vehicle.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      { $lookup: {
          from: 'bookings',
          let: { vId: '$_id' },
          pipeline: [
            { $match: {
                $expr: { $eq: ['$vehicleId', '$$vId'] },
                status: { $in: ['confirmed', 'ongoing', 'ready_for_pickup'] },
                endTime: { $gt: new Date() }
              }
            },
            { $sort: { startTime: 1 } }
          ],
          as: 'activeBookings'
      }}
    ])
    
    if (!vehicles || vehicles.length === 0) return res.status(404).json({ message: 'Vehicle not found' })
    
    const v = vehicles[0]
    const { activeBookings, ...vehicleData } = v
    const vWithAvailability = attachVehicleAvailability(vehicleData, activeBookings)
    
    res.json(vWithAvailability)
  } catch (err) {
    console.error('GET /api/vehicles/:id error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.post('/api/vehicles', verifyFirebaseToken, requireMongoUser, authorize('owner', 'admin'), kycPlaceholder, vehicleUpload, async (req, res) => {
  try {
    const {
      name, brand, model, type, pricePerHour, pricePerDay, securityDeposit,
      location, description, year, fuel, transmission, helmetAvailable,
      verificationStatus
    } = req.body

    const rcFile = req.files?.['RC']?.[0]
    const insFile = req.files?.['Insurance']?.[0]
    const pucFile = req.files?.['PUC']?.[0]
    const photoFiles = req.files?.['photos'] || []

    const rcUrl = rcFile ? `/uploads/${rcFile.filename}` : (req.body.RC || req.body.documents?.RC)
    const insUrl = insFile ? `/uploads/${insFile.filename}` : (req.body.Insurance || req.body.documents?.Insurance)
    const pucUrl = pucFile ? `/uploads/${pucFile.filename}` : (req.body.PUC || req.body.documents?.PUC)
    const photoUrls = photoFiles.length > 0
      ? photoFiles.map(f => `/uploads/${f.filename}`)
      : (Array.isArray(req.body.photos) ? req.body.photos : (req.body.photos ? [req.body.photos] : []))

    const isSubmitting = verificationStatus === 'submitted' || !verificationStatus || verificationStatus === 'pending_verification'

    // Perform validation if submitting
    if (isSubmitting) {
      if (!name) return res.status(400).json({ message: 'Vehicle name is required' })
      if (!brand) return res.status(400).json({ message: 'Brand is required' })
      if (!model) return res.status(400).json({ message: 'Model is required' })
      if (!req.body.registrationNumber) return res.status(400).json({ message: 'Registration number is required' })
      if (!rcUrl) return res.status(400).json({ message: 'Registration Certificate (RC) document is required' })
      if (!insUrl) return res.status(400).json({ message: 'Insurance document is required' })
      if (!pucUrl) return res.status(400).json({ message: 'Pollution certificate (PUC) is required' })
      if (!pricePerHour || Number(pricePerHour) <= 0) return res.status(400).json({ message: 'Price per hour must be positive' })
      if (!description) return res.status(400).json({ message: 'Description is required' })
      if (photoUrls.length < 3) return res.status(400).json({ message: 'Minimum 3 photos are required' })
    }

    const vStatus = isSubmitting ? 'submitted' : 'draft'

    const newVehicle = await Vehicle.create({
      name,
      brand,
      model,
      registrationNumber: req.body.registrationNumber,
      type: type || 'bike',
      pricePerHour: Number(pricePerHour) || 0,
      pricePerDay: Number(pricePerDay) || 0,
      securityDeposit: Number(securityDeposit) || 0,
      location: location || 'Dibrugarh',
      description: description || '',
      helmetAvailable: helmetAvailable === 'true' || helmetAvailable === true,
      specs: {
        year: Number(year) || new Date().getFullYear(),
        fuel: fuel || 'Petrol',
        transmission: transmission || (type === 'scooty' ? 'Automatic' : 'Manual'),
      },
      documents: {
        RC: rcUrl,
        Insurance: insUrl,
        PUC: pucUrl
      },
      photos: photoUrls,
      images: photoUrls,
      verificationStatus: vStatus,
      submittedAt: isSubmitting ? new Date() : null,
      isLive: false,
      ownerId: req.user._id,
      owner: { name: req.user.name, rating: 0, totalTrips: 0 },
    })
    res.status(201).json(newVehicle.toObject())
  } catch (err) {
    console.error('POST /api/vehicles error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Vehicle registration number already registered' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.put('/api/vehicles/:id', verifyFirebaseToken, requireMongoUser, authorize('owner', 'admin'), vehicleUpload, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const vehicle = await Vehicle.findById(req.params.id)
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })

    const ownerId = vehicle.ownerId?.toString()
    if (ownerId !== req.user._id.toString() && !['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: not your vehicle' })
    }

    const {
      name, brand, model, type, pricePerHour, pricePerDay, securityDeposit,
      location, description, year, fuel, transmission, helmetAvailable,
      verificationStatus
    } = req.body

    const rcFile = req.files?.['RC']?.[0]
    const insFile = req.files?.['Insurance']?.[0]
    const pucFile = req.files?.['PUC']?.[0]
    const photoFiles = req.files?.['photos'] || []

    const rcUrl = rcFile ? `/uploads/${rcFile.filename}` : (req.body.RC || req.body.documents?.RC || vehicle.documents?.RC)
    const insUrl = insFile ? `/uploads/${insFile.filename}` : (req.body.Insurance || req.body.documents?.Insurance || vehicle.documents?.Insurance)
    const pucUrl = pucFile ? `/uploads/${pucFile.filename}` : (req.body.PUC || req.body.documents?.PUC || vehicle.documents?.PUC)
    
    let photoUrls = []
    if (photoFiles.length > 0) {
      photoUrls = photoFiles.map(f => `/uploads/${f.filename}`)
    } else {
      photoUrls = Array.isArray(req.body.photos) ? req.body.photos : (req.body.photos ? [req.body.photos] : (vehicle.photos || []))
    }

    const isSubmitting = verificationStatus === 'submitted' || (vehicle.verificationStatus === 'rejected' && verificationStatus === 'submitted')

    // Perform validation if submitting
    if (isSubmitting) {
      const vName = name || vehicle.name
      const vBrand = brand || vehicle.brand
      const vModel = model || vehicle.model
      const vReg = req.body.registrationNumber || vehicle.registrationNumber
      const vPrice = pricePerHour !== undefined ? pricePerHour : vehicle.pricePerHour
      const vDesc = description || vehicle.description

      if (!vName) return res.status(400).json({ message: 'Vehicle name is required' })
      if (!vBrand) return res.status(400).json({ message: 'Brand is required' })
      if (!vModel) return res.status(400).json({ message: 'Model is required' })
      if (!vReg) return res.status(400).json({ message: 'Registration number is required' })
      if (!rcUrl) return res.status(400).json({ message: 'Registration Certificate (RC) document is required' })
      if (!insUrl) return res.status(400).json({ message: 'Insurance document is required' })
      if (!pucUrl) return res.status(400).json({ message: 'Pollution certificate (PUC) is required' })
      if (!vPrice || Number(vPrice) <= 0) return res.status(400).json({ message: 'Price per hour must be positive' })
      if (!vDesc) return res.status(400).json({ message: 'Description is required' })
      if (photoUrls.length < 3) return res.status(400).json({ message: 'Minimum 3 photos are required' })
    }

    const updates = {
      documents: {
        RC: rcUrl,
        Insurance: insUrl,
        PUC: pucUrl
      },
      photos: photoUrls,
      images: photoUrls
    }

    if (name !== undefined) updates.name = name
    if (brand !== undefined) updates.brand = brand
    if (model !== undefined) updates.model = model
    if (req.body.registrationNumber !== undefined) updates.registrationNumber = req.body.registrationNumber
    if (type !== undefined) updates.type = type
    if (pricePerHour !== undefined) updates.pricePerHour = Number(pricePerHour)
    if (pricePerDay !== undefined) updates.pricePerDay = Number(pricePerDay)
    if (securityDeposit !== undefined) updates.securityDeposit = Number(securityDeposit)
    if (location !== undefined) updates.location = location
    if (description !== undefined) updates.description = description
    if (helmetAvailable !== undefined) updates.helmetAvailable = helmetAvailable === 'true' || helmetAvailable === true

    if (year !== undefined || fuel !== undefined || transmission !== undefined) {
      updates.specs = {
        year: year !== undefined ? Number(year) : (vehicle.specs?.year || new Date().getFullYear()),
        fuel: fuel !== undefined ? fuel : (vehicle.specs?.fuel || 'Petrol'),
        transmission: transmission !== undefined ? transmission : (vehicle.specs?.transmission || 'Manual')
      }
    }

    if (verificationStatus !== undefined) {
      updates.verificationStatus = verificationStatus
      if (verificationStatus === 'submitted') {
        updates.submittedAt = new Date()
        updates.rejectionReason = null
        updates.adminNotes = null
      }
    }

    const updated = await Vehicle.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
    res.json(updated.toObject())
  } catch (err) {
    next(err)
  }
})

app.patch('/api/vehicles/:id/toggle-status', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const vehicle = await Vehicle.findById(req.params.id)
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })

    const ownerId = vehicle.ownerId?.toString()
    if (ownerId !== req.user._id.toString() && !['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only the vehicle owner can change status' })
    }

    // Toggle live only if approved
    if (vehicle.verificationStatus !== 'approved') {
      return res.status(400).json({ message: 'Only approved vehicles can go live' })
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

app.delete('/api/vehicles/:id', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const vehicle = await Vehicle.findById(req.params.id)
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })

    const ownerId = vehicle.ownerId?.toString()
    if (ownerId !== req.user._id.toString() && !['admin', 'super_admin', 'founder'].includes(req.user.role)) {
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

app.get('/api/vehicles/:id/calendar', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const bookings = await Booking.find({
      vehicleId: id,
      status: { $in: ['requested', 'accepted', 'confirmed', 'ready_for_pickup', 'ongoing'] }
    }, 'startTime endTime status').lean()
    
    res.json({ bookings })
  } catch (err) {
    next(err)
  }
})

app.post('/api/bookings', verifyFirebaseToken, requireMongoUser, kycPlaceholder, async (req, res, next) => {
  try {
    const { startTime, endTime, agreementAccepted, agreementVersion, agreementAcceptedAt, vehicleId, verificationDetails } = req.body

    if (!agreementAccepted) {
      return res.status(400).json({ message: 'You must read and accept the mandatory Rental Agreement to proceed.' })
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'startTime and endTime are required.' })
    }
    if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ message: 'Valid vehicleId is required.' })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (end <= start) {
      return res.status(400).json({ message: 'Return date must be after pickup date.' })
    }

    // Leeway for past dates (15 minutes)
    const now = new Date()
    now.setMinutes(now.getMinutes() - 15)
    if (start < now) {
      return res.status(400).json({ message: 'Pickup date cannot be in the past.' })
    }

    // 1. Only Approved Vehicles can be booked
    const vehicle = await Vehicle.findById(vehicleId)
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' })
    }
    if (vehicle.verificationStatus !== 'approved' || vehicle.isLive === false) {
      return res.status(400).json({ message: 'This vehicle is currently offline or unapproved.' })
    }

    // 2. Only Verified Users can book
    if (req.user.kycStatus !== 'verified') {
      return res.status(400).json({ message: 'Only KYC-verified riders can request bookings. Please complete verification.' })
    }

    // 3. Owner cannot book own vehicle
    if (vehicle.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owners cannot book their own vehicles.' })
    }

    // 4. Overlapping Dates Check
    const overlapping = await Booking.findOne({
      vehicleId,
      status: { $in: ['confirmed', 'ongoing', 'ready_for_pickup'] },
      startTime: { $lt: end },
      endTime: { $gt: start }
    })
    if (overlapping) {
      return res.status(400).json({ message: 'The vehicle is already booked for these dates.' })
    }

    const hours = Math.ceil((end - start) / (1000 * 60 * 60))
    const rentalAmount = hours * vehicle.pricePerHour
    const bookingFee = 0 // Removed for Beta
    const totalAmount = rentalAmount
    const advanceAmount = Math.round(rentalAmount * 0.3)
    const remainingAmount = rentalAmount - advanceAmount

    const newBooking = await Booking.create({
      vehicleId: vehicle._id,
      ownerId: vehicle.ownerId,
      renterId: req.user._id,
      startTime: start,
      endTime: end,
      status: 'Requested',
      price: totalAmount,
      deposit: vehicle.securityDeposit || 0,
      duration: hours,
      vehicleName: vehicle.name,
      vehicleType: vehicle.type,
      renterName: req.user.name,
      renterEmail: req.user.email || '',
      ownerName: vehicle.owner?.name || 'Owner',
      pricing: {
        total: totalAmount,
        advance: advanceAmount,
        remaining: remainingAmount
      },
      rentalAmount,
      bookingFee,
      totalAmount,
      advanceAmount,
      remainingAmount,
      paymentStatus: 'Pending',
      ownerPaymentStatus: 'Pending Pickup',
      verificationDetails,
      agreementAccepted: true,
      agreementVersion: agreementVersion || 'Beta v1.0',
      agreementAcceptedAt: agreementAcceptedAt || new Date(),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
      agreementTimestamp: new Date(),
    })

    // Trigger Notifications for booking requested
    await sendNotification(vehicle.ownerId, {
      type: 'booking',
      title: 'New Booking Request! 📅',
      message: `You have received a booking request for ${vehicle.name}.`,
      bookingId: newBooking._id,
      vehicleId: vehicle._id
    })
    await sendNotification(req.user._id, {
      type: 'booking',
      title: 'Booking Request Submitted 🚀',
      message: `Your request for ${vehicle.name} has been sent to the owner.`,
      bookingId: newBooking._id,
      vehicleId: vehicle._id
    })

    res.status(201).json(newBooking.toObject())
  } catch (err) {
    next(err)
  }
})

app.get('/api/bookings/my', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ renterId: req.user._id })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ bookings })
  } catch (err) {
    next(err)
  }
})

app.get('/api/bookings', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    let query = {}
    if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      // Return bookings where user is renter OR owner
      query = {
        $or: [
          { renterId: req.user._id },
          { ownerId: req.user._id }
        ]
      }
    }
    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .lean()
    res.json({ bookings })
  } catch (err) {
    next(err)
  }
})

app.get('/api/bookings/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const booking = await Booking.findById(req.params.id).lean()
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = booking.renterId?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    res.json(booking)
  } catch (err) {
    next(err)
  }
})

app.put('/api/bookings/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = booking.renterId?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Allow partial updates of nested objects (handoverDetails, verificationDetails)
    if (req.body.handoverDetails) {
      booking.handoverDetails = {
        ...booking.handoverDetails?.toObject(),
        ...req.body.handoverDetails
      }
    }
    if (req.body.verificationDetails) {
      booking.verificationDetails = {
        ...booking.verificationDetails?.toObject(),
        ...req.body.verificationDetails
      }
    }
    if (req.body.status) {
      booking.status = req.body.status
    }

    await booking.save()
    res.json(booking.toObject())
  } catch (err) {
    next(err)
  }
})

app.patch('/api/bookings/:id/status', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { status } = req.body
    const allowed = [
      'Requested',
      'Accepted',
      'Rejected',
      'Confirmed',
      'Picked Up',
      'In Progress',
      'Returned',
      'Completed',
      'Cancelled'
    ]

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing status' })
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = booking.renterId?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'

    // Status transition gates and authorization rules
    if (status === 'Accepted' || status === 'Rejected') {
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Only the vehicle owner can accept or reject booking requests.' })
      }
    }

    if (status === 'Cancelled') {
      if (!isRenter && !isOwner && !isAdmin) {
        return res.status(403).json({ message: 'You are not authorized to cancel this booking.' })
      }
    }

    // Late Return Calculation
    if (status === 'Returned' || status === 'Completed') {
      const now = new Date()
      const end = new Date(booking.endTime)
      const diffMs = now - end
      if (diffMs > 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        if (diffMins > 15) { // past 15 min grace period
          let lateHours = 0
          if (diffMins <= 60) {
            lateHours = 1
          } else {
            lateHours = Math.ceil(diffMins / 60)
          }
          
          const vehicle = await Vehicle.findById(booking.vehicleId)
          if (vehicle) {
            const lateCharge = lateHours * vehicle.pricePerHour
            booking.lateReturnInfo = { lateHours, lateCharge }
            booking.remainingAmount += lateCharge // Owner receives late charge directly
          }
        }
      }
    }

    booking.status = status
    await booking.save()

    // Trigger status transition notifications
    if (status === 'Accepted') {
      await sendNotification(booking.renterId, {
        type: 'booking',
        title: 'Booking Accepted! 🎉',
        message: `Your request for ${booking.vehicleName} has been approved by the owner. Please complete the advance payment.`,
        bookingId: booking._id
      })
    } else if (status === 'Rejected') {
      await sendNotification(booking.renterId, {
        type: 'booking',
        title: 'Booking Request Rejected ❌',
        message: `Your request for ${booking.vehicleName} was rejected.`,
        bookingId: booking._id
      })
    } else if (status === 'cancelled') {
      const recipientId = req.user._id.toString() === booking.renterId.toString() ? booking.ownerId : booking.renterId
      await sendNotification(recipientId, {
        type: 'booking',
        title: 'Booking Cancelled ⚠️',
        message: `The booking for ${booking.vehicleName} has been cancelled.`,
        bookingId: booking._id
      })
    }

    res.json(booking.toObject())
  } catch (err) {
    next(err)
  }
})

app.patch('/api/bookings/:id/cancel', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = booking.renterId?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    booking.status = 'cancelled'
    await booking.save()
    res.json(booking.toObject())
  } catch (err) {
    next(err)
  }
})

// ── User Routes ────────────────────────────────────────────

app.get('/api/users/profile', verifyFirebaseToken, requireMongoUser, (req, res) => {
  res.json(safeUser(req.user.toObject()))
})

app.put('/api/users/profile', verifyFirebaseToken, requireMongoUser, async (req, res) => {
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

app.post('/api/users/kyc', verifyFirebaseToken, requireMongoUser, kycUpload, async (req, res) => {
  try {
    const govFile = req.files?.['governmentIdUrl']?.[0]
    const collegeFile = req.files?.['collegeIdUrl']?.[0]

    if (!govFile && !collegeFile && !req.body.governmentIdUrl && !req.body.collegeIdUrl) {
      return res.status(400).json({ message: 'At least one ID is required' })
    }

    const updates = {
      kycStatus: 'pending',
      kycRejectionReason: null
    }

    if (govFile) {
      updates.governmentIdUrl = `/uploads/${govFile.filename}`
    } else if (req.body.governmentIdUrl) {
      updates.governmentIdUrl = req.body.governmentIdUrl
    }

    if (collegeFile) {
      updates.collegeIdUrl = `/uploads/${collegeFile.filename}`
    } else if (req.body.collegeIdUrl) {
      updates.collegeIdUrl = req.body.collegeIdUrl
    }
    
    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true, lean: true })
    res.json({ message: 'KYC submitted successfully', user: safeUser(updated) })
  } catch (err) {
    console.error('KYC submit error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/users', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 })
    res.json(users)
  } catch (err) {
    next(err)
  }
})

app.patch('/api/users/:id/role', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
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

app.delete('/api/users/:id', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
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

app.patch('/api/admin/users/:id/kyc', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
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

app.get('/api/admin/stats', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const [totalUsers, totalVehicles, totalBookings, pendingListings] = await Promise.all([
      User.countDocuments(),
      Vehicle.countDocuments({ verificationStatus: 'approved' }),
      Booking.countDocuments(),
      Vehicle.countDocuments({ verificationStatus: { $in: ['submitted', 'under_review'] } }),
    ])
    res.json({ users: totalUsers, vehicles: totalVehicles, bookings: totalBookings, pendingListings })
  } catch (err) {
    console.error('GET /api/admin/stats error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/admin/vehicles/pending', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      verificationStatus: { $in: ['submitted', 'under_review'] }
    }).lean()
    res.json({ vehicles })
  } catch (err) {
    console.error('GET /api/admin/vehicles/pending error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/admin/vehicles', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const vehicles = await Vehicle.find().lean()
    res.json({ vehicles })
  } catch (err) {
    console.error('GET /api/admin/vehicles error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/admin/vehicles/:id/approve', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const { adminNotes } = req.body
    const v = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'approved',
        status: 'approved',
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        adminNotes: adminNotes || '',
        rejectionReason: null,
        isLive: true
      },
      { new: true, lean: true }
    )
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(v)
  } catch (err) {
    console.error('PATCH approve error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/admin/vehicles/:id/reject', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const { reason, adminNotes } = req.body
    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' })
    }
    const v = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'rejected',
        status: 'rejected',
        rejectionReason: reason,
        adminNotes: adminNotes || '',
        isLive: false
      },
      { new: true, lean: true }
    )
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(v)
  } catch (err) {
    console.error('PATCH reject error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.patch('/api/admin/vehicles/:id/request-changes', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Vehicle not found' })
    }
    const { adminNotes } = req.body
    if (!adminNotes) {
      return res.status(400).json({ message: 'Change request notes are required' })
    }
    const v = await Vehicle.findByIdAndUpdate(
      req.params.id,
      {
        verificationStatus: 'under_review',
        status: 'under_review',
        adminNotes,
        isLive: false
      },
      { new: true, lean: true }
    )
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    res.json(v)
  } catch (err) {
    console.error('PATCH request-changes error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Razorpay Payment Order Creation ────────────────────────

// ── Payment & Escrow Routes ─────────────────────────────────

import crypto from 'crypto'

app.post('/api/payments/create-order', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  const { bookingId, type } = req.body
  if (!bookingId || !type) {
    return res.status(400).json({ message: 'bookingId and type (advance or final) are required' })
  }
  try {
    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    // Verify requester matches renter on booking record
    if (booking.renterId.toString() !== req.user._id.toString() && !['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: not your booking' })
    }

    const rentalAmount = booking.rentalAmount || booking.price
    const advanceAmount = booking.advanceAmount
    const remainingAmount = booking.remainingAmount
    
    let amount = 0
    if (type === 'advance') {
      amount = advanceAmount // Contains 30% advance + 100% booking fee
    } else if (type === 'final') {
      amount = remainingAmount
    } else {
      return res.status(400).json({ message: 'Invalid payment type. Must be advance or final.' })
    }

    const keyId = process.env.RAZORPAY_KEY_ID || ''
    if (!razorpay || !keyId || keyId.startsWith('YOUR_') || keyId === '') {
      // Mock order generation for local development/testing
      const mockOrder = {
        id: `order_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        entity: 'order',
        amount: Math.round(amount * 100),
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency: 'INR',
        receipt: `rcpt_${bookingId}_${type}`,
        status: 'created',
        attempts: 0,
        notes: { bookingId, type },
        created_at: Math.floor(Date.now() / 1000),
        isMock: true,
      }
      return res.status(200).json(mockOrder)
    }

    const options = {
      amount: Math.round(amount * 100), // convert to paise
      currency: 'INR',
      receipt: `rcpt_${bookingId}_${type}`,
      notes: { bookingId, type },
    }
    const order = await razorpay.orders.create(options)
    res.status(200).json(order)
  } catch (err) {
    next(err)
  }
})

app.post('/api/payments/verify', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  const { bookingId, type, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body
  
  if (!bookingId || !type || !razorpayOrderId || !razorpayPaymentId) {
    return res.status(400).json({ message: 'Missing payment signature verification details' })
  }

  try {
    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    // 1. Signature Verification
    const keyId = process.env.RAZORPAY_KEY_ID || ''
    const isMock = razorpayOrderId.startsWith('order_mock_') || !keyId || keyId.startsWith('YOUR_')

    if (!isMock) {
      if (!razorpaySignature) {
        return res.status(400).json({ message: 'razorpaySignature is required' })
      }
      const generated = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex')

      if (generated !== razorpaySignature) {
        await sendNotification(booking.renterId, {
          type: 'payment',
          title: 'Payment Verification Failed ❌',
          message: `Your payment verification for ${booking.vehicleName} failed due to signature mismatch.`,
          bookingId: booking._id
        })
        return res.status(400).json({ message: 'Payment verification failed: Signature mismatch' })
      }
    }

    // 2. Compute final amount allocations
    const rentalAmount = booking.rentalAmount || booking.price
    const advanceAmount = booking.advanceAmount
    const remainingAmount = booking.remainingAmount

    let finalAmount = 0
    let platformFee = 0
    let ownerShare = 0

    if (type === 'advance') {
      finalAmount = advanceAmount
      platformFee = 0 // Removed for Beta
      ownerShare = advanceAmount
    } else {
      finalAmount = remainingAmount
      platformFee = 0
      ownerShare = remainingAmount
    }

    // 3. Prevent duplicate payment recordings
    const existing = await Payment.findOne({ transactionId: razorpayPaymentId })
    if (existing) {
      return res.status(200).json({ success: true, message: 'Payment already verified and registered', payment: existing })
    }

    // 4. Create Payment Record
    const payment = await Payment.create({
      bookingId: booking._id,
      renterId: booking.renterId,
      ownerId: booking.ownerId,
      amount: finalAmount,
      type,
      status: 'success',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      platformFee,
      ownerShare,
      transactionId: razorpayPaymentId
    })

    // 5. Update Booking Status
    if (type === 'advance') {
      booking.status = 'Confirmed'
      booking.paymentStatus = 'Paid'
      // By default, ownerPaymentStatus is 'Pending Pickup'
    } else if (type === 'final') {
      booking.status = 'Completed'
    }
    await booking.save()

    // Trigger payment success notifications
    await sendNotification(booking.renterId, {
      type: 'payment',
      title: 'Payment Successful! ✅',
      message: `Your ${type} payment of ₹${finalAmount} for ${booking.vehicleName} was verified.`,
      bookingId: booking._id
    })
    await sendNotification(booking.ownerId, {
      type: 'payment',
      title: 'Payment Received! 💰',
      message: `Payment of ₹${finalAmount} for ${booking.vehicleName} was credited to platform escrow.`,
      bookingId: booking._id
    })

    res.status(200).json({
      success: true,
      message: 'Payment verified and captured successfully',
      payment
    })
  } catch (err) {
    next(err)
  }
})

app.post('/api/payments/:id/refund', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' })
    }

    // Verify authorized user (only owner or admin can trigger refunds)
    const isOwner = payment.ownerId.toString() === req.user._id.toString()
    const isAdmin = req.user.role === 'admin'
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only owner or admin can initiate refunds' })
    }

    if (payment.status === 'refunded') {
      return res.status(400).json({ message: 'Payment is already refunded' })
    }

    // Create refund transaction log
    const refundTxId = `ref_mock_${Date.now()}`
    await Payment.create({
      bookingId: payment.bookingId,
      renterId: payment.renterId,
      ownerId: payment.ownerId,
      amount: payment.amount,
      type: 'refund',
      status: 'success',
      transactionId: refundTxId,
      platformFee: 0,
      ownerShare: 0
    })

    payment.status = 'refunded'
    await payment.save()

    // Cancel the booking status
    const booking = await Booking.findById(payment.bookingId)
    if (booking) {
      booking.status = 'cancelled'
      await booking.save()
    }

    res.json({ success: true, message: 'Refund processed successfully', payment })
  } catch (err) {
    next(err)
  }
})

app.get('/api/payments/history', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    let query = {}
    if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      query = {
        $or: [
          { renterId: req.user._id },
          { ownerId: req.user._id }
        ]
      }
    }
    const history = await Payment.find(query)
      .sort({ createdAt: -1 })
      .lean()
    res.json({ history })
  } catch (err) {
    next(err)
  }
})

app.get('/api/payments/:id/invoice', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
    if (!payment) {
      return res.status(404).json({ message: 'Payment invoice not found' })
    }

    const booking = await Booking.findById(payment.bookingId).lean()
    
    // HTML Invoice Template Renderer
    res.setHeader('Content-Type', 'text/html')
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>LUPU Invoice - ${payment.transactionId}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; }
          .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,.05); }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ff6b00; padding-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #ff6b00; }
          .details { margin: 30px 0; display: flex; justify-content: space-between; }
          .details div { line-height: 1.6; }
          .table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          .table th { background: #fcfcfc; border-bottom: 2px solid #eee; text-align: left; padding: 10px; font-size: 13px; color: #888; }
          .table td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px; }
          .totals { text-align: right; margin-top: 20px; font-size: 14px; line-height: 1.8; }
          .grand-total { font-size: 18px; font-weight: bold; color: #ff6b00; margin-top: 10px; }
          .status { font-weight: bold; color: #2ecc71; margin-top: 20px; font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div class="logo">LUPU Rentals</div>
            <div>
              <strong>Receipt Ref:</strong> ${payment.transactionId}<br>
              <strong>Date:</strong> ${new Date(payment.createdAt).toLocaleDateString('en-IN')}<br>
            </div>
          </div>
          
          <div class="details">
            <div>
              <strong>Renter Details:</strong><br>
              Name: ${booking?.renterName || 'Renter'}<br>
              Email: ${booking?.renterEmail || '—'}<br>
            </div>
            <div>
              <strong>Vehicle Details:</strong><br>
              Name: ${booking?.vehicleName || 'Vehicle'}<br>
              Type: ${booking?.vehicleType || 'Bike'}<br>
              Rental Period: ${new Date(booking?.startTime).toLocaleString('en-IN')} to ${new Date(booking?.endTime).toLocaleString('en-IN')}
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Payment Type</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>LUPU Rental Surcharge for booking ${booking?._id || ''}</td>
                <td>${payment.type.toUpperCase()} PAYMENT</td>
                <td>₹${payment.ownerShare}</td>
              </tr>
              <tr>
                <td>Platform Administration Service Fee</td>
                <td>Flat Fee</td>
                <td>₹${payment.platformFee}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals">
            <div><strong>Base Amount:</strong> ₹${payment.ownerShare + payment.platformFee}</div>
            <div class="grand-total">Total Amount Charged: ₹${payment.amount}</div>
          </div>

          <div class="status">
            Payment Status: ${payment.status.toUpperCase()} ✅
          </div>
        </div>
      </body>
      </html>
    `)
  } catch (err) {
    next(err)
  }
})

// ── Notification Engine helpers & endpoints ─────────────────

async function sendEmailBackend(to, subject, content) {
  try {
    await Email.create({ to, subject, content })
    logger.info(`[SIMULATED EMAIL SENDER] To: ${to} | Subject: ${subject}`)
  } catch (err) {
    console.error('Failed to save simulated email:', err)
  }
}

async function sendNotification(userId, { type, title, message, bookingId, vehicleId }) {
  try {
    await Notification.create({
      userId,
      title,
      message,
      type,
      bookingId,
      vehicleId
    })

    const user = await User.findById(userId)
    if (user) {
      // 1. In-App: Stored above in MongoDB
      // 2. Email: simulated email collection
      await sendEmailBackend(user.email, title, message)

      // 3. SMS & WhatsApp stubs (Design for future SMS/WhatsApp support)
      if (user.phone) {
        console.log(`[SMS/WhatsApp STUB] Phone: ${user.phone} | Content: ${title} - ${message}`)
      }
    }
  } catch (err) {
    console.error('Failed to dispatch notification:', err)
  }
}

// Background scheduler interval (runs every 60 seconds)
setInterval(async () => {
  try {
    const now = new Date()

    // 1. Pickup Reminders (status is confirmed and starts in <= 2 hours)
    const pickupWindow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const bookingsForPickup = await Booking.find({
      status: 'confirmed',
      startTime: { $gte: now, $lte: pickupWindow },
      pickupReminderSent: { $ne: true }
    })
    for (const b of bookingsForPickup) {
      await sendNotification(b.renterId, {
        type: 'booking',
        title: 'Pickup Reminder 🔑',
        message: `Your ride for ${b.vehicleName} starts soon. Please prepare for pickup check.`,
        bookingId: b._id
      })
      b.pickupReminderSent = true
      await b.save()
    }

    // 2. Return Reminders (status is ongoing and ends in <= 1 hour)
    const returnWindow = new Date(now.getTime() + 1 * 60 * 60 * 1000)
    const bookingsForReturn = await Booking.find({
      status: 'ongoing',
      endTime: { $gte: now, $lte: returnWindow },
      returnReminderSent: { $ne: true }
    })
    for (const b of bookingsForReturn) {
      await sendNotification(b.renterId, {
        type: 'booking',
        title: 'Return Reminder ⏰',
        message: `Your ride for ${b.vehicleName} ends soon. Please return vehicle before deadline.`,
        bookingId: b._id
      })
      b.returnReminderSent = true
      await b.save()
    }

    // 3. Review Reminders (status is completed and completed in last 24h)
    const completedWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const completedBookings = await Booking.find({
      status: 'completed',
      updatedAt: { $gte: completedWindow },
      reviewReminderSent: { $ne: true }
    })
    for (const b of completedBookings) {
      await sendNotification(b.renterId, {
        type: 'review',
        title: 'Share Your Experience! ⭐',
        message: `We hope you enjoyed renting ${b.vehicleName}! Please leave a rating and comment on the hub.`,
        bookingId: b._id
      })
      b.reviewReminderSent = true
      await b.save()
    }
  } catch (err) {
    console.error('Notification scheduler cron execution warning:', err)
  }
}, 60000)

app.get('/api/notifications', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ notifications })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/notifications/:id/read', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Notification not found' })
    }
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    )
    if (!notif) return res.status(404).json({ message: 'Notification not found' })
    res.json({ success: true, notification: notif })
  } catch (err) {
    next(err)
  }
})

app.post('/api/notifications/read-all', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true })
    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (err) {
    next(err)
  }
})

app.get('/api/emails/simulated', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    let query = {}
    if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      query = { to: req.user.email }
    }
    const emails = await Email.find(query).sort({ createdAt: -1 }).lean()
    res.json({ emails })
  } catch (err) {
    next(err)
  }
})

app.delete('/api/emails/simulated', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    let query = {}
    if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) {
      query = { to: req.user.email }
    }
    await Email.deleteMany(query)
    res.json({ success: true, message: 'Simulated inbox cleared' })
  } catch (err) {
    next(err)
  }
})

// ── Review System REST Endpoints ───────────────────────────

app.post('/api/reviews', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  const { bookingId, rating, comment, reviewType } = req.body
  if (!bookingId || !rating || !reviewType) {
    return res.status(400).json({ message: 'bookingId, rating, and reviewType are required' })
  }

  try {
    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    // Only completed bookings can leave reviews
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Reviews can only be submitted after the ride is completed' })
    }

    const isRenter = booking.renterId.toString() === req.user._id.toString()
    const isOwner = booking.ownerId.toString() === req.user._id.toString()

    // Validate reviewer authorization
    if (reviewType === 'vehicle' || reviewType === 'owner') {
      if (!isRenter) {
        return res.status(403).json({ message: 'Only the renter can review the vehicle and owner' })
      }
    } else if (reviewType === 'customer') {
      if (!isOwner) {
        return res.status(403).json({ message: 'Only the vehicle owner can review the customer' })
      }
    } else {
      return res.status(400).json({ message: 'Invalid reviewType' })
    }

    // Check for duplicate review in DB
    const existing = await Review.findOne({
      bookingId,
      reviewerId: req.user._id,
      reviewType
    })
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted a review for this booking' })
    }

    const reviewedUserId = reviewType === 'customer' ? booking.renterId : booking.ownerId

    // Create review
    const review = await Review.create({
      bookingId,
      reviewerId: req.user._id,
      reviewerName: req.user.name || 'User',
      reviewedUserId,
      vehicleId: booking.vehicleId,
      vehicleName: booking.vehicleName,
      rating,
      comment: comment || '',
      reviewType
    })

    // Recalculate average ratings
    if (reviewType === 'vehicle' && booking.vehicleId) {
      const stats = await Review.aggregate([
        { $match: { vehicleId: booking.vehicleId, reviewType: 'vehicle' } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
      if (stats.length > 0) {
        await Vehicle.findByIdAndUpdate(booking.vehicleId, {
          rating: Math.round(stats[0].avgRating * 10) / 10,
          totalReviews: stats[0].count
        })
      }
    } else if (reviewType === 'owner' || reviewType === 'customer') {
      const stats = await Review.aggregate([
        { $match: { reviewedUserId } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
      ])
      if (stats.length > 0) {
        await User.findByIdAndUpdate(reviewedUserId, {
          rating: Math.round(stats[0].avgRating * 10) / 10,
          totalReviews: stats[0].count
        })
      }
    }

    res.status(201).json({ success: true, review })
  } catch (err) {
    next(err)
  }
})

app.get('/api/reviews/vehicle/:vehicleId', async (req, res, next) => {
  try {
    const reviews = await Review.find({ vehicleId: req.params.vehicleId, reviewType: 'vehicle' })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ reviews })
  } catch (err) {
    next(err)
  }
})

app.get('/api/reviews/user/:userId', async (req, res, next) => {
  try {
    const reviews = await Review.find({ reviewedUserId: req.params.userId })
      .sort({ createdAt: -1 })
      .lean()
    res.json({ reviews })
  } catch (err) {
    next(err)
  }
})

app.get('/api/reviews/eligible/:bookingId', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const reviews = await Review.find({
      bookingId: req.params.bookingId,
      reviewerId: req.user._id
    }).lean()

    const check = {
      vehicle: reviews.some(r => r.reviewType === 'vehicle'),
      owner: reviews.some(r => r.reviewType === 'owner'),
      customer: reviews.some(r => r.reviewType === 'customer')
    }

    res.json({ check })
  } catch (err) {
    next(err)
  }
})

// ── Trust & Safety Endpoints ───────────────────────────────

app.post('/api/safety/report', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { targetType, targetId, reason, description } = req.body
    if (!['user', 'vehicle'].includes(targetType) || !targetId || !reason) {
      return res.status(400).json({ message: 'Missing required report fields' })
    }
    const report = await Report.create({
      reporterId: req.user._id,
      targetType,
      targetId,
      reason,
      description
    })
    res.status(201).json({ success: true, report })
  } catch (err) {
    next(err)
  }
})

app.post('/api/safety/dispute', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, reason, description } = req.body
    if (!bookingId || !reason) {
      return res.status(400).json({ message: 'Missing required dispute fields' })
    }
    const dispute = await Dispute.create({
      raisedBy: req.user._id,
      bookingId,
      reason,
      description
    })
    res.status(201).json({ success: true, dispute })
  } catch (err) {
    next(err)
  }
})

app.post('/api/safety/sos', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, location } = req.body
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID required for SOS' })
    }
    const sos = await SOS.create({
      userId: req.user._id,
      bookingId,
      location
    })
    // In a real app, this would also trigger immediate SMS/push notifications to emergency contacts and admins
    console.error(`🚨 [SOS TRIGGERED] User ${req.user._id} | Booking ${bookingId} | Location ${location}`)
    res.status(201).json({ success: true, sos })
  } catch (err) {
    next(err)
  }
})

app.put('/api/users/emergency-contacts', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { emergencyContacts } = req.body
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { emergencyContacts },
      { new: true }
    )
    res.json({ success: true, emergencyContacts: user.emergencyContacts })
  } catch (err) {
    next(err)
  }
})

// ── Admin Safety API ────────────────────────────────────────

app.patch('/api/admin/users/:id/suspend', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  try {
    const { isSuspended } = req.body
    const user = await User.findByIdAndUpdate(req.params.id, { isSuspended }, { new: true })
    res.json({ success: true, user })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/users/:id/fraud', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  try {
    const { fraudScore } = req.body
    const user = await User.findByIdAndUpdate(req.params.id, { fraudScore }, { new: true })
    res.json({ success: true, user })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/safety/reports', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).populate('reporterId', 'name email').lean()
    res.json({ reports })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/safety/disputes', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  try {
    const disputes = await Dispute.find().sort({ createdAt: -1 }).populate('raisedBy', 'name email').lean()
    res.json({ disputes })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/safety/sos', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  if (!['admin', 'super_admin', 'founder'].includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  try {
    const sosList = await SOS.find().sort({ createdAt: -1 }).populate('userId', 'name email phone').lean()
    res.json({ sosList })
  } catch (err) {
    next(err)
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
app.use(errorHandler)

// ── Start ──────────────────────────────────────────────────
async function start() {
  try {
    logger.info('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    logger.info(`MongoDB connected: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`)

    await seedDatabase()

    app.listen(PORT, () => {
      logger.info('LUPU API Started', {
        port: PORT,
        storage: 'MongoDB (persistent)',
        auth: 'OTP (in-memory, 5 min TTL)'
      })
    })
  } catch (err) {
    logger.error('Failed to connect to MongoDB', err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close()
    logger.info('MongoDB disconnected. Server stopped.')
  } catch (err) {
    logger.error('Error during shutdown', err)
  }
  process.exit(0)
})

start()
