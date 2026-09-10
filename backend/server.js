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
import AuditLog from './models/AuditLog.js'
import Ticket from './models/Ticket.js'
import { seedDatabase } from './seed.js'
import { attachVehicleAvailability, checkOverlap } from './utils/availability.js'
import { kycUpload, vehicleUpload, avatarUpload } from './middleware/uploadMiddleware.js'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { rateLimiter } from './middleware/rateLimiter.js'
import { verifyFirebaseToken, requireMongoUser } from './middleware/authMiddleware.js'

// Role-based authorization helper
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    
    // Strict Admin Constraint: If caller has admin role or endpoint is admin-exclusive, enforce sole admin identity
    const isAdminRole = ['admin', 'super_admin', 'founder'].includes(req.user.role)
    const requiresAdminOnly = roles.every(r => ['admin', 'super_admin', 'founder'].includes(r))
    
    if (isAdminRole || requiresAdminOnly) {
      if (req.user.email?.toLowerCase() !== 'dasstranger421@gmail.com' || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Admin access strictly restricted to platform administrator' })
      }
    }
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
function safeUser(u, callerId = null, isAdmin = false) {
  // eslint-disable-next-line no-unused-vars
  const { password, __v, ...rest } = u
  if (rest.payoutDetails && rest.payoutDetails.accountNumber) {
    const rawAcc = String(rest.payoutDetails.accountNumber)
    const isSelf = callerId && (rest._id?.toString() === callerId.toString())
    if (!isSelf && !isAdmin) {
      rest.payoutDetails = {
        ...rest.payoutDetails,
        accountNumber: `**** **** ${rawAcc.slice(-4)}`
      }
    }
  }
  return rest
}

// KYC placeholder — not enforced yet; will enforce in a future sprint
function kycPlaceholder(_req, _res, next) {
  next()
}

// ── Validation & Privacy Helpers ───────────────────────────
function validateIndianPhoneNumber(input) {
  if (!input || typeof input !== 'string') return { valid: false, message: 'Owner phone number is required' }
  const raw = input.trim().replace(/[\s\-\(\)]/g, '')
  const match = raw.match(/^(?:\+?91|0)?([6-9]\d{9})$/)
  if (!match) {
    return { valid: false, message: 'Please enter a valid 10-digit Indian phone number (starting with 6, 7, 8, or 9).' }
  }
  const digits = match[1]
  const isRepeating = /^(\d)\1{9}$/.test(digits)
  const isSequential = ['0123456789', '1234567890', '9876543210'].includes(digits)
  if (isRepeating || isSequential) {
    return { valid: false, message: 'Please enter a valid, active phone number (dummy sequences are not allowed).' }
  }
  return { valid: true, cleanDigits: digits, formatted: `+91${digits}` }
}

const ACCEPTED_CONTACT_STATUSES = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed', 'completed']

async function enrichBookingWithContact(booking, requestingUser) {
  if (!booking) return null
  const b = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking }
  if (!requestingUser) {
    delete b.ownerPhone
    return b
  }
  const isRenter = b.renterId && (b.renterId._id || b.renterId).toString() === requestingUser._id.toString()
  const isAdmin = ['admin', 'super_admin', 'founder'].includes(requestingUser.role)

  const normalizedStatus = (b.status || '').toLowerCase()
  const isAcceptedOrLater = ACCEPTED_CONTACT_STATUSES.includes(normalizedStatus)

  if ((isRenter || isAdmin) && isAcceptedOrLater && b.ownerId) {
    const ownerId = b.ownerId._id || b.ownerId
    const owner = await User.findById(ownerId).select('name phone').lean()
    if (owner) {
      b.ownerName = owner.name || b.ownerName || 'Vehicle Owner'
      b.ownerPhone = owner.phone || null
    }
  } else {
    delete b.ownerPhone
  }
  return b
}

async function enrichBookingsWithContact(bookings, requestingUser) {
  return Promise.all(bookings.map(b => enrichBookingWithContact(b, requestingUser)))
}

// ── Auth Routes ────────────────────────────────────────────

// 1. Firebase Login / Sync Route
// The frontend calls this AFTER successful Firebase authentication
app.post('/api/auth/login', verifyFirebaseToken, async (req, res, next) => {
  console.log("🔥 /api/auth/login HIT");
  console.log("Body:", req.body);
  console.log("User:", req.firebaseUser);

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
      logger.info('New user registered via Firebase sync', { userId: user._id, email: user.email })
    } else {
      // Existing user: bump lastLogin
      user.lastLogin = new Date()
      await user.save()
    }

    res.json({
      message: 'Login successful',
      user: safeUser(user.toObject())
    })
  } catch (err) {
    next(err)
  }
})

