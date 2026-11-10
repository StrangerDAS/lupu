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
import fs from 'fs'
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
import { kycUpload, vehicleUpload, avatarUpload, faceUpload } from './middleware/uploadMiddleware.js'
import Verification from './models/Verification.js'
import {
  requireVerifiedRenter,
  maskAadhaarNumber,
  maskDrivingLicenseNumber,
  maskStudentIdNumber,
  maskDocumentNumber,
  checkRenterBookingEligibility,
} from './middleware/verificationGuard.js'
import { logger } from './utils/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { rateLimiter } from './middleware/rateLimiter.js'
import { verifyFirebaseToken, requireMongoUser } from './middleware/authMiddleware.js'
import {
  generateVehiclePhotoSignature,
  generateVehiclePhotoBatchSignatures,
  deleteCloudinaryAsset,
  extractPublicIdFromUrl,
  VEHICLE_PHOTOS_FOLDER,
  cloudinary,
  ensureCloudinaryConfigured
} from './utils/cloudinaryConfig.js'
import {
  generateSecureDocumentUrl,
  resolveSecureFilePath,
  verifyDocumentToken,
  SECURE_UPLOAD_DIR
} from './utils/secureStorage.js'
import { verificationSubmissionLimiter } from './middleware/rateLimiter.js'
import { verificationProviderManager } from './adapters/verificationProvider.js'


/**
 * Upload a verification document file to Cloudinary so it is permanently hosted in the cloud.
 * Sensitive identity documents are stored with type: 'authenticated' to prevent unauthorized public access.
 */
async function uploadDocumentFileToCloud(file, fallbackUrl, customFolder = 'lupu/secure-identity') {
  if (!file) return fallbackUrl || null
  const isIdentityDoc = customFolder.includes('identity') || customFolder.includes('verification')
  try {
    ensureCloudinaryConfigured()
    const isPdf = file.mimetype === 'application/pdf' || (file.originalname && file.originalname.toLowerCase().endsWith('.pdf'))
    const uploadOptions = {
      folder: customFolder,
      resource_type: 'image',
      ...(isIdentityDoc ? { type: 'authenticated' } : {}),
      ...(isPdf ? { format: 'png' } : {})
    }
    const result = await cloudinary.uploader.upload(file.path, uploadOptions)
    // Clean up local temp file
    try { fs.unlinkSync(file.path) } catch (_) {}
    return result.secure_url
  } catch (err) {
    console.warn('[Documents] Cloudinary upload fallback to secure disk:', err.message)
    if (isIdentityDoc) {
      return `/secure-uploads/${file.filename}`
    }
    return `/uploads/${file.filename}`
  }
}

/**
 * Validates that base64 payload starts with valid JPEG, PNG, or WebP magic bytes.
 */
function isValidImageBase64(base64Data) {
  try {
    const buffer = Buffer.from(base64Data.slice(0, 32), 'base64')
    if (buffer.length < 4) return false
    // JPEG: 0xFF, 0xD8, 0xFF
    const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
    // PNG: 0x89, 0x50, 0x4E, 0x47
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
    // WebP: 'RIFF' .... 'WEBP'
    const isWebP = buffer.slice(0, 4).toString() === 'RIFF'
    return isJpeg || isPng || isWebP
  } catch (_) {
    return false
  }
}

/**
 * Upload base64 data URL to Cloudinary with authenticated type (used for live selfie and mobile document uploads).
 * Validates magic bytes to prevent non-image payloads from being stored.
 */
