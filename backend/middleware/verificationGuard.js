import Vehicle from '../models/Vehicle.js'
import User from '../models/User.js'

/**
 * Mask Aadhaar number to legally compliant format (only last 4 digits visible).
 * Format: XXXX-XXXX-1234
 */
export function maskAadhaarNumber(raw) {
  if (!raw) return 'XXXX-XXXX-XXXX'
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length >= 4) {
    const last4 = digits.slice(-4)
    return `XXXX-XXXX-${last4}`
  }
  return 'XXXX-XXXX-XXXX'
}

/**
 * Mask Driving License number preserving state code and last 4 digits.
 * Format: AS01-****-1234
 */
export function maskDrivingLicenseNumber(raw) {
  if (!raw) return 'DL-****-XXXX'
  const clean = String(raw).trim().replace(/\s+/g, '')
  if (clean.length > 6) {
    const prefix = clean.slice(0, 4)
    const suffix = clean.slice(-4)
    return `${prefix}-****-${suffix}`
  }
  return clean.replace(/.(?=.{4})/g, '*')
}

/**
 * Mask Student ID number.
 * Format: DU-****-1234
 */
export function maskStudentIdNumber(raw) {
  if (!raw) return 'STU-****-XXXX'
  const clean = String(raw).trim()
  if (clean.length > 5) {
    const prefix = clean.slice(0, 2)
    const suffix = clean.slice(-4)
    return `${prefix}-****-${suffix}`
  }
  return clean.replace(/.(?=.{2})/g, '*')
}

/**
 * Universal document number masking dispatcher.
 */
export function maskDocumentNumber(docType, raw) {
  if (!raw) return null
  switch (docType) {
    case 'aadhaar':
      return maskAadhaarNumber(raw)
    case 'driving_license':
      return maskDrivingLicenseNumber(raw)
    case 'student_id':
      return maskStudentIdNumber(raw)
    default:
      return String(raw).replace(/.(?=.{4})/g, '*')
  }
}

/**
 * Pure function: Evaluates if a renter meets all identity, face, and driving eligibility rules.
 *
 * @param {Object} user - Mongoose User document or plain object
 * @param {Object} [vehicle] - Mongoose Vehicle document or plain object (optional)
 * @returns {{ eligible: boolean, code?: string, message?: string }}
 */
export function checkRenterBookingEligibility(user, vehicle = null) {
  if (!user) {
    return {
      eligible: false,
      code: 'UNAUTHENTICATED',
      message: 'Authentication required. Please log in to book a vehicle.',
    }
  }

  // 1. Check Overall Verification Status
  const vStatus = (user.verificationStatus || '').toLowerCase().trim()
  const kycStatus = (user.kycStatus || '').toLowerCase().trim()
  const docStatus = (user.documentStatus || '').toLowerCase().trim()
  const faceStatus = (user.faceStatus || '').toLowerCase().trim()

  const isOfficiallyVerified =
    vStatus === 'verified' ||
    user.isVerified === true ||
    (docStatus === 'document_verified' && faceStatus === 'face_verified') ||
    kycStatus === 'verified'

  if (!isOfficiallyVerified) {
    // Provide precise, actionable feedback depending on where the user is in the verification pipeline
    if (vStatus === 'rejected' || kycStatus === 'rejected') {
      return {
        eligible: false,
        code: 'VERIFICATION_REJECTED',
        message: `Your verification was rejected: ${user.kycRejectionReason || 'Please resubmit your identity documents and live selfie.'}`,
      }
    }

    if (faceStatus === 'face_failed') {
      return {
        eligible: false,
        code: 'FACE_VERIFICATION_FAILED',
        message: 'Face verification did not pass. Please capture a clear live selfie matching your identity document.',
      }
    }

    if (vStatus === 'face_pending' || (docStatus === 'document_submitted' && (!faceStatus || faceStatus === 'not_started' || faceStatus === 'face_pending'))) {
      return {
        eligible: false,
        code: 'FACE_VERIFICATION_REQUIRED',
        message: 'Identity document was submitted, but Face Verification is still pending. Please complete your live selfie verification to book.',
      }
    }

    if (vStatus === 'under_review' || vStatus === 'document_submitted' || docStatus === 'document_submitted' || docStatus === 'document_under_review' || faceStatus === 'face_under_review' || kycStatus === 'pending') {
      return {
        eligible: false,
        code: 'VERIFICATION_UNDER_REVIEW',
        message: 'Your identity documents and face verification are currently under review by our verification team.',
      }
    }

    return {
      eligible: false,
      code: 'VERIFICATION_REQUIRED',
      message: 'Renter verification is required before booking. Please complete your identity document and face verification.',
    }
  }

  // 2. Check Driving License Eligibility when required by the vehicle
  if (vehicle) {
    // Any motorized vehicle (bike or scooty with cc > 0 or transmission) legally requires a DL in India.
    // An owner/admin may mark requiresDrivingLicense: false for low-speed electric or non-motorized vehicles.
    const requiresLicense = vehicle.requiresDrivingLicense !== false

    if (requiresLicense) {
      // Must hold verified Driving License
      const hasVerifiedDL =
        user.drivingLicenseVerified === true ||
        user.documentType === 'driving_license' ||
        user.kycType === 'driving_license' ||
        !!user.drivingLicenseUrl ||
        (user.drivingLicenseDetails && user.drivingLicenseDetails.isVerified === true)

      if (!hasVerifiedDL) {
        return {
          eligible: false,
          code: 'DRIVING_LICENSE_REQUIRED',
          message: 'This vehicle legally requires a valid Driving License. Student ID or Aadhaar alone is not sufficient to operate this vehicle.',
        }
      }

      // Check Expiry Date if provided
      const expiry = user.drivingLicenseExpiry || user.drivingLicenseDetails?.expiryDate
      if (expiry) {
        const expiryDate = new Date(expiry)
        if (!isNaN(expiryDate.getTime()) && expiryDate <= new Date()) {
          return {
            eligible: false,
            code: 'DRIVING_LICENSE_EXPIRED',
            message: `Your Driving License expired on ${expiryDate.toISOString().split('T')[0]}. A valid, unexpired Driving License is required to book this vehicle.`,
          }
        }
      }
    }
  }

  return { eligible: true }
}

/**
 * Centralized Backend Middleware: Enforces mandatory renter verification before creating a booking.
 * Blocks any unverified renter, even on direct API calls.
 */
export async function requireVerifiedRenter(req, res, next) {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' })
    }

    let vehicle = null
    const vehicleId = req.body?.vehicleId
    if (vehicleId) {
      vehicle = await Vehicle.findById(vehicleId).lean()
    }

    const check = checkRenterBookingEligibility(user, vehicle)
    if (!check.eligible) {
      return res.status(403).json({
        error: 'RenterVerificationRequired',
        code: check.code,
        message: check.message,
        verificationStatus: user.verificationStatus || 'not_started',
        documentStatus: user.documentStatus || 'not_started',
        faceStatus: user.faceStatus || 'not_started',
        requiresDrivingLicense: vehicle ? vehicle.requiresDrivingLicense !== false : undefined,
      })
    }

    next()
  } catch (err) {
    console.error('[VerificationGuard] Error during eligibility check:', err)
    res.status(500).json({ message: 'Error checking renter verification status' })
  }
}