// 2. Auth ME route (validate session & sync email verification)
app.get('/api/auth/me', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    if (req.firebaseUser?.email_verified && !req.user.emailVerified) {
      req.user.emailVerified = true
      await req.user.save()
    }
    res.json({ user: safeUser(req.user.toObject()) })
  } catch (err) {
    console.error('GET /api/auth/me error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
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
    const vehiclePipeline = [
      { 
        $match: { 
          $or: [
            { verificationStatus: 'approved' },
            { status: 'approved' }
          ],
          isLive: true 
        } 
      },
      { 
        $lookup: {
          from: 'bookings',
          let: { vId: '$_id' },
          pipeline: [
            { 
              $match: {
                $expr: { $eq: ['$vehicleId', '$$vId'] },
                status: { $in: ['pending', 'requested', 'accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'] },
                endTime: { $gt: new Date() }
              }
            },
            { $sort: { startTime: 1 } }
          ],
          as: 'activeBookings'
        }
      }
    ]

    let vehicles = []
    let accessories = []

    if (type === 'vehicle' || !type) {
      const rawVehicles = await Vehicle.aggregate(vehiclePipeline)
      vehicles = rawVehicles.map(v => {
        const { activeBookings, ...vehicleData } = v
        const withAvail = attachVehicleAvailability(vehicleData, activeBookings)
        return { ...withAvail, category: 'vehicle' }
      })
    }

    if (type === 'accessory' || !type) {
      const rawAccessories = await Accessory.find({ availability: true }).lean()
      accessories = rawAccessories.map(a => ({ ...a, category: 'accessory', currentStatus: 'Available' }))
    }

    const items = [...vehicles, ...accessories]
    res.json({ items })
  } catch (err) {
    console.error('GET /api/items error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (mongoose.Types.ObjectId.isValid(id)) {
      const vehicles = await Vehicle.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },
        { $lookup: {
            from: 'bookings',
            let: { vId: '$_id' },
            pipeline: [
              { $match: {
                  $expr: { $eq: ['$vehicleId', '$$vId'] },
                  status: { $in: ['pending', 'requested', 'accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'] },
                  endTime: { $gt: new Date() }
                }
              },
              { $sort: { startTime: 1 } }
            ],
            as: 'activeBookings'
        }}
      ])
      if (vehicles && vehicles.length > 0) {
        const { activeBookings, ...vehicleData } = vehicles[0]
        const vWithAvail = attachVehicleAvailability(vehicleData, activeBookings)
        return res.json({ ...vWithAvail, category: 'vehicle' })
      }
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
      { 
        $match: { 
          $or: [
            { verificationStatus: 'approved' },
            { status: 'approved' }
          ],
          isLive: true 
        } 
      },
      { $lookup: {
          from: 'bookings',
          let: { vId: '$_id' },
          pipeline: [
            { $match: {
                $expr: { $eq: ['$vehicleId', '$$vId'] },
                status: { $in: ['pending', 'requested', 'accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'] },
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
                status: { $in: ['pending', 'requested', 'accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'] },
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

app.post('/api/vehicles', verifyFirebaseToken, requireMongoUser, authorize('owner', 'admin', 'user'), kycPlaceholder, vehicleUpload, async (req, res) => {
  try {
    const {
      name, brand, model, type, pricePerHour, pricePerDay, securityDeposit,
      location, description, year, fuel, transmission, helmetAvailable,
      verificationStatus, ownerName, ownerPhone
    } = req.body

    const isSubmitting = verificationStatus === 'submitted' || !verificationStatus || verificationStatus === 'pending_verification'

    // Owner contact info validation
    const resolvedOwnerName = (ownerName || req.user.name || '').trim()
    const resolvedOwnerPhone = (ownerPhone || req.user.phone || '').trim()

    if (isSubmitting) {
      if (!resolvedOwnerName || resolvedOwnerName.length < 2) {
        return res.status(400).json({ message: "Owner's full name is required (at least 2 characters)" })
      }
      const phoneValidation = validateIndianPhoneNumber(resolvedOwnerPhone)
      if (!phoneValidation.valid) {
        return res.status(400).json({ message: phoneValidation.message })
      }
      // Persist confirmed owner name & phone to User profile
      req.user.name = resolvedOwnerName
      req.user.phone = phoneValidation.formatted
    }

    // Ensure listing user is marked as owner
    if (!req.user.isOwner || req.user.role === 'user') {
      req.user.isOwner = true
      if (req.user.role === 'user') req.user.role = 'owner'
    }
    await req.user.save()

    const rcFile = req.files?.['RC']?.[0]
    const insFile = req.files?.['Insurance']?.[0]
    const pucFile = req.files?.['PUC']?.[0]
    const photoFiles = req.files?.['photos'] || []

    const rcUrl = rcFile ? `/uploads/${rcFile.filename}` : (req.body.RC || req.body.documents?.RC)
    const insUrl = insFile ? `/uploads/${insFile.filename}` : (req.body.Insurance || req.body.documents?.Insurance)
    const pucUrl = pucFile ? `/uploads/${pucFile.filename}` : (req.body.PUC || req.body.documents?.PUC)

    const uploadedFileUrls = photoFiles.map(f => `/uploads/${f.filename}`)
    // bodyPhotos are the Firebase Storage https:// URLs sent as strings
    const bodyPhotos = Array.isArray(req.body.photos)
      ? req.body.photos.filter(p => typeof p === 'string' && p.startsWith('http'))
      : (req.body.photos && typeof req.body.photos === 'string' && req.body.photos.startsWith('http') ? [req.body.photos] : [])
    // Merge: prefer Firebase Storage URLs (permanent), fall back to local disk paths
    const photoUrls = Array.from(new Set([...bodyPhotos, ...uploadedFileUrls])).filter(p => typeof p === 'string' && p.trim())

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
      if (photoUrls.length < 3) return res.status(400).json({ message: `Minimum 3 photos required (received ${photoUrls.length})` })
    }

    const vStatus = isSubmitting ? 'submitted' : 'draft'
    const statusSync = isSubmitting ? 'pending_verification' : 'draft'

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
      status: statusSync,
      submittedAt: isSubmitting ? new Date() : null,
      isLive: false,
      ownerId: req.user._id,
      owner: { name: req.user.name, rating: 0, totalTrips: 0 },
    })
    console.log(`✅ Vehicle created: ${newVehicle._id} | owner: ${req.user.email} | photos: ${photoUrls.length}`)

    // Notify owner
    await sendNotification(req.user._id, {
      type: 'vehicle',
      title: 'Vehicle Submitted for Verification 📋',
      message: `Your vehicle ${newVehicle.name} has been submitted for admin verification.`,
      vehicleId: newVehicle._id,
      link: '/dashboard'
    })

    // Notify admins
    const admins = await User.find({ role: { $in: ['admin', 'super_admin', 'founder'] } })
    for (const adm of admins) {
      await sendNotification(adm._id, {
        type: 'admin',
        title: 'New Vehicle Pending Verification 🛡️',
        message: `Vehicle ${newVehicle.name} (${newVehicle.registrationNumber}) was submitted by ${req.user.name} for verification.`,
        vehicleId: newVehicle._id,
        link: '/admin'
      })
    }

    res.status(201).json(newVehicle.toObject())
  } catch (err) {
    console.error('POST /api/vehicles error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Vehicle registration number already registered' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.put('/api/vehicles/:id', verifyFirebaseToken, requireMongoUser, authorize('owner', 'admin', 'user'), vehicleUpload, async (req, res, next) => {
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
    
    const uploadedFileUrls = photoFiles.map(f => `/uploads/${f.filename}`)
    const bodyPhotos = Array.isArray(req.body.photos) ? req.body.photos : (req.body.photos ? [req.body.photos] : [])
    const photoUrls = Array.from(new Set([...uploadedFileUrls, ...bodyPhotos, ...(vehicle.photos || [])])).filter(p => typeof p === 'string' && p.trim())

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

    // 1. Only Approved & LIVE Vehicles can be booked
    const vehicle = await Vehicle.findById(vehicleId)
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found.' })
    }
    const isApproved = vehicle.verificationStatus === 'approved' || vehicle.status === 'approved'
    if (!isApproved || vehicle.isLive === false) {
      return res.status(400).json({ message: 'This vehicle is currently offline or unapproved.' })
    }

    // 2. Owner cannot book own vehicle
    if (vehicle.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owners cannot book their own vehicles.' })
    }

    // 3. Overlapping Dates Check (prevent double booking)
    const overlapping = await Booking.findOne({
      vehicleId,
      status: { $in: ['pending', 'requested', 'accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'] },
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
      status: 'pending',
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
      vehicleId: vehicle._id,
      link: '/dashboard'
    })
    await sendNotification(req.user._id, {
      type: 'booking',
      title: 'Booking Request Submitted 🚀',
      message: `Your request for ${vehicle.name} has been sent to the owner.`,
      bookingId: newBooking._id,
      vehicleId: vehicle._id,
      link: '/my-bookings'
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
    const enriched = await enrichBookingsWithContact(bookings, req.user)
    res.json({ bookings: enriched })
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
    const enriched = await enrichBookingsWithContact(bookings, req.user)
    res.json({ bookings: enriched })
  } catch (err) {
    next(err)
  }
})

app.get('/api/bookings/:id/owner-contact', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }
    const booking = await Booking.findById(req.params.id).lean()
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = booking.renterId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)

    if (!isRenter && !isAdmin) {
      return res.status(403).json({ message: 'You are not authorized to view owner contact details for this booking.' })
    }

    const normalizedStatus = (booking.status || '').toLowerCase()
    if (!ACCEPTED_CONTACT_STATUSES.includes(normalizedStatus)) {
      return res.status(403).json({
        message: 'Owner contact details are only revealed once the booking is accepted or confirmed by the owner.',
        status: booking.status
      })
    }

    const owner = await User.findById(booking.ownerId).select('name phone').lean()
    if (!owner) {
      return res.status(404).json({ message: 'Owner user not found' })
    }

    res.json({
      ownerName: owner.name || booking.ownerName || 'Vehicle Owner',
      ownerPhone: owner.phone || null
    })
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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const enriched = await enrichBookingWithContact(booking, req.user)
    res.json(enriched)
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
        ...(booking.handoverDetails || {}),
        ...req.body.handoverDetails
      }
    }
    if (req.body.verificationDetails) {
      booking.verificationDetails = {
        ...(booking.verificationDetails || {}),
        ...req.body.verificationDetails
      }
    }

    const previousStatus = booking.status
    if (req.body.status) {
      const raw = (req.body.status || '').toLowerCase().trim()
      const statusMap = {
        pending: 'pending',
        requested: 'pending',
        accepted: 'accepted',
        approved: 'accepted',
        active: 'active',
        ongoing: 'active',
        ready_for_pickup: 'active',
        confirmed: 'active',
        completed: 'completed',
        returned: 'completed',
        rejected: 'rejected',
        cancelled: 'cancelled',
      }
      const targetStatus = statusMap[raw] || raw
      if (['accepted', 'rejected', 'completed'].includes(targetStatus) && !isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Only the vehicle owner or admin can update to this status.' })
      }
      booking.status = targetStatus
    }

    await booking.save()

    // Trigger status transition notifications if status changed
    if (booking.status !== previousStatus) {
      if (booking.status === 'active') {
        await sendNotification(booking.renterId, {
          type: 'booking',
          title: 'Rental Active! 🏍️',
          message: `Your rental for ${booking.vehicleName} is now active. Enjoy your ride!`,
          bookingId: booking._id,
          vehicleId: booking.vehicleId,
          link: '/my-bookings'
        })
        await sendNotification(booking.ownerId, {
          type: 'booking',
          title: 'Rental Started 🟢',
          message: `Booking for ${booking.vehicleName} is now active and ongoing.`,
          bookingId: booking._id,
          vehicleId: booking.vehicleId,
          link: '/dashboard'
        })
      } else if (booking.status === 'completed') {
        await sendNotification(booking.renterId, {
          type: 'booking',
          title: 'Rental Completed! ✅',
          message: `Your rental for ${booking.vehicleName} is marked complete. Thank you for riding with LUPU!`,
          bookingId: booking._id,
          vehicleId: booking.vehicleId,
          link: '/my-bookings'
        })
        await sendNotification(booking.ownerId, {
          type: 'booking',
          title: 'Vehicle Returned & Completed! 💰',
          message: `Rental for ${booking.vehicleName} has been completed and returned.`,
          bookingId: booking._id,
          vehicleId: booking.vehicleId,
          link: '/dashboard'
        })
      }
    }

    res.json(booking.toObject())
  } catch (err) {
    next(err)
  }
})