async function uploadDataUrlToCloud(dataUrl, folder = 'lupu/secure-identity', prefix = 'doc') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return null
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  if (!isValidImageBase64(base64Data)) {
    console.warn(`[SecureStorage] uploadDataUrlToCloud rejected: invalid image magic bytes for ${prefix}`)
    return null
  }
  try {
    ensureCloudinaryConfigured()
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder,
      resource_type: 'image',
      type: 'authenticated',
    })
    return result.secure_url
  } catch (err) {
    console.warn(`[SecureStorage] Cloudinary uploadDataUrl fallback to secure disk for ${prefix}:`, err.message)
    try {
      const ext = dataUrl.includes('image/png') ? 'png' : 'jpg'
      const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`
      const filePath = path.join(SECURE_UPLOAD_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
      return `/secure-uploads/${filename}`
    } catch (fsErr) {
      console.error(`[SecureStorage] Fallback failed for ${prefix}:`, fsErr.message)
      return null
    }
  }
}

// Role-based authorization helper
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    const isFounderOrSoleAdmin = req.user.email?.toLowerCase() === 'dasstranger421@gmail.com' || req.user.role === 'founder'
    if (isFounderOrSoleAdmin) return next()
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    next()
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import paymentRoutes from './routes/paymentRoutes.js'

const app = express()

// Security Shield: Block direct public static access to identity documents and selfies in /uploads
app.use('/uploads', (req, res, next) => {
  const sensitiveRegex = /(document|aadhaar|student|driving|license|selfie|kyc|pan|liveFrame)/i
  if (sensitiveRegex.test(req.path)) {
    return res.status(403).json({
      success: false,
      message: 'Direct public access to identity document files is strictly forbidden. Authorized admins must use signed URLs.'
    })
  }
  next()
})
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
  const isSelf = callerId && (rest._id?.toString() === callerId.toString())
  if (!isSelf && !isAdmin) {
    if (rest.payoutDetails && rest.payoutDetails.accountNumber) {
      const rawAcc = String(rest.payoutDetails.accountNumber)
      rest.payoutDetails = {
        ...rest.payoutDetails,
        accountNumber: `**** **** ${rawAcc.slice(-4)}`
      }
    }
    // Delete all private document URLs and sensitive metadata for non-self / non-admin callers
    delete rest.aadhaarFrontUrl
    delete rest.aadhaarBackUrl
    delete rest.documentFrontUrl
    delete rest.documentBackUrl
    delete rest.drivingLicenseUrl
    delete rest.drivingLicenseBackUrl
    delete rest.governmentIdUrl
    delete rest.collegeIdUrl
    delete rest.panUrl
    delete rest.selfieUrl
    delete rest.panNumber
    delete rest.kycDetails
    delete rest.maskedDocumentNumber
    delete rest.aadhaarNumber
    delete rest.drivingLicenseNumber
    delete rest.drivingLicenseExpiry
    delete rest.drivingLicenseCategories
  }

  // Prevent permanent raw identity document URLs from leaking in API responses
  if (!isAdmin) {
    delete rest.aadhaarFrontUrl
    delete rest.aadhaarBackUrl
    delete rest.documentFrontUrl
    delete rest.documentBackUrl
    delete rest.drivingLicenseUrl
    delete rest.drivingLicenseBackUrl
    delete rest.governmentIdUrl
    delete rest.collegeIdUrl
    delete rest.panUrl
    delete rest.selfieUrl
  }

  // Strictly enforce Aadhaar privacy: NEVER expose full Aadhaar in API responses
  if (rest.aadhaarNumber) {
    rest.aadhaarNumber = maskAadhaarNumber(rest.aadhaarNumber)
  }
  if (rest.kycDetails && rest.kycDetails.aadhaarNumber) {
    rest.kycDetails = {
      ...rest.kycDetails,
      aadhaarNumber: maskAadhaarNumber(rest.kycDetails.aadhaarNumber),
    }
  }
  if (rest.drivingLicenseNumber && !isAdmin) {
    rest.drivingLicenseNumber = maskDrivingLicenseNumber(rest.drivingLicenseNumber)
  }

  // Ensure computed verification state is accurate
  const isOfficiallyVerified =
    rest.verificationStatus === 'verified' ||
    rest.isVerified === true ||
    (rest.documentStatus === 'document_verified' && rest.faceStatus === 'face_verified') ||
    String(rest.kycStatus || '').toLowerCase() === 'verified'

  rest.isVerified = isOfficiallyVerified
  if (isOfficiallyVerified && rest.verificationStatus !== 'verified') {
    rest.verificationStatus = 'verified'
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
    return { valid: false, message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' }
  }
  const digits = match[1]
  return { valid: true, cleanDigits: digits, formatted: `+91${digits}` }
}

const ACCEPTED_CONTACT_STATUSES = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed', 'completed']

async function enrichBookingWithContact(booking, requestingUser) {
  if (!booking) return null
  const b = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking }

  // Populate vehicle photos, specs, locations
  if (b.vehicleId) {
    const vehicleId = b.vehicleId._id || b.vehicleId
    if (!b.vehicle || !b.vehicle.images || b.vehicle.images.length === 0) {
      try {
        const v = await Vehicle.findById(vehicleId).select('name brand model type images photos location pricePerHour numberPlate specs').lean()
        if (v) {
          b.vehicle = v
          b.vehicleName = b.vehicleName || v.name
          b.vehicleType = b.vehicleType || v.type
          b.pickupLocation = b.pickupLocation || v.location?.address || 'Dibrugarh University Campus'
          b.returnLocation = b.returnLocation || v.location?.address || 'Dibrugarh University Campus'
        }
      } catch (err) {
        console.error('Error fetching vehicle for booking enrichment:', err.message)
      }
    }
  }
  b.pickupLocation = b.pickupLocation || 'Dibrugarh University Campus'
  b.returnLocation = b.returnLocation || 'Dibrugarh University Campus'

  if (!requestingUser) {
    delete b.ownerPhone
    delete b.renterPhone
    return b
  }
  const isRenter = b.renterId && (b.renterId._id || b.renterId).toString() === requestingUser._id.toString()
  const isOwner = b.ownerId && (b.ownerId._id || b.ownerId).toString() === requestingUser._id.toString()
  const isAdmin = ['admin', 'super_admin', 'founder'].includes(requestingUser.role)

  const normalizedStatus = (b.status || '').toLowerCase()
  const isAcceptedOrLater = ACCEPTED_CONTACT_STATUSES.includes(normalizedStatus)

  // Reveal owner contact to renter only if accepted or later
  if ((isRenter || isAdmin) && isAcceptedOrLater && b.ownerId) {
    const ownerId = b.ownerId._id || b.ownerId
    const owner = await User.findById(ownerId).select('name phone email').lean()
    if (owner) {
      b.ownerName = owner.name || b.ownerName || 'Vehicle Owner'
      b.ownerPhone = owner.phone || null
      b.ownerEmail = owner.email || null
    }
  } else {
    delete b.ownerPhone
    delete b.ownerEmail
  }

  // Reveal renter contact to owner
  if ((isOwner || isAdmin) && b.renterId) {
    const renterId = b.renterId._id || b.renterId
    const renter = await User.findById(renterId).select('name phone email').lean()
    if (renter) {
      b.renterName = renter.name || b.renterName || 'Renter'
      b.renterPhone = renter.phone || null
      b.renterEmail = renter.email || b.renterEmail || null
    }
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

// ── Cloudinary: Generate signed upload parameters for vehicle photos ──────────
// The browser uploads images DIRECTLY to Cloudinary — no binary passes through
// this server. The API Secret is never sent to the client.
app.post('/api/vehicles/upload-signature', verifyFirebaseToken, requireMongoUser, authorize('owner', 'admin', 'user'), async (req, res) => {
  try {
    const { vehicleId, photoIndex, count } = req.body

    // Validate input
    if (!vehicleId || typeof vehicleId !== 'string' || vehicleId.length < 3) {
      return res.status(400).json({ message: 'vehicleId is required (min 3 chars)' })
    }

    // Ensure Cloudinary is configured (env vars present)
    try {
      ensureCloudinaryConfigured()
    } catch (configErr) {
      console.error('[Cloudinary] Configuration error:', configErr.message)
      return res.status(503).json({ message: 'Image upload service is not configured. Contact support.' })
    }

    // Batch mode: client requests multiple signatures in a single network round-trip
    if (count !== undefined && parseInt(count, 10) > 1) {
      const batchSignatures = generateVehiclePhotoBatchSignatures(vehicleId, count)
      console.log(`[Cloudinary] Batch signatures (${batchSignatures.length}) issued for vehicle=${vehicleId} owner=${req.user.email}`)
      return res.json({ signatures: batchSignatures })
    }

    // Single signature mode (backward compatible)
    const idx = photoIndex !== undefined ? String(photoIndex) : undefined
    const sig = generateVehiclePhotoSignature(vehicleId, idx)

    // Log for audit (never log the secret itself)
    console.log(`[Cloudinary] Signature issued for vehicle=${vehicleId} owner=${req.user.email} idx=${idx ?? 'auto'}`)

    res.json(sig)
  } catch (err) {
    console.error('POST /api/vehicles/upload-signature error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Cloudinary: Safe delete of a vehicle photo confirmed by server ────────────
// Only called AFTER the vehicle document has been updated to remove the photo reference.
app.post('/api/vehicles/:id/cleanup-photo', verifyFirebaseToken, requireMongoUser, async (req, res) => {
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

    const { publicId } = req.body
    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ message: 'publicId is required' })
    }

    // Safety: only allow deletion of Cloudinary assets in the vehicle-photos folder
    if (!publicId.startsWith(VEHICLE_PHOTOS_FOLDER)) {
      return res.status(403).json({ message: 'Forbidden: can only delete vehicle-photo assets' })
    }

    // Double-check: asset must NOT be referenced by the current vehicle document
    const allVehiclePhotos = [...(vehicle.photos || []), ...(vehicle.images || [])]
    const isStillReferenced = allVehiclePhotos.some(url => {
      const pid = extractPublicIdFromUrl(url)
      return pid && (pid === publicId || url.includes(publicId))
    })
    if (isStillReferenced) {
      return res.status(409).json({ message: 'Photo is still referenced by the vehicle — save vehicle first.' })
    }

    await deleteCloudinaryAsset(publicId)
    res.json({ deleted: true, publicId })
  } catch (err) {
    console.error('POST /api/vehicles/:id/cleanup-photo error:', err)
    res.status(500).json({ message: 'Failed to delete photo' })
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

    // Parallelize document uploads to Cloudinary to eliminate sequential network latency
    const [rcUrl, insUrl, pucUrl] = await Promise.all([
      uploadDocumentFileToCloud(rcFile, req.body.RC || req.body.documents?.RC),
      uploadDocumentFileToCloud(insFile, req.body.Insurance || req.body.documents?.Insurance),
      uploadDocumentFileToCloud(pucFile, req.body.PUC || req.body.documents?.PUC),
    ])

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
      const keyPattern = err.keyPattern || {}
      if (keyPattern.registrationNumber) {
        return res.status(409).json({ message: 'Vehicle registration number already registered' })
      }
      if (keyPattern.phone) {
        return res.status(409).json({ message: 'Owner phone number is already registered with another account.' })
      }
      return res.status(409).json({ message: 'Duplicate entry detected: vehicle or owner details already exist.' })
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

    // Parallelize document uploads to Cloudinary to eliminate sequential network latency
    const [rcUrl, insUrl, pucUrl] = await Promise.all([
      uploadDocumentFileToCloud(rcFile, req.body.RC || req.body.documents?.RC || vehicle.documents?.RC),
      uploadDocumentFileToCloud(insFile, req.body.Insurance || req.body.documents?.Insurance || vehicle.documents?.Insurance),
      uploadDocumentFileToCloud(pucFile, req.body.PUC || req.body.documents?.PUC || vehicle.documents?.PUC),
    ])
    
    const uploadedFileUrls = photoFiles.map(f => `/uploads/${f.filename}`)
    // bodyPhotos = the photos the client wants to KEEP (existing URLs) + any new local uploads
    // We do NOT merge vehicle.photos here — the client sends the exact desired final list.
    // This fixes the bug where removed photos were re-added from the DB record.
    const bodyPhotos = Array.isArray(req.body.photos) ? req.body.photos : (req.body.photos ? [req.body.photos] : [])
    const photoUrls = Array.from(new Set([...uploadedFileUrls, ...bodyPhotos])).filter(p => typeof p === 'string' && p.trim())

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
      status: { $in: ['pending', 'requested', 'accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'] },
      endTime: { $gt: new Date() }
    }, 'startTime endTime status').sort({ startTime: 1 }).lean()
    
    const disabledDates = bookings.map(b => ({
      start: b.startTime,
      end: b.endTime
    }))

    res.json({ bookings, disabledDates })
  } catch (err) {
    next(err)
  }
})

app.post('/api/bookings', verifyFirebaseToken, requireMongoUser, requireVerifiedRenter, async (req, res, next) => {
  try {
    const {
      startTime,
      endTime,
      agreementAccepted,
      agreementVersion,
      agreementAcceptedAt,
      vehicleId,
      verificationDetails,
      paymentMethod,
      pickupLocation,
      returnLocation,
    } = req.body

    if (!agreementAccepted) {
      return res.status(400).json({ message: 'You must read and accept the mandatory Rental Agreement to proceed.' })
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'startTime and endTime are required.' })
    }
    if (!vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ message: 'Valid vehicleId is required.' })
    }

    // Mandatory payment method selection (Cash or Online)
    const normalizedPaymentMethod = (paymentMethod || '').toLowerCase().trim()
    if (!['cash', 'online'].includes(normalizedPaymentMethod)) {
      return res.status(400).json({
        message: "Mandatory payment method selection is required. Please choose either 'cash' or 'online'."
      })
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

    const hours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)))
    const rentalAmount = (hours >= 24 && vehicle.pricePerDay)
      ? Math.ceil(hours / 24) * vehicle.pricePerDay
      : hours * (vehicle.pricePerHour || 49)
    const bookingFee = 0 // Removed for Beta
    const totalAmount = rentalAmount
    const advanceAmount = Math.round(rentalAmount * 0.3)
    const remainingAmount = rentalAmount - advanceAmount

    const vehicleAddress = typeof vehicle.location === 'string' ? vehicle.location : (vehicle.location?.address || 'Dibrugarh University Campus')
    const resolvedPickup = pickupLocation || vehicleAddress
    const resolvedReturn = returnLocation || vehicleAddress

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
      paymentMethod: normalizedPaymentMethod,
      pickupLocation: resolvedPickup,
      returnLocation: resolvedReturn,
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
      message: `You have received a booking request for ${vehicle.name} (${normalizedPaymentMethod === 'cash' ? 'Cash' : 'Online'}).`,
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

    const enrichedBooking = await enrichBookingWithContact(newBooking, req.user)
    res.status(201).json(enrichedBooking || newBooking.toObject())
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

    if (['accepted', 'rejected'].includes(status)) {
      const current = (booking.status || '').toLowerCase().trim()
      if (!['pending', 'requested'].includes(current)) {
        return res.status(400).json({ message: `Cannot ${status} a booking that is already "${booking.status}".` })
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
    if (phone !== undefined) {
      const cleanPhone = typeof phone === 'string' ? phone.trim() : ''
      if (!cleanPhone) {
        updates.phone = null
        updates.phoneVerified = false
      } else {
        const validation = validateIndianPhoneNumber(cleanPhone)
        if (validation.valid) {
          updates.phone = validation.formatted
        } else {
          updates.phone = cleanPhone
        }
      }
    }
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

// ── Notification Preferences ──────────────────────────────
// PATCH /api/users/notification-preferences
// Updates granular notification preferences for the authenticated user.
// Identity is ALWAYS derived from req.user._id — never trusted from body.
app.patch('/api/users/notification-preferences', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    const allowed = [
      'booking', 'vehicle', 'payment', 'email',
      'bookingRequest', 'bookingAccepted', 'bookingRejected', 'bookingCancelled',
      'paymentRecorded', 'paymentConfirmed', 'paymentDisputed',
      'securityAlerts', 'verificationUpdates',
    ]

    const updates = {}
    for (const key of allowed) {
      if (typeof req.body[key] === 'boolean') {
        updates[`notificationPreferences.${key}`] = req.body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid preference fields provided.' })
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true, lean: true }
    )

    res.json({
      success: true,
      message: 'Notification preferences saved.',
      notificationPreferences: updated.notificationPreferences,
    })
  } catch (err) {
    console.error('PATCH /api/users/notification-preferences error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Phone Number Update ──────────────────────────────────
// PATCH /api/users/phone
// Dedicated endpoint for phone update with strict Indian phone validation.
// Preserves the existing owner-contact release rules — phone is NEVER exposed publicly.
app.patch('/api/users/phone', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    const { phone } = req.body

    if (!phone && phone !== '') {
      return res.status(400).json({ message: 'phone field is required.' })
    }

    // Allow clearing phone
    if (phone === '') {
      const updated = await User.findByIdAndUpdate(
        req.user._id,
        { phone: null, phoneVerified: false },
        { new: true, lean: true }
      )
      return res.json({ success: true, message: 'Phone number removed.', user: safeUser(updated) })
    }

    const validation = validateIndianPhoneNumber(phone)
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message })
    }

    // Check uniqueness (exclude current user)
    const existing = await User.findOne({ phone: validation.formatted, _id: { $ne: req.user._id } })
    if (existing) {
      return res.status(409).json({ message: 'This phone number is already registered with another account.' })
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { phone: validation.formatted, phoneVerified: false }, // re-verification required on change
      { new: true, lean: true }
    )

    res.json({
      success: true,
      message: 'Phone number updated. Please verify your new number.',
      user: safeUser(updated),
    })
  } catch (err) {
    console.error('PATCH /api/users/phone error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'This phone number is already in use.' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ── Account Deletion Request ─────────────────────────────
// POST /api/users/request-account-deletion
// Creates a safe deletion request: audit-logged, notifies user.
// Does NOT delete any data. Actual deletion remains admin-controlled.
// Respects financial records, booking history, dispute records, and legal retention.
app.post('/api/users/request-account-deletion', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    const user = req.user

    // Protect admin account
    if (user.email?.toLowerCase() === 'dasstranger421@gmail.com') {
      return res.status(403).json({ message: 'Platform administrator account cannot be deleted.' })
    }

    // Check for active/ongoing bookings (as owner or renter)
    const activeBookings = await Booking.countDocuments({
      $or: [
        { renterId: user._id, status: { $in: ['pending', 'accepted', 'ongoing'] } },
        { ownerId: user._id, status: { $in: ['pending', 'accepted', 'ongoing'] } },
      ],
    })

    if (activeBookings > 0) {
      return res.status(400).json({
        message: `You have ${activeBookings} active booking(s). Please resolve all active bookings before requesting account deletion.`,
        activeBookings,
      })
    }

    // Record the deletion request in the audit log
    await logAdminAction(
      { _id: user._id, name: user.name || 'Unknown', email: user.email || '', role: user.role },
      'account_deletion_requested',
      { collectionName: 'users', docId: user._id.toString(), name: user.name },
      `User ${user.email || user._id} requested account deletion`
    )

    // Notify the user (in-app)
    await sendNotification(user._id, {
      type: 'system',
      title: 'Account Deletion Requested',
      message: 'Your account deletion request has been received. Our team will review it within 7 business days. You will be contacted at your registered email.',
      link: '/dashboard',
    })

    res.json({
      success: true,
      message: 'Account deletion request submitted. Our team will contact you within 7 business days.',
    })
  } catch (err) {
    console.error('POST /api/users/request-account-deletion error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})


app.post('/api/users/kyc', verifyFirebaseToken, requireMongoUser, verificationSubmissionLimiter(), (req, res, next) => {
  kycUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error during KYC submission' })
    }
    next()
  })
}, async (req, res) => {
  try {
    const files = req.files || {}
    const body = req.body || {}

    const getFileUrl = (fieldname) => {
      const file = files[fieldname]?.[0]
      return file ? `/secure-uploads/${file.filename}` : null
    }

    const govUrl = getFileUrl('governmentIdUrl') || getFileUrl('governmentId') || body.governmentIdUrl
    const collegeUrl = getFileUrl('collegeIdUrl') || getFileUrl('collegeId') || body.collegeIdUrl
    const dlUrl = getFileUrl('drivingLicenseUrl') || getFileUrl('drivingLicense') || body.drivingLicenseUrl
    const aadhFrontUrl = getFileUrl('aadhaarFrontUrl') || getFileUrl('aadhaarFront') || body.aadhaarFrontUrl
    const aadhBackUrl = getFileUrl('aadhaarBackUrl') || getFileUrl('aadhaarBack') || body.aadhaarBackUrl
    const panUrl = getFileUrl('panUrl') || getFileUrl('pan') || body.panUrl
    const selfieUrl = getFileUrl('selfieUrl') || getFileUrl('selfie') || body.selfieUrl
    const genericDoc = getFileUrl('document') || body.documentUrl

    let kycDetails = {}
    if (typeof body.kycDetails === 'string') {
      try { kycDetails = JSON.parse(body.kycDetails) } catch (_) {}
    } else if (typeof body.kycDetails === 'object' && body.kycDetails !== null) {
      kycDetails = body.kycDetails
    }

    const updates = {
      kycStatus: 'pending',
      kycSubmittedAt: new Date(),
      kycRejectionReason: null
    }

    if (body.kycType) updates.kycType = body.kycType
    if (body.drivingLicenseNumber) {
      const maskedDl = maskDrivingLicenseNumber(body.drivingLicenseNumber)
      updates.drivingLicenseNumber = maskedDl
      updates.maskedDocumentNumber = maskedDl
    }
    if (body.aadhaarNumber) {
      const maskedAadhaar = maskAadhaarNumber(body.aadhaarNumber)
      updates.aadhaarNumber = maskedAadhaar
      updates.maskedDocumentNumber = maskedAadhaar
    }
    if (body.panNumber) updates.panNumber = body.panNumber

    if (govUrl) updates.governmentIdUrl = govUrl
    if (collegeUrl) updates.collegeIdUrl = collegeUrl
    if (dlUrl) updates.drivingLicenseUrl = dlUrl
    if (aadhFrontUrl) updates.aadhaarFrontUrl = aadhFrontUrl
    if (aadhBackUrl) updates.aadhaarBackUrl = aadhBackUrl
    if (panUrl) updates.panUrl = panUrl
    if (selfieUrl) updates.selfieUrl = selfieUrl

    // Store consolidated details object
    const mergedDetails = {
      ...kycDetails,
      ...(body.drivingLicenseNumber && { drivingLicenseNumber: updates.drivingLicenseNumber }),
      ...(body.aadhaarNumber && { aadhaarNumber: updates.aadhaarNumber }),
      ...(body.panNumber && { panNumber: body.panNumber }),
      ...(govUrl && { governmentIdUrl: govUrl }),
      ...(collegeUrl && { collegeIdUrl: collegeUrl }),
      ...(dlUrl && { drivingLicenseUrl: dlUrl }),
      ...(aadhFrontUrl && { aadhaarFrontUrl: aadhFrontUrl }),
      ...(aadhBackUrl && { aadhaarBackUrl: aadhBackUrl }),
      ...(panUrl && { panUrl: panUrl }),
      ...(selfieUrl && { selfieUrl: selfieUrl }),
      ...(genericDoc && { documentUrl: genericDoc })
    }
    updates.kycDetails = mergedDetails

    // Validate that at least one ID document URL or ID number was provided
    const hasAnyDoc = govUrl || collegeUrl || dlUrl || aadhFrontUrl || aadhBackUrl || panUrl || selfieUrl || genericDoc ||
      body.drivingLicenseNumber || body.aadhaarNumber || body.panNumber || Object.keys(mergedDetails).length > 0

    if (!hasAnyDoc) {
      return res.status(400).json({ message: 'At least one identity document or document number is required' })
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true, lean: true })

    // Send confirmation notification to user
    await sendNotification(req.user._id, {
      type: 'general',
      title: 'KYC Submitted 📋',
      message: 'Your identity documents have been submitted for verification and are under review by our team.',
      link: '/profile'
    })

    res.json({
      success: true,
      message: 'KYC submitted successfully. Verification is pending review.',
      user: safeUser(updated)
    })
  } catch (err) {
    console.error('KYC submit error:', err)
    res.status(500).json({ message: err.message || 'Internal server error during KYC submission' })
  }
})

// ── Mandatory Verification System Endpoints ──────────────────────────────

/**
 * GET /api/users/verification/status
 * Returns comprehensive verification and eligibility status for authenticated renter.
 */
app.get('/api/users/verification/status', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    const user = req.user
    const verification = await Verification.findOne({ userId: user._id }).sort({ createdAt: -1 }).lean()

    const isOfficiallyVerified =
      user.verificationStatus === 'verified' ||
      user.isVerified === true ||
      (user.documentStatus === 'document_verified' && user.faceStatus === 'face_verified') ||
      String(user.kycStatus || '').toLowerCase() === 'verified'

    const overallStatus = isOfficiallyVerified ? 'verified' : (user.verificationStatus || verification?.overallStatus || 'not_started')
    const documentStatus = user.documentStatus || verification?.documentStatus || 'not_started'
    const faceStatus = user.faceStatus || verification?.faceStatus || 'not_started'
    const documentType = user.documentType || verification?.documentType || user.kycType || null
    const maskedDocumentNumber = user.maskedDocumentNumber || verification?.maskedDocumentNumber || null

    res.json({
      overallStatus,
      documentStatus,
      faceStatus,
      documentType,
      maskedDocumentNumber,
      isVerified: isOfficiallyVerified,
      drivingLicenseVerified: !!(user.drivingLicenseVerified || (isOfficiallyVerified && documentType === 'driving_license')),
      drivingLicenseExpiry: user.drivingLicenseExpiry || verification?.drivingLicenseDetails?.expiryDate || null,
      rejectionReason: user.kycRejectionReason || verification?.rejectionReason || null,
      submittedAt: verification?.submittedAt || user.kycSubmittedAt || null,
      reviewedAt: verification?.reviewedAt || null,
      canBook: isOfficiallyVerified,
      verificationId: verification?._id || null,
    })
  } catch (err) {
    console.error('Error in GET /api/users/verification/status:', err)
    res.status(500).json({ message: 'Error retrieving verification status' })
  }
})

/**
 * POST /api/users/verification/document
 * Submits Student ID, Aadhaar Card, or Driving License for verification.
 * Enforces masking, secure storage, and input validation.
 */
app.post('/api/users/verification/document', verifyFirebaseToken, requireMongoUser, verificationSubmissionLimiter(), (req, res, next) => {
  kycUpload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'File upload error during document submission' })
    next()
  })
}, async (req, res) => {
  try {
    const files = req.files || {}
    const body = req.body || {}
    const user = req.user

    const documentType = (body.documentType || body.kycType || 'student_id').toLowerCase().trim()
    if (!['student_id', 'aadhaar', 'driving_license'].includes(documentType)) {
      return res.status(400).json({ message: 'Invalid documentType. Must be student_id, aadhaar, or driving_license.' })
    }

    const frontFile = files.documentFront?.[0] || files.studentIdFront?.[0] || files.studentId?.[0] || files.collegeId?.[0] || files.aadhaarFront?.[0] || files.drivingLicenseFront?.[0] || files.drivingLicense?.[0] || files.document?.[0]
    const backFile = files.documentBack?.[0] || files.aadhaarBack?.[0] || files.drivingLicenseBack?.[0]

    if (!frontFile && !body.documentFrontUrl && !body.collegeIdUrl && !body.aadhaarFrontUrl && !body.drivingLicenseUrl) {
      return res.status(400).json({ message: 'Document front photograph is required.' })
    }

    if (['aadhaar', 'driving_license'].includes(documentType) && !backFile && !body.documentBackUrl && !body.aadhaarBackUrl && !body.drivingLicenseBackUrl) {
      return res.status(400).json({
        message: `Both front and back photographs are required for ${documentType === 'aadhaar' ? 'Aadhaar Card' : 'Driving License'} verification.`
      })
    }

    const rawDocNumber = (body.documentNumber || body.studentIdNumber || body.aadhaarNumber || body.drivingLicenseNumber || '').trim()
    if (!rawDocNumber) {
      return res.status(400).json({ message: 'Document number is required.' })
    }

    // Specific validation
    if (documentType === 'aadhaar') {
      const cleanDigits = rawDocNumber.replace(/\D/g, '')
      if (cleanDigits.length < 12 && !rawDocNumber.includes('XXXX')) {
        return res.status(400).json({ message: 'Please enter a valid 12-digit Aadhaar number.' })
      }
    } else if (documentType === 'driving_license') {
      if (rawDocNumber.length < 6) {
        return res.status(400).json({ message: 'Please enter a valid Driving License number.' })
      }
    } else if (documentType === 'student_id') {
      const inst = (body.institutionName || user.college || '').trim()
      if (!inst) {
        return res.status(400).json({ message: 'Institution / College name is required for Student ID verification.' })
      }
    }

    // Upload files to Cloudinary with authenticated type (with secure local fallback)
    const [frontUrl, backUrl] = await Promise.all([
      frontFile
        ? uploadDocumentFileToCloud(frontFile, null, 'lupu/secure-identity')
        : (body.documentFrontUrl?.startsWith('data:image')
            ? uploadDataUrlToCloud(body.documentFrontUrl, 'lupu/secure-identity', 'doc-front')
            : (body.documentFrontUrl || body.collegeIdUrl || body.aadhaarFrontUrl || body.drivingLicenseUrl || null)),
      backFile
        ? uploadDocumentFileToCloud(backFile, null, 'lupu/secure-identity')
        : (body.documentBackUrl?.startsWith('data:image')
            ? uploadDataUrlToCloud(body.documentBackUrl, 'lupu/secure-identity', 'doc-back')
            : (body.documentBackUrl || body.aadhaarBackUrl || body.drivingLicenseBackUrl || null)),
    ])

    if (!frontUrl) {
      return res.status(400).json({ message: 'Valid document front photograph is required. Image format invalid or unreadable.' })
    }

    const maskedNumber = maskDocumentNumber(documentType, rawDocNumber)

    // Duplicate document check: Ensure document is not already registered with another user
    const existingVerif = await Verification.findOne({
      maskedDocumentNumber: maskedNumber,
      documentType,
      userId: { $ne: user._id },
      overallStatus: { $in: ['verified', 'under_review', 'document_submitted'] },
    }).lean()

    if (existingVerif) {
      return res.status(409).json({
        message: 'This document number is already registered with another active LUPU account. Each identity document can only be used on one profile.'
      })
    }

    // Build document metadata
    const studentIdDetails = documentType === 'student_id' ? {
      studentIdNumberMasked: maskedNumber,
      institutionName: body.institutionName || user.college || 'Dibrugarh University',
      department: body.department || '',
      isVerified: false,
    } : undefined

    const aadhaarDetails = documentType === 'aadhaar' ? {
      lastFourDigits: rawDocNumber.replace(/\D/g, '').slice(-4),
      isCompliant: true,
      isVerified: false,
    } : undefined

    const drivingLicenseDetails = documentType === 'driving_license' ? {
      licenseNumberMasked: maskedNumber,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      categories: body.categories ? (Array.isArray(body.categories) ? body.categories : String(body.categories).split(',').map(c => c.trim())) : ['MCWG'],
      isExpired: body.expiryDate ? new Date(body.expiryDate) <= new Date() : false,
      isVerified: false,
    } : undefined

    // Create or update Verification record
    const verification = await Verification.create({
      userId: user._id,
      documentType,
      documentStatus: 'document_submitted',
      faceStatus: user.faceStatus === 'face_verified' ? 'face_verified' : (user.faceStatus || 'face_pending'),
      overallStatus: user.faceStatus === 'face_verified' ? 'under_review' : 'face_pending',
      maskedDocumentNumber: maskedNumber,
      documentFrontUrl: frontUrl,
      documentBackUrl: backUrl,
      studentIdDetails,
      aadhaarDetails,
      drivingLicenseDetails,
      submittedAt: new Date(),
      auditHistory: [
        {
          action: 'document_submitted',
          performedBy: user._id,
          performedByName: user.name,
          note: `Submitted ${documentType} (${maskedNumber})`,
        }
      ]
    })

    // Update User record
    const userUpdates = {
      documentType,
      documentStatus: 'document_submitted',
      maskedDocumentNumber: maskedNumber,
      verificationStatus: user.faceStatus === 'face_verified' ? 'under_review' : 'face_pending',
      kycType: documentType,
      kycStatus: 'pending',
      kycSubmittedAt: new Date(),
      kycRejectionReason: null,
      isVerified: false,
    }

    if (documentType === 'student_id') {
      userUpdates.collegeIdUrl = frontUrl
      if (body.institutionName) userUpdates.college = body.institutionName
    } else if (documentType === 'aadhaar') {
      userUpdates.aadhaarFrontUrl = frontUrl
      userUpdates.aadhaarBackUrl = backUrl
      userUpdates.aadhaarNumber = maskedNumber
    } else if (documentType === 'driving_license') {
      userUpdates.drivingLicenseUrl = frontUrl
      userUpdates.drivingLicenseBackUrl = backUrl
      userUpdates.drivingLicenseNumber = maskedNumber
      if (body.expiryDate) userUpdates.drivingLicenseExpiry = new Date(body.expiryDate)
      if (drivingLicenseDetails?.categories) userUpdates.drivingLicenseCategories = drivingLicenseDetails.categories
    }

    const updatedUser = await User.findByIdAndUpdate(user._id, userUpdates, { new: true, lean: true })

    await sendNotification(user._id, {
      type: 'general',
      title: 'Identity Document Submitted 📋',
      message: 'Your document was received. Please proceed to live Face Verification to complete the process.',
      link: '/verify'
    })

    res.json({
      success: true,
      message: 'Document submitted successfully. Next, please complete Face Verification.',
      documentStatus: 'document_submitted',
      overallStatus: userUpdates.verificationStatus,
      maskedDocumentNumber: maskedNumber,
      verificationId: verification._id,
      user: safeUser(updatedUser),
    })
  } catch (err) {
    console.error('Document submission error:', err)
    res.status(500).json({ message: err.message || 'Error submitting document' })
  }
})

/**
 * POST /api/users/verification/face
 * Submits live captured selfie with mandatory biometric consent and liveness verification.
 */
app.post('/api/users/verification/face', verifyFirebaseToken, requireMongoUser, verificationSubmissionLimiter(), (req, res, next) => {
  faceUpload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'File upload error during face verification' })
    next()
  })
}, async (req, res) => {
  try {
    const user = req.user
    const body = req.body || {}
    const files = req.files || {}

    // 1. Mandatory Biometric Consent
    const consent = body.biometricConsent === true || body.biometricConsent === 'true' || body.consent === true || body.consent === 'true'
    if (!consent) {
      return res.status(400).json({
        message: 'Explicit user consent is legally required before collecting facial biometric verification data.'
      })
    }

    // 2. Fetch or create verification document
    let verification = await Verification.findOne({ userId: user._id }).sort({ createdAt: -1 })
    if (!verification) {
      return res.status(400).json({
        message: 'Please submit your identity document before completing face verification.'
      })
    }

    // Rate limiting: max 5 face verification attempts per 15 mins
    const now = new Date()
    if (verification.faceAttemptsCount >= 5 && verification.lastFaceAttemptAt && (now - verification.lastFaceAttemptAt < 15 * 60 * 1000)) {
      return res.status(429).json({
        message: 'Too many face verification attempts. Please wait 15 minutes before trying again.'
      })
    }

    const selfieFile = files.selfie?.[0]
    const selfieDataUrl = body.selfieDataUrl || body.selfie

    if (!selfieFile && (!selfieDataUrl || !selfieDataUrl.startsWith('data:image'))) {
      return res.status(400).json({ message: 'Live selfie capture is required.' })
    }

    // Upload selfie with authenticated type to secure storage
    let selfieUrl = null
    if (selfieFile) {
      selfieUrl = await uploadDocumentFileToCloud(selfieFile, null, 'lupu/secure-identity')
    } else if (selfieDataUrl) {
      selfieUrl = await uploadDataUrlToCloud(selfieDataUrl, 'lupu/secure-identity', 'selfie')
    }

    if (!selfieUrl) {
      return res.status(400).json({ message: 'Invalid selfie image format or upload failed. Please capture a clear live facial selfie.' })
    }

    // Record face attempt
    verification.selfieUrl = selfieUrl
    verification.biometricConsentGiven = true
    verification.biometricConsentTimestamp = now
    verification.faceAttemptsCount = (verification.faceAttemptsCount || 0) + 1
    verification.lastFaceAttemptAt = now
    verification.faceStatus = 'face_under_review'
    verification.overallStatus = 'under_review'
    // Explicit: Automated AI face matching & liveness provider not configured yet. Requires manual admin side-by-side review.
    verification.livenessCheckPassed = false
    verification.livenessScore = null

    verification.auditHistory.push({
      action: 'face_submitted',
      performedBy: user._id,
      performedByName: user.name,
      note: 'Live selfie uploaded with biometric consent (pending admin side-by-side comparison)',
    })
    await verification.save()

    // Update User
    const updatedUser = await User.findByIdAndUpdate(user._id, {
      selfieUrl,
      biometricConsent: true,
      biometricConsentAt: now,
      faceStatus: 'face_under_review',
      verificationStatus: 'under_review',
      kycStatus: 'pending',
      isVerified: false,
    }, { new: true, lean: true })

    await sendNotification(user._id, {
      type: 'general',
      title: 'Face Verification Submitted 📸',
      message: 'Your live selfie has been securely recorded. Our team is reviewing your documents for final verification.',
      link: '/customer-dashboard'
    })

    res.json({
      success: true,
      message: 'Face verification submitted successfully. Your identity and face verification are under review.',
      faceStatus: 'face_under_review',
      overallStatus: 'under_review',
      user: safeUser(updatedUser),
    })
  } catch (err) {
    console.error('Face verification error:', err)
    res.status(500).json({ message: err.message || 'Error processing face verification' })
  }
})

/**
 * GET /api/admin/verifications
 * Admin list of renter verifications for review.
 */
app.get('/api/admin/verifications', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const { status, documentType, search } = req.query
    const filter = {}

    if (status && status !== 'all') {
      filter.overallStatus = status
    }
    if (documentType && documentType !== 'all') {
      filter.documentType = documentType
    }

    let query = Verification.find(filter)
      .populate('userId', 'name email phone avatar college role kycStatus verificationStatus documentStatus faceStatus isVerified drivingLicenseVerified drivingLicenseExpiry')
      .sort({ createdAt: -1 })
      .limit(100)

    const list = await query.lean()

    let results = list
    if (search && search.trim()) {
      const s = search.trim().toLowerCase()
      results = results.filter(v =>
        v.userId?.name?.toLowerCase().includes(s) ||
        v.userId?.email?.toLowerCase().includes(s) ||
        v.maskedDocumentNumber?.toLowerCase().includes(s)
      )
    }

    const secureResults = results.map(v => ({
      ...v,
      documentFrontSignedUrl: generateSecureDocumentUrl(v.documentFrontUrl),
      documentBackSignedUrl: generateSecureDocumentUrl(v.documentBackUrl),
      selfieSignedUrl: generateSecureDocumentUrl(v.selfieUrl),
      // Mask raw permanent document storage URLs
      documentFrontUrl: null,
      documentBackUrl: null,
      selfieUrl: null,
    }))

    res.json({ verifications: secureResults, total: secureResults.length })
  } catch (err) {
    console.error('GET /api/admin/verifications error:', err)
    res.status(500).json({ message: 'Error retrieving verifications' })
  }
})

/**
 * GET /api/admin/verifications/secure-file
 * Secure proxy endpoint for viewing locally stored identity documents.
 * Requires a valid HMAC-SHA256 signature and non-expired timestamp (max 15 minutes).
 */
app.get('/api/admin/verifications/secure-file', async (req, res) => {
  try {
    const { path: relativePath, expires, token } = req.query

    if (!relativePath || !expires || !token) {
      return res.status(400).json({ success: false, message: 'Missing document access credentials.' })
    }

    // 1. Expiration check: strictly enforced (max 15 mins)
    const now = Math.floor(Date.now() / 1000)
    if (now > parseInt(expires, 10)) {
      return res.status(403).json({
        success: false,
        message: 'Signed document access URL has expired (15-minute limit exceeded). Please refresh the review dashboard.'
      })
    }

    // 2. Cryptographic signature check
    const isValid = verifyDocumentToken(relativePath, expires, token)
    if (!isValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or tampered document access signature.'
      })
    }

    // 3. Resolve path safely within allowed upload directories
    const resolvedPath = resolveSecureFilePath(relativePath)
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ success: false, message: 'Document file not found.' })
    }

    // 4. Send file with strict privacy headers
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', 'inline')
    return res.sendFile(path.resolve(resolvedPath))
  } catch (err) {
    console.error('Error serving secure document file:', err)
    return res.status(500).json({ success: false, message: 'Error retrieving document file.' })
  }
})

/**
 * GET /api/admin/verifications/:id/document-urls
 * Generates short-lived (max 15-minute) signed access URLs for identity documents.
 * Strictly restricted to authorized administrators.
 */
app.get('/api/admin/verifications/:id/document-urls', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const { id } = req.params
    const verification = await Verification.findById(id).lean()
    if (!verification) {
      return res.status(404).json({ message: 'Verification record not found' })
    }

    const ttlSeconds = 15 * 60 // 15 minutes max
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

    res.json({
      success: true,
      verificationId: verification._id,
      expiresInSeconds: ttlSeconds,
      expiresAt,
      documentFrontSignedUrl: generateSecureDocumentUrl(verification.documentFrontUrl, ttlSeconds),
      documentBackSignedUrl: generateSecureDocumentUrl(verification.documentBackUrl, ttlSeconds),
      selfieSignedUrl: generateSecureDocumentUrl(verification.selfieUrl, ttlSeconds),
    })
  } catch (err) {
    console.error('Error generating signed document URLs:', err)
    res.status(500).json({ message: 'Error generating secure document access URLs' })
  }
})

/**
 * POST /api/webhooks/verification/:provider
 * Handles asynchronous verification updates from Indian KYC providers (HyperVerge, Signzy).
 * Enforces HMAC signature verification, timestamp clock-skew validation, and replay protection.
 */
app.post('/api/webhooks/verification/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const adapter = verificationProviderManager.getAdapter(provider)
    if (!adapter) {
      return res.status(400).json({ success: false, message: `Unsupported verification provider: ${provider}` })
    }

    // 1. Signature Verification
    const isSignatureValid = adapter.verifyWebhookSignature(req)
    if (!isSignatureValid) {
      console.warn(`[Webhook:${provider}] Invalid webhook signature received`)
      return res.status(401).json({ success: false, message: 'Invalid or missing webhook signature' })
    }

    // 2. Process payload
    const parsedResult = await adapter.processWebhookPayload(req.body)
    const { transactionId } = parsedResult

    // 3. Replay Protection: Check if transaction has already been processed
    const isNew = verificationProviderManager.checkAndRecordReplay(transactionId)
    if (!isNew) {
      console.warn(`[Webhook:${provider}] Replay attack detected for transaction: ${transactionId}`)
      return res.status(409).json({ success: false, message: 'Webhook callback has already been processed (duplicate replay)' })
    }

    // 4. Find matching verification record
    const verification = await Verification.findOne({
      $or: [
        { verificationReference: transactionId },
        { 'auditHistory.note': new RegExp(transactionId, 'i') }
      ]
    }).populate('userId')

    if (!verification) {
      console.warn(`[Webhook:${provider}] Verification record not found for transaction: ${transactionId}`)
      return res.status(404).json({ success: false, message: 'No matching verification record found' })
    }

    const user = verification.userId

    // 5. Update statuses atomically based on provider result
    const now = new Date()
    verification.livenessCheckPassed = parsedResult.livenessPassed || false
    verification.livenessScore = parsedResult.livenessScore || null
    verification.faceMatchScore = parsedResult.faceMatchScore || null
    verification.overallStatus = parsedResult.status
    verification.reviewedAt = now

    if (parsedResult.isSuccess) {
      verification.documentStatus = 'document_verified'
      verification.faceStatus = 'face_verified'
      verification.overallStatus = 'verified'
      verification.verifiedAt = now

      if (user) {
        user.isVerified = true
        user.verificationStatus = 'verified'
        user.documentStatus = 'document_verified'
        user.faceStatus = 'face_verified'
        user.kycStatus = 'verified'
        if (verification.documentType === 'driving_license') {
          user.drivingLicenseVerified = true
        }
        await user.save()
      }
    } else if (parsedResult.isRejected) {
      verification.documentStatus = 'document_rejected'
      verification.faceStatus = 'face_failed'
      verification.overallStatus = 'rejected'
      verification.rejectionReason = parsedResult.rawResult?.reason || 'Verification rejected by verification provider.'

      if (user) {
        user.isVerified = false
        user.verificationStatus = 'rejected'
        user.kycStatus = 'rejected'
        user.kycRejectionReason = verification.rejectionReason
        await user.save()
      }
    }

    verification.auditHistory.push({
      action: 'provider_webhook_update',
      performedByName: `${provider.toUpperCase()} Provider API`,
      timestamp: now,
      note: `Webhook processed for transaction ${transactionId}. Status: ${parsedResult.status}`
    })

    await verification.save()

    return res.json({ success: true, message: 'Verification webhook processed successfully' })
  } catch (err) {
    console.error('Error handling verification webhook:', err)
    return res.status(500).json({ success: false, message: err.message || 'Internal server error processing webhook' })
  }
})

/**
 * POST /api/users/verification/provider-session
 * Initializes an Indian verification provider workflow session.
 */
app.post('/api/users/verification/provider-session', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    const user = req.user
    const { documentType } = req.body
    const provider = verificationProviderManager.getActiveProvider()
    const session = await provider.createVerificationSession({
      userId: user._id,
      documentType: documentType || user.documentType || 'student_id',
      redirectUrl: `${req.protocol}://${req.get('host')}/verify`
    })
    res.json({ success: true, session })
  } catch (err) {
    console.error('Error creating provider session:', err)
    res.status(500).json({ message: 'Error initiating verification session' })
  }
})