app.patch('/api/bookings/:id/status', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const rawStatus = (req.body.status || '').toLowerCase().trim()
    const statusMap = {
      pending: 'pending',
      requested: 'pending',
      accepted: 'accepted',
      approved: 'accepted',
      active: 'active',
      ongoing: 'active',
      ready_for_pickup: 'active',
      confirmed: 'active',
      completed: 'completed',
      returned: 'completed',
      rejected: 'rejected',
      cancelled: 'cancelled',
    }

    const status = statusMap[rawStatus]
    if (!status) {
      return res.status(400).json({ message: 'Invalid or missing status' })
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const booking = await Booking.findById(req.params.id)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = booking.renterId?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)

    // Status transition gates and authorization rules
    if (['accepted', 'rejected', 'active', 'completed'].includes(status)) {
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: 'Only the vehicle owner or admin can update this booking status.' })
      }
    }

    if (status === 'cancelled') {
      if (!isRenter && !isOwner && !isAdmin) {
        return res.status(403).json({ message: 'You are not authorized to cancel this booking.' })
      }
    }

    // Late Return Calculation
    if (status === 'completed') {
      const now = new Date()
      const end = new Date(booking.endTime)
      const diffMs = now - end
      if (diffMs > 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        if (diffMins > 15) { // past 15 min grace period
          const lateHours = diffMins <= 60 ? 1 : Math.ceil(diffMins / 60)
          const vehicle = await Vehicle.findById(booking.vehicleId)
          if (vehicle) {
            const lateCharge = lateHours * vehicle.pricePerHour
            booking.lateReturnInfo = { lateHours, lateCharge }
            booking.remainingAmount += lateCharge
          }
        }
      }
    }

    booking.status = status
    await booking.save()

    // Trigger status transition notifications
    if (status === 'accepted') {
      await sendNotification(booking.renterId, {
        type: 'booking',
        title: 'Booking Accepted! 🎉',
        message: `Your booking request for ${booking.vehicleName} has been accepted by the owner. Owner contact details are now available in your booking details.`,
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        link: '/dashboard'
      })
    } else if (status === 'rejected') {
      await sendNotification(booking.renterId, {
        type: 'booking',
        title: 'Booking Request Rejected ❌',
        message: `Your booking request for ${booking.vehicleName} was rejected by the owner.`,
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        link: '/my-bookings'
      })
    } else if (status === 'cancelled') {
      const recipientId = req.user._id.toString() === booking.renterId.toString() ? booking.ownerId : booking.renterId
      const targetLink = req.user._id.toString() === booking.renterId.toString() ? '/dashboard' : '/my-bookings'
      await sendNotification(recipientId, {
        type: 'booking',
        title: 'Booking Cancelled ⚠️',
        message: `The booking for ${booking.vehicleName} has been cancelled.`,
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        link: targetLink
      })
    } else if (status === 'active') {
      await sendNotification(booking.renterId, {
        type: 'booking',
        title: 'Rental Active! 🏍️',
        message: `Your rental for ${booking.vehicleName} is now active. Enjoy your ride!`,
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        link: '/my-bookings'
      })
    } else if (status === 'completed') {
      await sendNotification(booking.renterId, {
        type: 'booking',
        title: 'Rental Completed! ✅',
        message: `Your rental for ${booking.vehicleName} is marked complete. Thank you for riding with LUPU!`,
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        link: '/my-bookings'
      })
      await sendNotification(booking.ownerId, {
        type: 'booking',
        title: 'Vehicle Returned & Completed! 💰',
        message: `Rental for ${booking.vehicleName} has been completed and returned.`,
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        link: '/dashboard'
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

    const recipientId = req.user._id.toString() === booking.renterId.toString() ? booking.ownerId : booking.renterId
    const targetLink = req.user._id.toString() === booking.renterId.toString() ? '/dashboard' : '/my-bookings'
    await sendNotification(recipientId, {
      type: 'booking',
      title: 'Booking Cancelled ⚠️',
      message: `The booking for ${booking.vehicleName} has been cancelled.`,
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      link: targetLink
    })

    res.json(booking.toObject())
  } catch (err) {
    next(err)
  }
})