/**
 * PATCH /api/admin/verifications/:id/review
 * Approves or rejects document and face verification with atomic audit logging.
 */
app.patch('/api/admin/verifications/:id/review', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    const { id } = req.params
    const {
      documentDecision, // 'approved' | 'rejected' | 'keep'
      faceDecision,     // 'approved' | 'rejected' | 'keep'
      overallDecision,  // 'verified' | 'rejected' | 'resubmission_required'
      rejectionReason,
      licenseCategories,
      licenseExpiry
    } = req.body

    const verification = await Verification.findById(id).populate('userId')
    if (!verification) {
      return res.status(404).json({ message: 'Verification record not found' })
    }

    const targetUser = verification.userId
    if (!targetUser) {
      return res.status(404).json({ message: 'Associated user not found' })
    }

    // Separation of duties: Admins cannot approve their own verification
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message: 'Security policy violation: Administrators cannot self-approve their own identity verification.'
      })
    }

    // Update document decision
    if (documentDecision === 'approved') {
      verification.documentStatus = 'document_verified'
      if (verification.documentType === 'student_id' && verification.studentIdDetails) {
        verification.studentIdDetails.isVerified = true
      } else if (verification.documentType === 'aadhaar' && verification.aadhaarDetails) {
        verification.aadhaarDetails.isVerified = true
      } else if (verification.documentType === 'driving_license' && verification.drivingLicenseDetails) {
        verification.drivingLicenseDetails.isVerified = true
        if (licenseExpiry) verification.drivingLicenseDetails.expiryDate = new Date(licenseExpiry)
        if (licenseCategories) verification.drivingLicenseDetails.categories = Array.isArray(licenseCategories) ? licenseCategories : [licenseCategories]
      }
    } else if (documentDecision === 'rejected') {
      verification.documentStatus = 'document_rejected'
    }

    // Update face decision
    if (faceDecision === 'approved') {
      verification.faceStatus = 'face_verified'
      verification.manualFaceMatchApproved = true
      verification.manualFaceMatchApprovedBy = req.user._id
    } else if (faceDecision === 'rejected') {
      verification.faceStatus = 'face_failed'
      verification.faceMismatchReason = rejectionReason || 'Selfie did not match document photograph'
    }

    // Determine overall decision
    let finalOverallStatus = overallDecision
    if (!finalOverallStatus) {
      if (verification.documentStatus === 'document_verified' && verification.faceStatus === 'face_verified') {
        finalOverallStatus = 'verified'
      } else if (verification.documentStatus === 'document_rejected' || verification.faceStatus === 'face_failed') {
        finalOverallStatus = 'rejected'
      } else {
        finalOverallStatus = 'under_review'
      }
    }

    // Critical rule: A renter can ONLY be marked verified if BOTH document & face are approved!
    if (finalOverallStatus === 'verified') {
      if (verification.documentStatus !== 'document_verified' || verification.faceStatus !== 'face_verified') {
        return res.status(400).json({
          message: 'Cannot mark verified: Both Document and Face verification must be approved.'
        })
      }
    }

    verification.overallStatus = finalOverallStatus
    verification.reviewedBy = req.user._id
    verification.reviewedAt = new Date()
    if (finalOverallStatus === 'verified') {
      verification.verifiedAt = new Date()
      verification.rejectionReason = null
    } else if (finalOverallStatus === 'rejected') {
      verification.rejectionReason = rejectionReason || 'Verification rejected by administrator.'
    }

    verification.auditHistory.push({
      action: `admin_review_${finalOverallStatus}`,
      performedBy: req.user._id,
      performedByName: req.user.name,
      note: `Review decision: ${finalOverallStatus}. Reason: ${rejectionReason || 'None'}`,
    })

    await verification.save()

    // Sync User record
    const userUpdates = {
      verificationStatus: finalOverallStatus,
      documentStatus: verification.documentStatus,
      faceStatus: verification.faceStatus,
      isVerified: finalOverallStatus === 'verified',
      kycStatus: finalOverallStatus === 'verified' ? 'verified' : (finalOverallStatus === 'rejected' ? 'rejected' : 'pending'),
      kycRejectionReason: finalOverallStatus === 'rejected' ? (rejectionReason || 'Verification rejected') : null,
    }

    if (verification.documentType === 'driving_license') {
      userUpdates.drivingLicenseVerified = verification.documentStatus === 'document_verified' && finalOverallStatus === 'verified'
      if (licenseExpiry) userUpdates.drivingLicenseExpiry = new Date(licenseExpiry)
      if (licenseCategories) userUpdates.drivingLicenseCategories = Array.isArray(licenseCategories) ? licenseCategories : [licenseCategories]
    }

    const updatedUser = await User.findByIdAndUpdate(targetUser._id, userUpdates, { new: true, lean: true })

    await logAdminAction(
      req.user,
      `renter_verification_${finalOverallStatus}`,
      { collectionName: 'verifications', docId: verification._id.toString(), userId: targetUser._id.toString(), name: targetUser.name },
      `Verification ${finalOverallStatus}. Reason: ${rejectionReason || 'None'}`
    )

    await sendNotification(targetUser._id, {
      type: 'general',
      title: finalOverallStatus === 'verified' ? 'Verification Approved! 🎉' : 'Verification Update ⚠️',
      message: finalOverallStatus === 'verified'
        ? 'Your identity and face verification are complete. You can now book vehicles on LUPU!'
        : `Your verification was rejected. Reason: ${rejectionReason || 'Document or face verification failed'}`,
      link: finalOverallStatus === 'verified' ? '/explore' : '/verify'
    })

    res.json({
      success: true,
      message: `Verification ${finalOverallStatus}`,
      verification,
      user: safeUser(updatedUser)
    })
  } catch (err) {
    console.error('Admin review error:', err)
    res.status(500).json({ message: err.message || 'Error processing verification review' })
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

app.patch('/api/users/:id/role', verifyFirebaseToken, requireMongoUser, authorize('super_admin', 'founder'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' })
    }
    const targetUser = await User.findById(req.params.id)
    if (!targetUser) return res.status(404).json({ message: 'User not found' })

    const newRole = req.body.role

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

app.post('/api/users/role-by-email', verifyFirebaseToken, requireMongoUser, authorize('super_admin', 'founder'), async (req, res) => {
  try {
    const { email, role } = req.body
    if (!email || !role) {
      return res.status(400).json({ message: 'Email and role are required' })
    }
    const emailRegex = new RegExp(`^${email.trim().replace(/[-[\]{}()*+?.,\\^$|#\\s]/g, '\\\\$&')}$`, 'i')
    const targetUser = await User.findOne({ email: emailRegex })
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found with this email in database' })
    }
    targetUser.role = role
    if (role === 'owner') targetUser.isOwner = true
    await targetUser.save()

    await logAdminAction(
      req.user,
      'update_role',
      { collectionName: 'users', docId: targetUser._id.toString(), name: targetUser.name },
      `Changed role to ${role} for ${email}`
    )

    res.json({ success: true, user: safeUser(targetUser.toObject()) })
  } catch (err) {
    console.error('POST /api/users/role-by-email error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

app.delete('/api/users/:id', verifyFirebaseToken, requireMongoUser, authorize('super_admin', 'founder'), async (req, res) => {
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

    // Separation of duties: Admins cannot approve their own verification
    if (req.params.id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        message: 'Security policy violation: Administrators cannot self-approve their own identity verification.'
      })
    }
    const updates = {
      kycStatus: status,
      verificationStatus: status,
      documentStatus: status === 'verified' ? 'document_verified' : 'document_rejected',
      faceStatus: status === 'verified' ? 'face_verified' : 'face_failed',
      isVerified: status === 'verified',
    }
    if (status === 'rejected') {
      updates.kycRejectionReason = reason || 'Your documents were rejected.'
    } else {
      updates.kycRejectionReason = null
    }

    const existingUser = await User.findById(req.params.id)
    if (!existingUser) return res.status(404).json({ message: 'User not found' })

    if (existingUser.kycType === 'driving_license' || existingUser.documentType === 'driving_license') {
      updates.drivingLicenseVerified = status === 'verified'
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updates, { new: true, lean: true })

    // Also sync latest Verification record if present
    await Verification.findOneAndUpdate(
      { userId: req.params.id },
      {
        overallStatus: status,
        documentStatus: updates.documentStatus,
        faceStatus: updates.faceStatus,
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        rejectionReason: updates.kycRejectionReason,
        verifiedAt: status === 'verified' ? new Date() : null,
      },
      { sort: { createdAt: -1 } }
    )

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

// ── Offline Cash Payment Record System ──────────────────────
//
// LUPU payments are direct between renter and vehicle owner.
// LUPU does not receive, hold, process, or transfer payments.
// The backend provides an immutable audit trail of payments
// that BOTH parties and the admin can see.
//

// Helper: generate human-readable payment reference ID
function generatePaymentRefId() {
  const now = new Date()
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 8)
  return `LUPU-PAY-${datePart}-${randomPart}`
}

// ── Online Payment Workflow ─────────────────────────────────
//
// Online payment order generation and verification.
// Rules:
//  1. Online payment becomes available ONLY after owner accepts the booking.
//  2. Only the authenticated renter can initiate and verify online payment.
//  3. Amount is strictly server-authoritative from the booking record.
//  4. Duplicate payments or payments for cash bookings are blocked.
//
app.post('/api/payments/create-order', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId } = req.body
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: 'Valid bookingId is required.' })
    }

    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    // Verify caller is the renter
    const renterId = booking.renterId?._id || booking.renterId
    if (renterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the booking renter can initiate online payment.' })
    }

    // Enforce booking status is accepted/active/confirmed
    const bStatus = (booking.status || '').toLowerCase().trim()
    const allowedStatuses = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed']
    if (!allowedStatuses.includes(bStatus)) {
      return res.status(400).json({
        message: `Online payment is only available after the vehicle owner accepts your booking request. Current status: "${booking.status}".`
      })
    }

    // Enforce payment method is online
    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({
        message: 'This booking is configured for cash payment. Only online bookings can initiate digital payment.'
      })
    }

    // Check if already paid
    if ((booking.paymentStatus || '').toLowerCase() === 'paid') {
      return res.status(400).json({
        message: 'This booking has already been paid.'
      })
    }

    const authoritativeAmount = Number(booking.totalAmount || booking.price || 0)
    if (!isFinite(authoritativeAmount) || authoritativeAmount <= 0) {
      return res.status(400).json({ message: 'Invalid booking amount.' })
    }

    const orderId = `ORDER_${booking._id}_${Date.now()}`
    return res.status(200).json({
      success: true,
      orderId,
      amount: authoritativeAmount,
      currency: 'INR',
      bookingId: booking._id,
      paymentMethod: 'online',
      key: process.env.RAZORPAY_KEY_ID || 'lupu_online_gateway'
    })
  } catch (err) {
    next(err)
  }
})