// ── User Routes ────────────────────────────────────────────

app.get('/api/users/profile', verifyFirebaseToken, requireMongoUser, (req, res) => {
  res.json({ user: safeUser(req.user.toObject()) })
})

app.put('/api/users/profile', verifyFirebaseToken, requireMongoUser, avatarUpload, async (req, res) => {
  try {
    const { name, email, phone, college, address } = req.body
    let { avatar, notificationPreferences } = req.body

    if (req.file) {
      avatar = `/uploads/${req.file.filename}`
    }

    if (typeof notificationPreferences === 'string') {
      try {
        notificationPreferences = JSON.parse(notificationPreferences)
      } catch (e) {
        // ignore invalid JSON
      }
    }

    const updates = {}
    if (name !== undefined && name.trim()) updates.name = name.trim()
    if (email !== undefined && email.trim()) updates.email = email.trim()
    if (phone !== undefined) updates.phone = phone.trim()
    if (avatar !== undefined) updates.avatar = avatar
    if (college !== undefined) updates.college = college
    if (address !== undefined) updates.address = address
    if (notificationPreferences !== undefined && typeof notificationPreferences === 'object') {
      updates.notificationPreferences = notificationPreferences
    }

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

// Helper to record administrative actions into immutable AuditLog
async function logAdminAction(adminUser, actionType, affectedRecord, notes = '', details = {}) {
  try {
    if (!adminUser) return null
    return await AuditLog.create({
      adminId: adminUser._id,
      adminName: adminUser.name || 'Platform Administrator',
      adminEmail: adminUser.email || '',
      actionType,
      affectedRecord,
      notes,
      details
    })
  } catch (err) {
    console.error('Failed to write audit log:', err)
    return null
  }
}

app.patch('/api/users/:id/role', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' })
    }
    const targetUser = await User.findById(req.params.id)
    if (!targetUser) return res.status(404).json({ message: 'User not found' })

    const newRole = req.body.role
    // Enforce Admin Invariant: NO other email can be promoted to admin/super_admin/founder
    if (['admin', 'super_admin', 'founder'].includes(newRole)) {
      if (targetUser.email?.toLowerCase() !== 'dasstranger421@gmail.com') {
        return res.status(403).json({ message: 'Forbidden: Cannot promote user to admin. Admin privileges are strictly restricted.' })
      }
    }

    targetUser.role = newRole
    if (newRole === 'owner') targetUser.isOwner = true
    await targetUser.save()

    await logAdminAction(
      req.user,
      'update_role',
      { collectionName: 'users', docId: targetUser._id.toString(), name: targetUser.name },
      `Changed role to ${newRole}`
    )

    res.json(safeUser(targetUser.toObject()))
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
    const targetUser = await User.findById(req.params.id)
    if (!targetUser) return res.status(404).json({ message: 'User not found' })

    if (targetUser.email?.toLowerCase() === 'dasstranger421@gmail.com') {
      return res.status(403).json({ message: 'Cannot delete primary platform administrator' })
    }

    await User.findByIdAndDelete(req.params.id)

    await logAdminAction(
      req.user,
      'delete_user',
      { collectionName: 'users', docId: targetUser._id.toString(), name: targetUser.name },
      `Deleted user account ${targetUser.email}`
    )

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

    await logAdminAction(
      req.user,
      `kyc_${status}`,
      { collectionName: 'users', docId: updated._id.toString(), name: updated.name },
      status === 'rejected' ? `Rejected KYC: ${reason}` : 'Approved KYC verification'
    )

    // Notify user of KYC decision
    await sendNotification(updated._id, {
      type: 'general',
      title: status === 'verified' ? 'KYC Verified! ✅' : 'KYC Verification Update ⚠️',
      message: status === 'verified' ? 'Your identity verification has been approved.' : `Your KYC was rejected. Reason: ${reason || 'Document mismatch'}`,
      link: '/profile'
    })

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
      Vehicle.countDocuments({
        $or: [
          { verificationStatus: 'approved' },
          { status: 'approved' }
        ]
      }),
      Booking.countDocuments(),
      Vehicle.countDocuments({
        $or: [
          { verificationStatus: { $in: ['submitted', 'under_review', 'pending_verification'] } },
          { status: { $in: ['pending_verification', 'under_review', 'submitted'] } }
        ]
      }),
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
      $or: [
        { verificationStatus: { $in: ['submitted', 'under_review', 'pending_verification'] } },
        { status: { $in: ['pending_verification', 'under_review', 'submitted'] } }
      ]
    }).sort({ createdAt: -1 }).lean()
    res.json({ vehicles })
  } catch (err) {
    console.error('GET /api/admin/vehicles/pending error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.get('/api/admin/vehicles', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 }).lean()
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
        $set: {
          verificationStatus: 'approved',
          status: 'approved',
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
          adminNotes: adminNotes || '',
          rejectionReason: null,
          isLive: true
        }
      },
      { new: true, lean: true }
    )
    if (!v) return res.status(404).json({ message: 'Vehicle not found' })
    console.log(`✅ Admin approved vehicle: ${v.name} (${v._id}) -> LIVE`)

    await logAdminAction(
      req.user,
      'approve_vehicle',
      { collectionName: 'vehicles', docId: v._id.toString(), name: v.name },
      adminNotes || 'Vehicle listing approved and published live'
    )

    // Notify vehicle owner
    await sendNotification(v.ownerId, {
      type: 'vehicle',
      title: 'Vehicle Approved & Live! 🎉',
      message: `Your vehicle ${v.name} has been approved by admin and is now live in Explore Rentals.`,
      vehicleId: v._id,
      link: '/dashboard'
    })

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

    await logAdminAction(
      req.user,
      'reject_vehicle',
      { collectionName: 'vehicles', docId: v._id.toString(), name: v.name },
      `Reason: ${reason}. Notes: ${adminNotes || 'None'}`
    )

    // Notify vehicle owner
    await sendNotification(v.ownerId, {
      type: 'vehicle',
      title: 'Vehicle Listing Rejected ❌',
      message: `Your vehicle ${v.name} was rejected by admin. Reason: ${reason}`,
      vehicleId: v._id,
      link: '/dashboard'
    })

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

    await logAdminAction(
      req.user,
      'request_changes',
      { collectionName: 'vehicles', docId: v._id.toString(), name: v.name },
      `Changes requested: ${adminNotes}`
    )

    // Notify vehicle owner
    await sendNotification(v.ownerId, {
      type: 'vehicle',
      title: 'Action Required on Vehicle ⚠️',
      message: `Admin requested changes for ${v.name}: ${adminNotes}`,
      vehicleId: v._id,
      link: '/dashboard'
    })

    res.json(v)
  } catch (err) {
    console.error('PATCH request-changes error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Owner Payout Details (Get & Update) ─────────────────────

app.get('/api/user/payout-details', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('payoutDetails isOwner').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    const details = user.payoutDetails || {}
    res.json({
      success: true,
      payoutDetails: {
        ...details,
        accountNumber: details.accountNumber ? `**** **** ${String(details.accountNumber).slice(-4)}` : null,
        isVerified: details.isVerified || false
      }
    })
  } catch (err) {
    next(err)
  }
})