app.post('/api/payments/verify', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, orderId, paymentId, notes } = req.body
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: 'Valid bookingId is required.' })
    }

    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    const renterId = booking.renterId?._id || booking.renterId
    if (renterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the booking renter can verify online payment.' })
    }

    const bStatus = (booking.status || '').toLowerCase().trim()
    const allowedStatuses = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed']
    if (!allowedStatuses.includes(bStatus)) {
      return res.status(400).json({
        message: `Cannot process payment for booking in "${booking.status}" status.`
      })
    }

    if ((booking.paymentStatus || '').toLowerCase() === 'paid') {
      return res.status(400).json({
        message: 'This booking has already been marked as paid.'
      })
    }

    const authoritativeAmount = Number(booking.totalAmount || booking.price || 0)

    // Check for duplicate online payment
    const existingPayment = await Payment.findOne({
      bookingId: booking._id,
      status: 'paid',
      paymentMethod: 'online',
    })
    if (existingPayment) {
      return res.status(409).json({
        message: 'Online payment has already been verified for this booking.',
        existingPaymentId: existingPayment._id,
        referenceId: existingPayment.referenceId,
      })
    }

    let referenceId
    let attempts = 0
    do {
      referenceId = generatePaymentRefId()
      attempts++
    } while (await Payment.exists({ referenceId }) && attempts < 10)

    const payment = await Payment.create({
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      renterId: booking.renterId,
      ownerId: booking.ownerId,
      amount: authoritativeAmount,
      currency: 'INR',
      type: 'rental',
      status: 'paid',
      paymentMethod: 'online',
      paymentPurpose: 'rental',
      referenceId,
      transactionId: paymentId || `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      transactionReference: orderId || `ORDER_${booking._id}`,
      recordedBy: req.user._id,
      recordedByName: req.user.name || 'Renter (Online Checkout)',
      rentalAmount: authoritativeAmount,
      ownerPayoutAmount: authoritativeAmount,
      payoutStatus: 'unsettled',
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : 'Online Payment Gateway Verification'
    })

    await Booking.findByIdAndUpdate(booking._id, {
      paymentStatus: 'paid',
      paymentMethod: 'online',
    })

    // Send notifications to both parties
    await sendNotification(booking.ownerId, {
      type: 'payment',
      title: 'Payment Received Online! 💳',
      message: `Renter has completed the online payment of ₹${authoritativeAmount} for ${booking.vehicleName}.`,
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      link: '/dashboard'
    })
    await sendNotification(booking.renterId, {
      type: 'payment',
      title: 'Online Payment Confirmed! 🎉',
      message: `Your payment of ₹${authoritativeAmount} for ${booking.vehicleName} was successful. Have a safe ride!`,
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      link: '/my-bookings'
    })

    return res.status(200).json({
      success: true,
      message: 'Online payment successfully verified and recorded.',
      payment: payment.toObject(),
    })
  } catch (err) {
    next(err)
  }
})

// ─────────────────────────────────────────────────────────────
// DEPRECATED: Renter-claims-payment flow is REMOVED.
// Only the vehicle owner can authoritatively record cash payments.
// ─────────────────────────────────────────────────────────────

app.post('/api/payments/mark-paid', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  return res.status(410).json({
    error: 'DEPRECATED',
    message: 'This endpoint has been removed. Payment recording is now done exclusively by the vehicle owner. Contact your owner to record the payment.',
    code: 'FLOW_CHANGED'
  })
})

app.post('/api/payments/confirm-received', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  return res.status(410).json({
    error: 'DEPRECATED',
    message: 'This endpoint has been removed. Use POST /api/payments/record-offline instead.',
    code: 'FLOW_CHANGED'
  })
})

// ─────────────────────────────────────────────────────────────
// POST /api/payments/record-offline
// Vehicle owner records a direct cash payment received from renter.
//
// Security Rules:
//  1. Authenticated user must be the booking's owner (server-verified)
//  2. Booking must exist
//  3. Booking must be in a valid state (accepted / active / ongoing / completed)
//  4. Cancelled / rejected bookings: blocked
//  5. Amount must be a positive finite number
//  6. paymentPurpose must be in the allowed enum
//  7. ownerId / renterId derived from booking — never trusted from body
//  8. recordedBy set server-side from req.user._id
//  9. referenceId generated server-side (crypto-safe unique)
// 10. Idempotency: blocks duplicate submission within 60 seconds
//     (same booking + same purpose + same amount)
// 11. Server timestamps (Mongoose createdAt/updatedAt)
// 12. Admin email protected — cannot masquerade as owner
// ─────────────────────────────────────────────────────────────
app.post('/api/payments/record-offline', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    const { bookingId, amount, paymentPurpose, notes } = req.body

    // ── Validate required fields ────────────────────────────
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: 'Valid bookingId is required.' })
    }

    const VALID_PURPOSES = ['advance', 'rental', 'security_deposit', 'damage', 'other']
    if (!paymentPurpose || !VALID_PURPOSES.includes(paymentPurpose)) {
      return res.status(400).json({
        message: `paymentPurpose must be one of: ${VALID_PURPOSES.join(', ')}`
      })
    }

    // ── Fetch and validate booking ──────────────────────────
    const booking = await Booking.findById(bookingId).lean()
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    // Rule 1: Only the vehicle's owner can record this payment
    if (booking.ownerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Forbidden: Only the vehicle owner can record payments for this booking.'
      })
    }

    // Rule 3/4: Booking must be in a valid state (accepted or active)
    const validStatuses = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed']
    const bStatus = (booking.status || '').toLowerCase().trim()
    if (!validStatuses.includes(bStatus)) {
      return res.status(400).json({
        message: `Cannot record payment for a booking in "${booking.status}" status. Booking must be accepted or active.`
      })
    }

    // Rule 4b: Prevent duplicate payment records and repeated confirmations
    const currentBookingPayStatus = (booking.paymentStatus || '').toLowerCase()
    if (paymentPurpose === 'rental' && currentBookingPayStatus === 'paid') {
      return res.status(400).json({
        message: 'This booking has already been marked as paid. Duplicate payment confirmation is blocked.'
      })
    }

    // Authoritative amount calculation: do not trust a client-supplied amount
    let parsedAmount = Number(amount)
    const authoritativeRentalAmount = Number(booking.totalAmount || booking.price || 0)
    if (paymentPurpose === 'rental' && authoritativeRentalAmount > 0) {
      parsedAmount = authoritativeRentalAmount
    } else {
      if (!isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number.' })
      }
      if (Math.round(parsedAmount * 100) !== parsedAmount * 100) {
        return res.status(400).json({ message: 'Amount cannot have more than 2 decimal places.' })
      }
      if (parsedAmount > 10_00_000) {
        return res.status(400).json({ message: 'Amount cannot exceed ₹10,00,000 per record.' })
      }
    }

    // Duplicate check for rental payments
    if (paymentPurpose === 'rental') {
      const existingRecordedPayment = await Payment.findOne({
        bookingId: booking._id,
        paymentPurpose: 'rental',
        status: 'recorded',
      })
      if (existingRecordedPayment) {
        return res.status(409).json({
          message: 'A cash rental payment has already been recorded for this booking.',
          existingPaymentId: existingRecordedPayment._id,
          referenceId: existingRecordedPayment.referenceId,
        })
      }
    }

    // Rule 10: Idempotency — block duplicate within 60 seconds (same booking + purpose + amount)
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000)
    const recentDuplicate = await Payment.findOne({
      bookingId: booking._id,
      paymentPurpose,
      amount: parsedAmount,
      status: 'recorded',
      createdAt: { $gte: sixtySecondsAgo },
    })
    if (recentDuplicate) {
      return res.status(409).json({
        message: 'A payment with the same amount and purpose was just recorded for this booking. Please wait before submitting again.',
        existingPaymentId: recentDuplicate._id,
        referenceId: recentDuplicate.referenceId,
      })
    }

    // ── Generate unique reference ID (server-side, no client input) ─
    let referenceId
    let attempts = 0
    do {
      referenceId = generatePaymentRefId()
      attempts++
    } while (await Payment.exists({ referenceId }) && attempts < 10)

    // ── Create immutable payment record ────────────────────
    const payment = await Payment.create({
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      renterId: booking.renterId || booking.userId,  // server-derived
      ownerId:  booking.ownerId,                      // server-derived
      amount: parsedAmount,
      currency: 'INR',
      paymentMethod: 'cash',
      paymentPurpose,
      status: 'recorded',
      referenceId,
      recordedBy: req.user._id,         // server-set from authenticated token
      recordedByName: req.user.name || 'Vehicle Owner',
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : undefined,
      // Legacy fields for backward compat
      rentalAmount: paymentPurpose === 'rental' ? parsedAmount : 0,
      securityDeposit: paymentPurpose === 'security_deposit' ? parsedAmount : 0,
      platformFee: 0,
      ownerPayoutAmount: parsedAmount,
      payoutStatus: 'unsettled',
    })

    // ── Update booking-level payment status summary ─────────
    // Only upgrade — don't downgrade if already 'paid'
    if (!['paid'].includes(currentBookingPayStatus)) {
      await Booking.findByIdAndUpdate(booking._id, {
        paymentStatus: 'paid',
        paymentMethod: 'cash',
      })
    }

    // ── Notify renter ───────────────────────────────────────
    const purposeLabels = {
      advance: 'Advance',
      rental: 'Rental',
      security_deposit: 'Security Deposit',
      damage: 'Damage',
      other: 'Payment',
    }
    const purposeLabel = purposeLabels[paymentPurpose] || paymentPurpose
    const renterId = booking.renterId || booking.userId

    await sendNotification(renterId, {
      type: 'payment',
      title: `Cash Payment Recorded — ₹${parsedAmount.toLocaleString('en-IN')}`,
      message: `Your owner has recorded a ₹${parsedAmount.toLocaleString('en-IN')} cash ${purposeLabel} payment for your booking. Ref: ${referenceId}`,
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      link: '/my-bookings',
    })

    // ── Notify admin ────────────────────────────────────────
    try {
      const adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' }).lean()
      if (adminUser) {
        await sendNotification(adminUser._id, {
          type: 'payment',
          title: `Cash Payment Recorded — Booking #${String(booking._id).slice(-6).toUpperCase()}`,
          message: `A ₹${parsedAmount.toLocaleString('en-IN')} cash ${purposeLabel} payment has been recorded by owner ${req.user.name || 'Owner'}. Ref: ${referenceId}`,
          bookingId: booking._id,
          vehicleId: booking.vehicleId,
          link: '/admin',
        })
      }
    } catch (_) {
      // Non-critical — admin notification failure should not block the response
    }

    return res.status(201).json({
      success: true,
      message: `Cash payment of ₹${parsedAmount.toLocaleString('en-IN')} recorded successfully.`,
      payment: {
        _id: payment._id,
        referenceId: payment.referenceId,
        amount: payment.amount,
        paymentPurpose: payment.paymentPurpose,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        recordedByName: payment.recordedByName,
        notes: payment.notes,
        createdAt: payment.createdAt,
      },
      disclaimer: 'This payment was made directly between the renter and the vehicle owner. LUPU does not receive, hold, process, or transfer this payment.',
    })
  } catch (err) {
    console.error('POST /api/payments/record-offline error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A payment reference ID collision occurred. Please try again.' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payments/:id/dispute
// Renter (or admin) flags a recorded payment as disputed.
// The payment is NOT deleted. Status changes to 'disputed'.
// Owner and admin are notified.
// ─────────────────────────────────────────────────────────────
app.post('/api/payments/:id/dispute', verifyFirebaseToken, requireMongoUser, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid payment ID.' })
    }

    const payment = await Payment.findById(req.params.id)
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' })

    // Only renter or admin can dispute
    const isRenter = payment.renterId?.toString() === req.user._id.toString()
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)

    if (!isRenter && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Only the renter or admin can dispute a payment.' })
    }

    if (payment.status === 'reversed') {
      return res.status(400).json({ message: 'This payment has already been reversed and cannot be disputed.' })
    }
    if (payment.status === 'disputed') {
      return res.status(409).json({ message: 'This payment is already flagged as disputed.' })
    }

    const { reason } = req.body
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A dispute reason is required.' })
    }

    payment.status = 'disputed'
    payment.disputeReason = String(reason).trim().slice(0, 500)
    payment.disputedBy = req.user._id
    payment.disputedAt = new Date()
    await payment.save()

    // Notify owner
    await sendNotification(payment.ownerId, {
      type: 'payment',
      title: `Payment Disputed — ${payment.referenceId || payment._id}`,
      message: `A payment of ₹${payment.amount?.toLocaleString('en-IN')} (Ref: ${payment.referenceId}) has been disputed. Reason: ${reason}`,
      bookingId: payment.bookingId,
      link: '/dashboard',
    })

    // Notify admin
    try {
      const adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' }).lean()
      if (adminUser) {
        await sendNotification(adminUser._id, {
          type: 'payment',
          title: `Payment Disputed — ${payment.referenceId}`,
          message: `Payment ${payment.referenceId} (₹${payment.amount}) has been disputed by ${req.user.name || 'a user'}. Reason: ${reason}`,
          bookingId: payment.bookingId,
          link: '/admin',
        })
      }
    } catch (_) {}

    res.json({
      success: true,
      message: 'Payment flagged as disputed. The LUPU team will investigate.',
      payment: { _id: payment._id, referenceId: payment.referenceId, status: payment.status }
    })
  } catch (err) {
    console.error('POST /api/payments/:id/dispute error:', err)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payments/:id/reverse
// Admin-only: Mark a payment as reversed. Creates a correction
// record if correctAmount is provided. Original record is NEVER
// deleted — isReversed=true is set on the original.
// ─────────────────────────────────────────────────────────────
app.post('/api/payments/:id/reverse', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid payment ID.' })
    }

    const original = await Payment.findById(req.params.id)
    if (!original) return res.status(404).json({ message: 'Payment record not found.' })

    if (original.isReversed) {
      return res.status(409).json({ message: 'This payment has already been reversed.' })
    }

    const { reason, correctAmount, correctPurpose, correctNotes } = req.body
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A reversal reason is required.' })
    }

    // Mark original as reversed (immutable — never deleted)
    original.isReversed = true
    original.status = 'reversed'
    original.reversalReason = String(reason).trim().slice(0, 500)
    original.reversedAt = new Date()
    original.reversedBy = req.user._id
    await original.save()

    // Audit log
    await logAdminAction(
      { _id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      'payment_reversed',
      { collectionName: 'payments', docId: original._id.toString(), name: original.referenceId },
      `Payment ${original.referenceId} reversed. Reason: ${reason}`
    )

    let correctionPayment = null

    // Create correction record if a new correct amount is provided
    if (correctAmount !== undefined) {
      const parsedCorrect = Number(correctAmount)
      if (!isFinite(parsedCorrect) || parsedCorrect <= 0) {
        return res.status(400).json({ message: 'correctAmount must be a positive number if provided.' })
      }
      const VALID_PURPOSES = ['advance', 'rental', 'security_deposit', 'damage', 'other']
      const corrPurpose = correctPurpose && VALID_PURPOSES.includes(correctPurpose)
        ? correctPurpose
        : original.paymentPurpose

      let corrRefId
      do { corrRefId = generatePaymentRefId() } while (await Payment.exists({ referenceId: corrRefId }))

      correctionPayment = await Payment.create({
        bookingId: original.bookingId,
        vehicleId: original.vehicleId,
        renterId: original.renterId,
        ownerId: original.ownerId,
        amount: parsedCorrect,
        currency: 'INR',
        paymentMethod: 'cash',
        paymentPurpose: corrPurpose,
        status: 'recorded',
        referenceId: corrRefId,
        recordedBy: req.user._id,
        recordedByName: `Admin (correction of ${original.referenceId})`,
        correctionOf: original._id,
        notes: correctNotes || `Correction of ${original.referenceId}. Reason: ${reason}`,
        platformFee: 0,
        ownerPayoutAmount: parsedCorrect,
        payoutStatus: 'unsettled',
      })
    }

    // Notify renter and owner
    const notifyMsg = `Payment ${original.referenceId} (₹${original.amount}) has been reversed by LUPU admin. Reason: ${reason}`
    await sendNotification(original.renterId, {
      type: 'payment',
      title: `Payment Reversed — ${original.referenceId}`,
      message: notifyMsg,
      bookingId: original.bookingId,
      link: '/my-bookings',
    })
    await sendNotification(original.ownerId, {
      type: 'payment',
      title: `Payment Reversed — ${original.referenceId}`,
      message: notifyMsg,
      bookingId: original.bookingId,
      link: '/dashboard',
    })

    res.json({
      success: true,
      message: `Payment ${original.referenceId} reversed successfully.`,
      reversedPayment: { _id: original._id, referenceId: original.referenceId, status: original.status },
      correctionPayment: correctionPayment ? {
        _id: correctionPayment._id,
        referenceId: correctionPayment.referenceId,
        amount: correctionPayment.amount,
        status: correctionPayment.status,
      } : null,
    })
  } catch (err) {
    console.error('POST /api/payments/:id/reverse error:', err)
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Reference ID collision. Please try again.' })
    }
    res.status(500).json({ message: 'Internal server error' })
  }
})