app.put('/api/user/payout-details', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { upiId, accountHolderName, accountNumber, ifscCode, bankName } = req.body

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const updatedPayout = {
      upiId: upiId ? upiId.trim() : (user.payoutDetails?.upiId || null),
      accountHolderName: accountHolderName ? accountHolderName.trim() : (user.payoutDetails?.accountHolderName || null),
      accountNumber: accountNumber ? accountNumber.trim() : (user.payoutDetails?.accountNumber || null),
      ifscCode: ifscCode ? ifscCode.trim().toUpperCase() : (user.payoutDetails?.ifscCode || null),
      bankName: bankName ? bankName.trim() : (user.payoutDetails?.bankName || null),
      isVerified: user.payoutDetails?.isVerified || false
    }

    user.payoutDetails = updatedPayout
    await user.save()

    res.json({
      success: true,
      message: 'Payout details saved securely',
      payoutDetails: {
        ...updatedPayout,
        accountNumber: updatedPayout.accountNumber ? `**** **** ${String(updatedPayout.accountNumber).slice(-4)}` : null
      }
    })
  } catch (err) {
    next(err)
  }
})

// ── Owner Earnings & Financial Analytics ────────────────────

app.get('/api/payments/owner/earnings', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const completedBookings = await Booking.find({
      ownerId: req.user._id,
      status: 'completed'
    }).lean()

    const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.rentalAmount || b.price || 0), 0)
    const completedTrips = completedBookings.length

    const paymentRecords = await Payment.find({
      ownerId: req.user._id
    }).sort({ createdAt: -1 }).lean()

    res.json({
      success: true,
      totalEarnings,
      completedTrips,
      pendingPayouts: totalEarnings, // automatic payout is OFF for now
      platformCommission: 0, // commission = 0 for now
      paymentRecords
    })
  } catch (err) {
    next(err)
  }
})

// ── Payment & Financial Records Endpoints ───────────────────

// Gateway status placeholder (Gateway is OFF; bookings confirm directly)
app.post('/api/payments/create-order', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  return res.status(200).json({
    message: 'Online payment gateway is temporarily disabled. Bookings are confirmed directly with zero commission.',
    status: 'not_integrated'
  })
})

app.post('/api/payments/verify', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  return res.status(200).json({
    message: 'Online payment gateway verification is temporarily disabled.',
    status: 'not_integrated'
  })
})

// Create financial payment record in pending state
app.post('/api/payments/records', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, rentalAmount, securityDeposit } = req.body
    if (!bookingId) {
      return res.status(400).json({ message: 'bookingId is required' })
    }

    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    const isRenter = (booking.userId || booking.renterId)?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot create financial records for this booking' })
    }

    const rentAmt = Number(rentalAmount !== undefined ? rentalAmount : (booking.rentalAmount || booking.price || 0))
    const secDep = Number(securityDeposit !== undefined ? securityDeposit : (booking.deposit || 0))
    const totalAmt = rentAmt + secDep
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    // Payment record is ALWAYS created as pending — cannot be marked as paid by client
    const payment = await Payment.create({
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      renterId: booking.userId || booking.renterId,
      ownerId: booking.ownerId,
      rentalAmount: rentAmt,
      securityDeposit: secDep,
      platformFee: 0, // Commission = 0 for now
      ownerPayoutAmount: rentAmt,
      amount: totalAmt,
      currency: 'INR',
      status: 'pending',
      paymentMethod: 'none',
      transactionId: txId,
      payoutStatus: 'unsettled'
    })

    res.status(201).json({ success: true, payment })
  } catch (err) {
    next(err)
  }
})

// Booking payments inquiry
app.get('/api/payments/booking/:bookingId', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = (booking.userId || booking.renterId)?.toString() === req.user._id.toString()
    const isOwner = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot access payment details for this booking' })
    }

    const payments = await Payment.find({ bookingId: req.params.bookingId }).sort({ createdAt: -1 }).lean()
    res.json({ success: true, payments })
  } catch (err) {
    next(err)
  }
})

// Payment history (Caller's transactions or all if admin)
app.get('/api/payments/history', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'
    let query = {}
    if (!isAdmin) {
      query = {
        $or: [
          { renterId: req.user._id },
          { ownerId: req.user._id }
        ]
      }
    }
    const history = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate('bookingId', 'vehicleName startTime endTime status')
      .lean()
    res.json({ history })
  } catch (err) {
    next(err)
  }
})

// ── Admin Financial Endpoints ───────────────────────────────

app.get('/api/admin/financials/stats', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const allBookings = await Booking.find({ status: { $ne: 'cancelled' } }).lean()
    const allPayments = await Payment.find().lean()

    const totalVolume = allBookings.reduce((sum, b) => sum + (b.price || b.rentalAmount || 0) + (b.deposit || 0), 0)
    const totalRentalAmount = allBookings.reduce((sum, b) => sum + (b.price || b.rentalAmount || 0), 0)
    const totalSecurityDeposits = allBookings.reduce((sum, b) => sum + (b.deposit || 0), 0)
    const totalPlatformCommission = 0 // Commission is 0 for now
    const totalOwnerPayouts = totalRentalAmount

    res.json({
      success: true,
      stats: {
        totalVolume,
        totalRentalAmount,
        totalSecurityDeposits,
        totalPlatformCommission,
        totalOwnerPayouts,
        totalTransactions: allPayments.length,
        pendingSettlementsCount: allPayments.filter(p => p.payoutStatus === 'unsettled').length
      }
    })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/financials/transactions', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const transactions = await Payment.find()
      .sort({ createdAt: -1 })
      .populate('renterId', 'name email')
      .populate('ownerId', 'name email')
      .populate('vehicleId', 'name brand model')
      .lean()
    res.json({ success: true, transactions })
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
  if (process.env.NODE_ENV === 'production') {
    logger.warn(`[EMAIL DISABLED] Real email delivery is not configured in production. Suppressed sending email to <${to}> for '${subject}'. Email simulation is strictly disabled in production.`)
    return
  }
  try {
    await Email.create({ to, subject, content })
    logger.info(`[SIMULATED EMAIL SENDER - DEV ONLY] To: ${to} | Subject: ${subject}`)
  } catch (err) {
    console.error('Failed to save simulated email:', err)
  }
}

async function sendNotification(userId, { type, title, message, bookingId, vehicleId, link }) {
  try {
    if (!userId) return null
    const notif = await Notification.create({
      userId,
      title,
      message,
      type: type || 'general',
      bookingId: bookingId || undefined,
      vehicleId: vehicleId || undefined,
      link: link || ''
    })

    const user = await User.findById(userId)
    if (user && user.email) {
      await sendEmailBackend(user.email, title, message)
      if (user.phone) {
        console.log(`[SMS/WhatsApp STUB] Phone: ${user.phone} | Content: ${title} - ${message}`)
      }
    }
    return notif
  } catch (err) {
    console.error('Failed to dispatch notification:', err)
    return null
  }
}