// ─────────────────────────────────────────────────────────────
// POST /api/payments/records — legacy endpoint kept for backward compat
// Now creates a pending record (used by old mobile code if any)
// ─────────────────────────────────────────────────────────────
app.post('/api/payments/records', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const { bookingId, rentalAmount, securityDeposit } = req.body
    if (!bookingId) return res.status(400).json({ message: 'bookingId is required' })

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = (booking.userId || booking.renterId)?.toString() === req.user._id.toString()
    const isOwner  = booking.ownerId?.toString() === req.user._id.toString()
    const isAdminU = ['admin', 'super_admin', 'founder'].includes(req.user.role)

    if (!isRenter && !isOwner && !isAdminU) {
      return res.status(403).json({ message: 'Forbidden: You cannot create financial records for this booking' })
    }

    const rentAmt = Number(rentalAmount !== undefined ? rentalAmount : (booking.rentalAmount || booking.price || 0))
    const secDep  = Number(securityDeposit !== undefined ? securityDeposit : (booking.deposit || 0))
    const totalAmt = rentAmt + secDep
    const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    const payment = await Payment.create({
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      renterId: booking.userId || booking.renterId,
      ownerId: booking.ownerId,
      rentalAmount: rentAmt,
      securityDeposit: secDep,
      platformFee: 0,
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

// ─────────────────────────────────────────────────────────────
// GET /api/payments/booking/:bookingId
// Returns all payment records for a booking.
// Visible to: renter, owner, or admin.
// ─────────────────────────────────────────────────────────────
app.get('/api/payments/booking/:bookingId', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.bookingId)) {
      return res.status(400).json({ message: 'Invalid booking ID.' })
    }
    const booking = await Booking.findById(req.params.bookingId).lean()
    if (!booking) return res.status(404).json({ message: 'Booking not found' })

    const isRenter = (booking.userId || booking.renterId)?.toString() === req.user._id.toString()
    const isOwner  = booking.ownerId?.toString() === req.user._id.toString()
    const isAdmin  = ['admin', 'super_admin', 'founder'].includes(req.user.role)

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You cannot access payment details for this booking' })
    }

    const payments = await Payment.find({ bookingId: req.params.bookingId })
      .sort({ createdAt: 1 })  // chronological order (oldest first for timeline)
      .lean()

    res.json({
      success: true,
      payments,
      disclaimer: 'All payments are direct cash transactions between the renter and vehicle owner. LUPU does not receive, hold, or process any payments.',
    })
  } catch (err) {
    next(err)
  }
})