// Background scheduler interval (runs every 60 seconds)
setInterval(async () => {
  try {
    const now = new Date()

    // 1. Pickup Reminders (status is active or accepted and starts in <= 2 hours)
    const pickupWindow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const bookingsForPickup = await Booking.find({
      status: { $in: ['accepted', 'confirmed'] },
      startTime: { $gte: now, $lte: pickupWindow },
      pickupReminderSent: { $ne: true }
    })
    for (const b of bookingsForPickup) {
      await sendNotification(b.renterId, {
        type: 'reminder',
        title: 'Pickup Reminder 🔑',
        message: `Your ride for ${b.vehicleName} starts soon. Please prepare for pickup check.`,
        bookingId: b._id,
        vehicleId: b.vehicleId,
        link: '/my-bookings'
      })
      b.pickupReminderSent = true
      await b.save()
    }

    // 2. Return Reminders (status is active or ongoing and ends in <= 1 hour)
    const returnWindow = new Date(now.getTime() + 1 * 60 * 60 * 1000)
    const bookingsForReturn = await Booking.find({
      status: { $in: ['active', 'ongoing'] },
      endTime: { $gte: now, $lte: returnWindow },
      returnReminderSent: { $ne: true }
    })
    for (const b of bookingsForReturn) {
      await sendNotification(b.renterId, {
        type: 'reminder',
        title: 'Return Reminder ⏰',
        message: `Your ride for ${b.vehicleName} ends soon. Please return vehicle before deadline.`,
        bookingId: b._id,
        vehicleId: b.vehicleId,
        link: '/my-bookings'
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
        bookingId: b._id,
        vehicleId: b.vehicleId,
        link: '/my-bookings'
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

app.delete('/api/notifications/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Notification not found' })
    }
    const notif = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    })
    if (!notif) return res.status(404).json({ message: 'Notification not found' })
    res.json({ success: true, message: 'Notification deleted' })
  } catch (err) {
    next(err)
  }
})

app.delete('/api/notifications', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    await Notification.deleteMany({ userId: req.user._id })
    res.json({ success: true, message: 'All notifications deleted' })
  } catch (err) {
    next(err)
  }
})

// Simulated email API endpoints — strictly restricted to explicit local development environment
const requireDevelopmentEnv = (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' })
  }
  next()
}

app.get('/api/emails/simulated', requireDevelopmentEnv, verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
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

app.delete('/api/emails/simulated', requireDevelopmentEnv, verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
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

async function recalculateVehicleRating(vehicleId) {
  if (!vehicleId) return
  try {
    const vId = typeof vehicleId === 'string' ? new mongoose.Types.ObjectId(vehicleId) : vehicleId
    const stats = await Review.aggregate([
      { $match: { vehicleId: vId, reviewType: 'vehicle' } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ])
    const rating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0
    const totalReviews = stats.length > 0 ? stats[0].count : 0
    await Vehicle.findByIdAndUpdate(vId, { rating, totalReviews })
  } catch (err) {
    console.error('Error recalculating vehicle rating:', err)
  }
}

async function recalculateUserRating(userId) {
  if (!userId) return
  try {
    const uId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId
    const stats = await Review.aggregate([
      { $match: { reviewedUserId: uId } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ])
    const rating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0
    const totalReviews = stats.length > 0 ? stats[0].count : 0
    await User.findByIdAndUpdate(uId, { rating, totalReviews })
  } catch (err) {
    console.error('Error recalculating user rating:', err)
  }
}

app.post('/api/reviews', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  const { bookingId, rating, comment, reviewType } = req.body
  if (!bookingId || !rating || !reviewType) {
    return res.status(400).json({ message: 'bookingId, rating, and reviewType are required' })
  }

  const numRating = Number(rating)
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: 'Rating must be a number between 1 and 5' })
  }

  try {
    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' })
    }

    // Only completed bookings can leave reviews
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Reviews can only be submitted after the rental is completed' })
    }

    const renterIdStr = (booking.userId || booking.renterId)?.toString()
    const ownerIdStr = booking.ownerId?.toString()
    const callerIdStr = req.user._id.toString()

    const isRenter = renterIdStr === callerIdStr
    const isOwner = ownerIdStr === callerIdStr

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
      return res.status(400).json({ message: 'Invalid reviewType (must be vehicle, owner, or customer)' })
    }

    // Check for duplicate review in DB
    const existing = await Review.findOne({
      bookingId,
      reviewerId: req.user._id,
      reviewType
    })
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted a review for this completed booking' })
    }

    const reviewedUserId = reviewType === 'customer' ? (booking.userId || booking.renterId) : booking.ownerId

    // Create review
    const review = await Review.create({
      bookingId,
      reviewerId: req.user._id,
      reviewerName: req.user.name || 'User',
      reviewedUserId,
      vehicleId: booking.vehicleId,
      vehicleName: booking.vehicleName || (booking.vehicleSnapshot?.name || 'Vehicle'),
      rating: numRating,
      comment: comment ? comment.trim() : '',
      reviewType
    })

    // Recalculate average ratings
    if (reviewType === 'vehicle' && booking.vehicleId) {
      await recalculateVehicleRating(booking.vehicleId)
    } else if (reviewedUserId) {
      await recalculateUserRating(reviewedUserId)
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
      .populate('reviewerId', 'name avatar')
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
      .populate('reviewerId', 'name avatar')
      .lean()
    res.json({ reviews })
  } catch (err) {
    next(err)
  }
})

app.get('/api/reviews/my', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const reviews = await Review.find({ reviewerId: req.user._id })
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

app.patch('/api/reviews/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { rating, comment } = req.body
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review not found' })

    const isAuthor = review.reviewerId?.toString() === req.user._id.toString()
    if (!isAuthor) {
      return res.status(403).json({ message: 'Forbidden: You cannot modify another user\'s review' })
    }

    if (rating !== undefined) {
      const num = Number(rating)
      if (isNaN(num) || num < 1 || num > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' })
      }
      review.rating = num
    }
    if (comment !== undefined) {
      review.comment = comment.trim()
    }

    await review.save()

    if (review.reviewType === 'vehicle' && review.vehicleId) {
      await recalculateVehicleRating(review.vehicleId)
    } else if (review.reviewedUserId) {
      await recalculateUserRating(review.reviewedUserId)
    }

    res.json({ success: true, review })
  } catch (err) {
    next(err)
  }
})

app.delete('/api/reviews/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id)
    if (!review) return res.status(404).json({ message: 'Review not found' })

    const isAuthor = review.reviewerId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot delete another user\'s review' })
    }

    await Review.findByIdAndDelete(req.params.id)

    if (isAdmin && !isAuthor) {
      await logAdminAction(
        req.user,
        'moderate_review',
        { collectionName: 'reviews', docId: review._id.toString(), name: `Review by ${review.reviewerName}` },
        req.body?.reason || 'Review moderated/removed by admin'
      )
    }

    if (review.reviewType === 'vehicle' && review.vehicleId) {
      await recalculateVehicleRating(review.vehicleId)
    } else if (review.reviewedUserId) {
      await recalculateUserRating(review.reviewedUserId)
    }

    res.json({ success: true, message: 'Review deleted successfully' })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/reviews', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .populate('reviewerId', 'name email avatar')
      .populate('vehicleId', 'name brand model')
      .lean()
    res.json({ reviews })
  } catch (err) {
    next(err)
  }
})

// ── Trust & Safety Endpoints ───────────────────────────────

// ── Trust & Safety Endpoints ───────────────────────────────

// 1. Reports
app.post('/api/safety/report', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { targetType, targetId, reason, description, evidence } = req.body
    if (!['user', 'vehicle', 'booking'].includes(targetType) || !targetId || !reason) {
      return res.status(400).json({ message: 'Missing required report fields (targetType, targetId, reason)' })
    }

    const formattedEvidence = Array.isArray(evidence)
      ? evidence.map(e => typeof e === 'string' ? { url: e } : e)
      : (evidence ? [{ url: typeof evidence === 'string' ? evidence : evidence.url }] : [])

    const report = await Report.create({
      reporterId: req.user._id,
      targetType,
      targetId,
      reason,
      description: description || '',
      evidence: formattedEvidence,
      status: 'open'
    })

    // Notify primary admin
    const adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' })
    if (adminUser) {
      await sendNotification(adminUser._id, {
        type: 'general',
        title: 'New User/Vehicle Report Filed 🛡️',
        message: `Report filed for ${targetType} (ID: ${targetId}): ${reason}`,
        link: '/admin/safety'
      })
    }

    res.status(201).json({ success: true, report })
  } catch (err) {
    next(err)
  }
})

app.get('/api/safety/my-reports', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const reports = await Report.find({ reporterId: req.user._id }).sort({ createdAt: -1 }).lean()
    res.json({ reports })
  } catch (err) {
    next(err)
  }
})

app.get('/api/safety/reports/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Report not found' })
    }
    const report = await Report.findById(req.params.id).populate('reporterId', 'name email').lean()
    if (!report) return res.status(404).json({ message: 'Report not found' })

    const isCreator = report.reporterId?._id?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot access another user\'s report' })
    }

    res.json({ report })
  } catch (err) {
    next(err)
  }
})

// 2. Disputes
app.post('/api/safety/dispute', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, reason, description, evidence } = req.body
    if (!bookingId || !reason) {
      return res.status(400).json({ message: 'Missing required dispute fields (bookingId, reason)' })
    }

    const formattedEvidence = Array.isArray(evidence)
      ? evidence.map(e => typeof e === 'string' ? { url: e } : e)
      : (evidence ? [{ url: typeof evidence === 'string' ? evidence : evidence.url }] : [])

    const initialMessage = description ? [{
      senderId: req.user._id,
      senderName: req.user.name || 'User',
      message: description,
      isAdmin: false,
      timestamp: new Date()
    }] : []

    const dispute = await Dispute.create({
      raisedBy: req.user._id,
      bookingId,
      reason,
      description: description || '',
      evidence: formattedEvidence,
      messages: initialMessage,
      status: 'open'
    })

    // Notify primary admin
    const adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' })
    if (adminUser) {
      await sendNotification(adminUser._id, {
        type: 'general',
        title: 'New Booking Dispute Raised ⚠️',
        message: `Dispute raised on booking ${bookingId}: ${reason}`,
        bookingId,
        link: '/admin/safety'
      })
    }

    res.status(201).json({ success: true, dispute })
  } catch (err) {
    next(err)
  }
})

app.get('/api/safety/my-disputes', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const disputes = await Dispute.find({ raisedBy: req.user._id }).sort({ createdAt: -1 }).lean()
    res.json({ disputes })
  } catch (err) {
    next(err)
  }
})

app.get('/api/safety/disputes/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Dispute not found' })
    }
    const dispute = await Dispute.findById(req.params.id).populate('raisedBy', 'name email').lean()
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' })

    const isCreator = dispute.raisedBy?._id?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot access another user\'s dispute' })
    }

    res.json({ dispute })
  } catch (err) {
    next(err)
  }
})

app.post('/api/safety/disputes/:id/messages', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { message } = req.body
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message content is required' })
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Dispute not found' })
    }

    const dispute = await Dispute.findById(req.params.id)
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' })

    const isCreator = dispute.raisedBy?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    dispute.messages.push({
      senderId: req.user._id,
      senderName: req.user.name || (isAdmin ? 'Admin' : 'User'),
      message: message.trim(),
      isAdmin,
      timestamp: new Date()
    })

    if (isAdmin && dispute.status === 'open') {
      dispute.status = 'under_review'
    }

    await dispute.save()

    // Notify the other party
    if (isAdmin) {
      await sendNotification(dispute.raisedBy, {
        type: 'general',
        title: 'New Message on Dispute 💬',
        message: `Admin replied on your dispute: "${message.slice(0, 80)}..."`,
        bookingId: dispute.bookingId,
        link: '/my-bookings'
      })
    }

    res.json({ success: true, dispute: dispute.toObject() })
  } catch (err) {
    next(err)
  }
})

// 3. SOS Emergency
app.post('/api/safety/sos', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, location } = req.body
    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID required for SOS' })
    }
    const sos = await SOS.create({
      userId: req.user._id,
      bookingId,
      location: location || 'Unknown Location'
    })
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

// ── Support Tickets User Endpoints ──────────────────────────

app.post('/api/support/tickets', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { subject, category, message, priority, evidence } = req.body
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' })
    }

    const formattedEvidence = Array.isArray(evidence)
      ? evidence.map(e => typeof e === 'string' ? { url: e } : e)
      : (evidence ? [{ url: typeof evidence === 'string' ? evidence : evidence.url }] : [])

    const ticket = await Ticket.create({
      userId: req.user._id,
      userName: req.user.name || 'User',
      userEmail: req.user.email,
      subject,
      category: category || 'General',
      priority: priority || 'medium',
      status: 'open',
      evidence: formattedEvidence,
      messages: [{
        senderId: req.user._id,
        senderName: req.user.name || 'User',
        message,
        isAdmin: false,
        timestamp: new Date()
      }]
    })

    // Notify primary admin
    const adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' })
    if (adminUser) {
      await sendNotification(adminUser._id, {
        type: 'general',
        title: 'New Support Ticket Created 🎫',
        message: `${ticket.userName} opened ticket: ${ticket.subject}`,
        link: '/admin/support'
      })
    }

    res.status(201).json({ success: true, ticket })
  } catch (err) {
    next(err)
  }
})

app.get('/api/support/my-tickets', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ userId: req.user._id }).sort({ updatedAt: -1 }).lean()
    res.json({ tickets })
  } catch (err) {
    next(err)
  }
})

app.get('/api/support/tickets/:id', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Ticket not found' })
    }
    const ticket = await Ticket.findById(req.params.id).lean()
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

    const isCreator = ticket.userId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot access another user\'s support ticket' })
    }

    res.json({ ticket })
  } catch (err) {
    next(err)
  }
})