// ─────────────────────────────────────────────────────────────
// GET /api/payments/history
// Returns payment history for the authenticated user (or all if admin)
// ─────────────────────────────────────────────────────────────
app.get('/api/payments/history', verifyFirebaseToken, requireMongoUser, async (req, res, next) => {
  try {
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)
    const query = isAdmin ? {} : {
      $or: [{ renterId: req.user._id }, { ownerId: req.user._id }]
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

// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments
// Full admin payment ledger with populated renter/owner/vehicle
// ─────────────────────────────────────────────────────────────
app.get('/api/admin/payments', verifyFirebaseToken, requireMongoUser, authorize('admin', 'super_admin', 'founder'), async (req, res, next) => {
  try {
    const payments = await Payment.find()
      .sort({ createdAt: -1 })
      .populate('renterId', 'name email')
      .populate('ownerId', 'name email')
      .populate('vehicleId', 'name brand model')
      .populate('bookingId', 'status startTime endTime vehicleName')
      .populate('recordedBy', 'name email')
      .populate('disputedBy', 'name email')
      .populate('reversedBy', 'name email')
      .lean()

    res.json({ success: true, payments })
  } catch (err) {
    next(err)
  }
})
// ─────────────────────────────────────────────────────────────
// Admin Financial Endpoints
// ─────────────────────────────────────────────────────────────



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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)

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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)
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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)
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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)
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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)
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
    const isAdmin = ['admin', 'super_admin', 'founder'].includes(req.user.role)
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