app.post('/api/support/tickets/:id/reply', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { message } = req.body
    if (!message || !message.trim()) return res.status(400).json({ message: 'Message is required' })

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Ticket not found' })
    }

    const ticket = await Ticket.findById(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

    const isCreator = ticket.userId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role) && req.user.email?.toLowerCase() === 'dasstranger421@gmail.com'
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    ticket.messages.push({
      senderId: req.user._id,
      senderName: req.user.name || (isAdmin ? 'Admin' : 'User'),
      message: message.trim(),
      isAdmin,
      timestamp: new Date()
    })
    if (isAdmin) ticket.status = 'in_progress'
    await ticket.save()

    // Notify other party
    if (isAdmin) {
      await sendNotification(ticket.userId, {
        type: 'general',
        title: `Support Reply: ${ticket.subject} 💬`,
        message: `Support team replied: "${message.slice(0, 80)}..."`,
        link: '/hub'
      })
    } else {
      const adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' })
      if (adminUser) {
        await sendNotification(adminUser._id, {
          type: 'general',
          title: `User Replied on Ticket: ${ticket.subject} 💬`,
          message: `${ticket.userName}: "${message.slice(0, 80)}..."`,
          link: '/admin/support'
        })
      }
    }

    res.json({ success: true, ticket: ticket.toObject() })
  } catch (err) {
    next(err)
  }
})

// ── Admin Safety & Support Management API ───────────────────

app.patch('/api/admin/users/:id/suspend', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const { isSuspended, reason } = req.body
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: !!isSuspended, status: isSuspended ? 'suspended' : 'active' },
      { new: true }
    )
    if (!user) return res.status(404).json({ message: 'User not found' })

    await logAdminAction(
      req.user,
      isSuspended ? 'suspend_user' : 'restore_user',
      { collectionName: 'users', docId: user._id.toString(), name: user.name },
      reason || (isSuspended ? 'User account suspended' : 'User account restored')
    )

    res.json({ success: true, user: safeUser(user.toObject()) })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/users/:id/fraud', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const { fraudScore } = req.body
    const user = await User.findByIdAndUpdate(req.params.id, { fraudScore }, { new: true })
    if (!user) return res.status(404).json({ message: 'User not found' })

    await logAdminAction(
      req.user,
      'update_fraud_score',
      { collectionName: 'users', docId: user._id.toString(), name: user.name },
      `Fraud score set to ${fraudScore}`
    )

    res.json({ success: true, user: safeUser(user.toObject()) })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/safety/reports', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).populate('reporterId', 'name email').lean()
    res.json({ reports })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/safety/reports/:id/status', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body
    const validStatuses = ['open', 'under_review', 'resolved', 'closed', 'rejected', 'pending', 'investigating', 'dismissed']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date(), resolvedBy: req.user._id } : {})
      },
      { new: true }
    )
    if (!report) return res.status(404).json({ message: 'Report not found' })

    await logAdminAction(
      req.user,
      `report_${status}`,
      { collectionName: 'reports', docId: report._id.toString(), name: `Report on ${report.targetType}` },
      adminNotes || `Report status updated to ${status}`
    )

    await sendNotification(report.reporterId, {
      type: 'general',
      title: `Report Status Updated: ${status.toUpperCase()}`,
      message: `Your report regarding ${report.targetType} (ID: ${report.targetId}) is now marked as ${status}.`,
      link: '/hub'
    })

    res.json({ success: true, report: report.toObject() })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/safety/disputes', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const disputes = await Dispute.find().sort({ createdAt: -1 }).populate('raisedBy', 'name email').lean()
    res.json({ disputes })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/safety/disputes/:id/status', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body
    const validStatuses = ['open', 'under_review', 'resolved', 'closed', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    const dispute = await Dispute.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date(), resolvedBy: req.user._id } : {})
      },
      { new: true }
    )
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' })

    await logAdminAction(
      req.user,
      `dispute_${status}`,
      { collectionName: 'disputes', docId: dispute._id.toString(), name: `Dispute on booking ${dispute.bookingId}` },
      adminNotes || `Dispute status updated to ${status}`
    )

    await sendNotification(dispute.raisedBy, {
      type: 'general',
      title: `Dispute Case Updated: ${status.toUpperCase()} ⚖️`,
      message: `Your dispute for booking ${dispute.bookingId} has been updated to ${status}. Notes: ${adminNotes || 'None'}`,
      bookingId: dispute.bookingId,
      link: '/my-bookings'
    })

    res.json({ success: true, dispute: dispute.toObject() })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/safety/sos', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const sosList = await SOS.find().sort({ createdAt: -1 }).populate('userId', 'name email phone').lean()
    res.json({ sosList })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/support/tickets', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const tickets = await Ticket.find().sort({ updatedAt: -1 }).lean()
    res.json({ tickets })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/support/tickets/:id/reply', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const { message } = req.body
    if (!message) return res.status(400).json({ message: 'Message is required' })

    const ticket = await Ticket.findById(req.params.id)
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

    ticket.messages.push({
      senderId: req.user._id,
      senderName: req.user.name || 'Admin',
      message,
      isAdmin: true,
      timestamp: new Date()
    })
    ticket.status = 'in_progress'
    await ticket.save()

    await logAdminAction(
      req.user,
      'ticket_reply',
      { collectionName: 'tickets', docId: ticket._id.toString(), name: ticket.subject },
      `Replied: ${message.slice(0, 100)}`
    )

    // Send in-app notification to the ticket owner
    await sendNotification(ticket.userId, {
      type: 'general',
      title: `Reply on Ticket: ${ticket.subject} 💬`,
      message: `Support team replied: "${message.slice(0, 80)}..."`,
      link: '/hub'
    })

    res.json({ success: true, ticket: ticket.toObject() })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/support/tickets/:id/status', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body
    if (!['open', 'under_review', 'in_progress', 'resolved', 'closed', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date(), resolvedBy: req.user._id } : {})
      },
      { new: true }
    )
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' })

    await logAdminAction(
      req.user,
      `ticket_${status}`,
      { collectionName: 'tickets', docId: ticket._id.toString(), name: ticket.subject },
      adminNotes || `Ticket status updated to ${status}`
    )

    await sendNotification(ticket.userId, {
      type: 'general',
      title: `Support Ticket Updated: ${status.toUpperCase()} 🎫`,
      message: `Your ticket "${ticket.subject}" is now ${status}.`,
      link: '/hub'
    })

    res.json({ success: true, ticket: ticket.toObject() })
  } catch (err) {
    next(err)
  }
})

// ── Admin Audit Logs API ────────────────────────────────────

app.get('/api/admin/audit-logs', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean()
    res.json({ logs })
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
app.use((err, req, res, next) => {
  console.error("========== SERVER ERROR ==========");
  console.error(err);
  console.error(err.stack);

  res.status(err.status || 500).json({
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
  });
});

// ── Start ──────────────────────────────────────────────────
async function start() {
  try {
    logger.info('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
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

// Process error handlers
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
})

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

process.on('SIGTERM', async () => {
  try {
    await mongoose.connection.close()
    logger.info('MongoDB disconnected. Server stopped.')
  } catch (err) {
    logger.error('Error during shutdown', err)
  }
  process.exit(0)
})

start()