// ── Android APK Download ────────────────────────────────────

app.get('/api/app/info', (_req, res) => {
  const possiblePaths = [
    path.resolve(__dirname, '../frontend/public/lupu-release.apk'),
    path.resolve(__dirname, '../lupu-release.apk'),
    path.resolve(__dirname, '../mobile/android/app/build/outputs/apk/release/app-release.apk'),
    path.resolve(__dirname, '../mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
  ]
  const apkPath = possiblePaths.find((p) => fs.existsSync(p))
  if (!apkPath) {
    return res.status(404).json({ available: false, message: 'APK not found' })
  }
  const stats = fs.statSync(apkPath)
  res.json({
    available: true,
    version: '1.0.0',
    filename: 'LUPU-Rental.apk',
    sizeBytes: stats.size,
    sizeMb: (stats.size / (1024 * 1024)).toFixed(1) + ' MB',
    downloadUrl: '/api/app/download',
  })
})

app.get('/api/app/download', (_req, res) => {
  const possiblePaths = [
    path.resolve(__dirname, '../frontend/public/lupu-release.apk'),
    path.resolve(__dirname, '../lupu-release.apk'),
    path.resolve(__dirname, '../mobile/android/app/build/outputs/apk/release/app-release.apk'),
    path.resolve(__dirname, '../mobile/android/app/build/outputs/apk/debug/app-debug.apk'),
  ]
  const apkPath = possiblePaths.find((p) => fs.existsSync(p))
  if (!apkPath || !fs.existsSync(apkPath)) {
    return res.status(404).json({
      message: 'LUPU Android APK is currently unavailable. Please check back shortly.',
    })
  }
  res.setHeader('Content-Type', 'application/vnd.android.package-archive')
  res.download(apkPath, 'LUPU-Rental.apk', (err) => {
    if (err && !res.headersSent) {
      console.error('APK download streaming error:', err)
      res.status(500).json({ message: 'Error streaming APK download' })
    }
  })
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

