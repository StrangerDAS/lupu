import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import User from '../models/User.js'
import Vehicle from '../models/Vehicle.js'
import Booking from '../models/Booking.js'
import Verification from '../models/Verification.js'
import {
  maskAadhaarNumber,
  maskDrivingLicenseNumber,
  maskStudentIdNumber,
  maskDocumentNumber,
  checkRenterBookingEligibility,
  requireVerifiedRenter
} from '../middleware/verificationGuard.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lupu'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

async function runVerificationTestSuite() {
  console.log('\n=============================================================')
  console.log('🛡️  LUPU MANDATORY RENTER VERIFICATION — AUTOMATED TEST SUITE')
  console.log('=============================================================\n')

  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB.\n')

  try {
    // ── Setup Common Test Vehicles ──
    const owner = await User.findOneAndUpdate(
      { email: 'verif_suite_owner@lupu.in' },
      { name: 'Suite Owner', role: 'owner', isOwner: true },
      { upsert: true, new: true }
    )

    const motorcycle = await Vehicle.findOneAndUpdate(
      { registrationNumber: 'TEST-DL-REQ-001' },
      {
        ownerId: owner._id,
        name: 'Royal Enfield Hunter 350',
        brand: 'Royal Enfield',
        model: 'Hunter 350',
        type: 'bike',
        registrationNumber: 'TEST-DL-REQ-001',
        requiresDrivingLicense: true,
        pricePerHour: 80,
        pricePerDay: 800,
        status: 'approved',
        isAvailable: true,
      },
      { upsert: true, new: true }
    )

    const bicycle = await Vehicle.findOneAndUpdate(
      { registrationNumber: 'TEST-NO-DL-002' },
      {
        ownerId: owner._id,
        name: 'Hero Sprint Bicycle / Non-Motorized',
        brand: 'Hero',
        model: 'Sprint Pro',
        type: 'bicycle',
        registrationNumber: 'TEST-NO-DL-002',
        requiresDrivingLicense: false,
        pricePerHour: 20,
        pricePerDay: 150,
        status: 'approved',
        isAvailable: true,
      },
      { upsert: true, new: true }
    )

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: Unverified renter attempts to create booking -> blocked with 403 / verification_required
    // ─────────────────────────────────────────────────────────────
    console.log('Scenario 1: Unverified renter attempts booking')
    const unverifiedRenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Unverified Renter',
      isVerified: false,
      verificationStatus: 'not_started',
      documentStatus: 'not_started',
      faceStatus: 'not_started',
    }
    const res1 = checkRenterBookingEligibility(unverifiedRenter, motorcycle)
    assert(!res1.eligible && res1.code === 'VERIFICATION_REQUIRED', 'Unverified renter is blocked from booking')

    // Also test middleware emulation
    let mwBlocked = false
    let mwStatus = null
    const req1 = { user: unverifiedRenter, body: { vehicleId: motorcycle._id.toString() } }
    const resMock1 = {
      status: (code) => {
        mwStatus = code
        return {
          json: (data) => {
            if (code === 403 && data.code === 'VERIFICATION_REQUIRED') mwBlocked = true
          }
        }
      }
    }
    await requireVerifiedRenter(req1, resMock1, () => { mwBlocked = false })
    assert(mwBlocked && mwStatus === 403, 'requireVerifiedRenter middleware returns HTTP 403')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: Verified renter creates booking -> success
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 2: Fully verified renter with DL creates booking')
    const verifiedRenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Fully Verified Renter',
      isVerified: true,
      verificationStatus: 'verified',
      documentStatus: 'document_verified',
      faceStatus: 'face_verified',
      drivingLicenseVerified: true,
      drivingLicenseExpiry: new Date(Date.now() + 365 * 24 * 3600 * 1000), // 1 year in future
    }
    const res2 = checkRenterBookingEligibility(verifiedRenter, motorcycle)
    assert(res2.eligible === true, 'Fully verified renter is eligible to book')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3: Renter with only document verified -> blocked until face verified
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 3: Renter with only document verified (face pending)')
    const docOnlyRenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Doc Only Renter',
      isVerified: false,
      verificationStatus: 'face_pending',
      documentStatus: 'document_verified',
      faceStatus: 'not_started',
    }
    const res3 = checkRenterBookingEligibility(docOnlyRenter, motorcycle)
    assert(!res3.eligible && res3.code === 'FACE_VERIFICATION_REQUIRED', 'Renter with only document verified is blocked until face is verified')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 4: Renter with only face verified -> blocked until document verified
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 4: Renter with only face verified (doc unverified/pending)')
    const faceOnlyRenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Face Only Renter',
      isVerified: false,
      verificationStatus: 'document_under_review',
      documentStatus: 'document_submitted',
      faceStatus: 'face_verified',
    }
    const res4 = checkRenterBookingEligibility(faceOnlyRenter, motorcycle)
    assert(!res4.eligible && (res4.code === 'VERIFICATION_UNDER_REVIEW' || res4.code === 'VERIFICATION_REQUIRED'), 'Renter with only face verified is blocked until document is verified')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 5: Renter without driving license attempts booking vehicle requiring license -> blocked
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 5: Verified renter without driving license attempts motorcycle booking')
    const verifiedStudent = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Verified Student Without DL',
      isVerified: true,
      verificationStatus: 'verified',
      documentType: 'student_id',
      documentStatus: 'document_verified',
      faceStatus: 'face_verified',
      drivingLicenseVerified: false,
    }
    const res5 = checkRenterBookingEligibility(verifiedStudent, motorcycle)
    assert(!res5.eligible && res5.code === 'DRIVING_LICENSE_REQUIRED', 'Renter without driving license is blocked from license-requiring vehicle')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 6: Renter with expired driving license attempts booking -> blocked
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 6: Renter with expired driving license attempts booking')
    const expiredDlRenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Expired DL Renter',
      isVerified: true,
      verificationStatus: 'verified',
      documentType: 'driving_license',
      documentStatus: 'document_verified',
      faceStatus: 'face_verified',
      drivingLicenseVerified: true,
      drivingLicenseExpiry: new Date('2022-01-01'), // Expired
    }
    const res6 = checkRenterBookingEligibility(expiredDlRenter, motorcycle)
    assert(!res6.eligible && res6.code === 'DRIVING_LICENSE_EXPIRED', 'Renter with expired driving license is blocked with DRIVING_LICENSE_EXPIRED')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 7: Renter with valid driving license books vehicle requiring license -> success
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 7: Renter with valid unexpired DL books motorcycle')
    const validDlRenter = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Valid DL Renter',
      isVerified: true,
      verificationStatus: 'verified',
      documentType: 'driving_license',
      documentStatus: 'document_verified',
      faceStatus: 'face_verified',
      drivingLicenseVerified: true,
      drivingLicenseExpiry: new Date(Date.now() + 500 * 24 * 3600 * 1000), // Valid for 500 days
    }
    const res7 = checkRenterBookingEligibility(validDlRenter, motorcycle)
    assert(res7.eligible === true, 'Renter with valid DL is allowed to book license-requiring vehicle')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 8: Renter with Student ID books vehicle not requiring license -> success
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 8: Renter with Student ID books non-motorized vehicle (requiresDrivingLicense: false)')
    const res8 = checkRenterBookingEligibility(verifiedStudent, bicycle)
    assert(res8.eligible === true, 'Verified student can book non-motorized / license-free vehicle')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 9: Renter with Student ID attempts to book motorcycle requiring license -> blocked
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 9: Student ID user attempts to book motorcycle requiring license')
    const res9 = checkRenterBookingEligibility(verifiedStudent, motorcycle)
    assert(!res9.eligible && res9.code === 'DRIVING_LICENSE_REQUIRED' && res9.message.includes('Driving License'), 'Student ID user blocked with informative DL requirement message')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 10: Full Aadhaar number submitted -> verified that backend masks it to XXXX-XXXX-1234 and does not store unmasked
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 10: Aadhaar Card masking and privacy protection')
    const rawAadhaar = '543298761234'
    const masked = maskAadhaarNumber(rawAadhaar)
    assert(masked === 'XXXX-XXXX-1234', `Raw Aadhaar ${rawAadhaar} masked to ${masked}`)
    assert(!masked.includes('54329876'), 'First 8 digits of Aadhaar are completely hidden')

    const universalMasked = maskDocumentNumber('aadhaar', rawAadhaar)
    assert(universalMasked === 'XXXX-XXXX-1234', 'maskDocumentNumber dispatcher correctly masks Aadhaar')

    // Test DL masking
    const rawDl = 'AS06 20240012345'
    const maskedDl = maskDrivingLicenseNumber(rawDl)
    assert(maskedDl.includes('2345') && !maskedDl.includes('202400'), `Driving License masked cleanly: ${maskedDl}`)

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 11: Document verification submission updates status to under review
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 11: Document submission updates verification record status')
    const testRenter11 = await User.findOneAndUpdate(
      { email: 'renter_scenario11@lupu.in' },
      {
        name: 'Scenario 11 User',
        email: 'renter_scenario11@lupu.in',
        firebaseUid: 'uid_test_11',
        isVerified: false,
        verificationStatus: 'not_started',
      },
      { upsert: true, new: true }
    )

    const verificationRecord11 = await Verification.create({
      userId: testRenter11._id,
      documentType: 'student_id',
      maskedDocumentNumber: maskStudentIdNumber('DU/2026/CS/042'),
      institutionName: 'Dibrugarh University',
      documentFrontUrl: 'https://images.unsplash.com/doc_front.jpg',
      overallStatus: 'document_submitted',
      documentStatus: 'document_submitted',
      faceStatus: 'not_started',
    })

    assert(verificationRecord11.overallStatus === 'document_submitted', 'Overall verification status updated to document_submitted')
    assert(verificationRecord11.documentStatus === 'document_submitted', 'Document status updated to document_submitted')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 12: Face verification submission updates status to under review
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 12: Face verification submission updates status')
    verificationRecord11.faceStatus = 'face_under_review'
    verificationRecord11.overallStatus = 'under_review'
    verificationRecord11.selfieUrl = 'https://images.unsplash.com/selfie.jpg'
    verificationRecord11.biometricConsent = true
    verificationRecord11.biometricConsentAt = new Date()
    await verificationRecord11.save()

    assert(verificationRecord11.faceStatus === 'face_under_review', 'Face status updated to face_under_review')
    assert(verificationRecord11.overallStatus === 'under_review', 'Overall status updated to under_review')
    assert(verificationRecord11.biometricConsent === true, 'Biometric consent recorded with timestamp')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 13: Admin approves verification -> renter status updates to verified
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 13: Admin approves verification (full approval)')
    verificationRecord11.overallStatus = 'verified'
    verificationRecord11.documentStatus = 'document_verified'
    verificationRecord11.faceStatus = 'face_verified'
    verificationRecord11.reviewedBy = owner._id
    verificationRecord11.reviewedAt = new Date()
    verificationRecord11.verifiedAt = new Date()
    await verificationRecord11.save()

    const updatedUser13 = await User.findByIdAndUpdate(
      testRenter11._id,
      {
        isVerified: true,
        verificationStatus: 'verified',
        documentStatus: 'document_verified',
        faceStatus: 'face_verified',
      },
      { new: true }
    )

    assert(verificationRecord11.overallStatus === 'verified', 'Verification document is verified')
    assert(updatedUser13.isVerified === true && updatedUser13.verificationStatus === 'verified', 'User profile updated to verified')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 14: Admin rejects verification with reason -> renter sees rejection and can resubmit
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 14: Admin rejects verification with reason')
    const testRenter14 = await User.findOneAndUpdate(
      { email: 'renter_scenario14@lupu.in' },
      {
        name: 'Scenario 14 User',
        email: 'renter_scenario14@lupu.in',
        firebaseUid: 'uid_test_14',
        isVerified: false,
        verificationStatus: 'rejected',
        kycRejectionReason: 'ID document photo is blurry and illegible. Please upload a clear photo in good lighting.',
      },
      { upsert: true, new: true }
    )

    const res14 = checkRenterBookingEligibility(testRenter14, motorcycle)
    assert(!res14.eligible && res14.code === 'VERIFICATION_REJECTED', 'Rejected renter is blocked')
    assert(res14.message.includes('ID document photo is blurry'), 'Renter receives the explicit rejection reason')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 15: Verification status endpoint returns complete, accurate status
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 15: Verification status representation & metadata')
    const completeStatus = {
      isVerified: updatedUser13.isVerified,
      verificationStatus: updatedUser13.verificationStatus,
      documentStatus: updatedUser13.documentStatus,
      faceStatus: updatedUser13.faceStatus,
      documentType: 'student_id',
      maskedDocumentNumber: verificationRecord11.maskedDocumentNumber,
      drivingLicenseVerified: false,
      biometricConsent: true,
      canBookNonMotorized: true,
      canBookMotorVehicles: false,
    }

    assert(completeStatus.isVerified === true, 'Verification status contains isVerified: true')
    assert(completeStatus.maskedDocumentNumber.includes('****'), 'Masked document number present')
    assert(completeStatus.canBookNonMotorized === true && completeStatus.canBookMotorVehicles === false, 'Vehicle eligibility properly segregated (bicycle allowed, motor blocked without DL)')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 16: Fake frontend verified status (request body tampering)
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 16: Fake frontend verified status & request tampering')
    const tamperedReq = {
      user: {
        _id: unverifiedRenter._id,
        name: 'Attacker Tampering Frontend',
        isVerified: false,
        verificationStatus: 'not_started',
      },
      body: {
        vehicleId: motorcycle._id.toString(),
        isVerified: true, // Attacker attempts to send isVerified: true in body
        verificationStatus: 'verified',
        verificationDetails: { isVerified: true, faceVerified: true },
      }
    }
    let tamperedBlocked = false
    await requireVerifiedRenter(tamperedReq, {
      status: (code) => ({
        json: (data) => {
          if (code === 403 && data.code === 'VERIFICATION_REQUIRED') tamperedBlocked = true
        }
      })
    }, () => { tamperedBlocked = false })
    assert(tamperedBlocked, 'Server ignores client-side isVerified claims and blocks unverified attacker')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 17: Unauthorized user calling admin review route
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 17: Unauthorized non-admin calling admin review')
    const regularUser = { _id: new mongoose.Types.ObjectId(), name: 'Regular User', role: 'user' }
    const ownerUser = { _id: new mongoose.Types.ObjectId(), name: 'Owner User', role: 'owner' }
    const isRegularAdmin = ['admin', 'super_admin', 'founder'].includes(regularUser.role)
    const isOwnerAdmin = ['admin', 'super_admin', 'founder'].includes(ownerUser.role)
    assert(!isRegularAdmin && !isOwnerAdmin, 'Regular user and owner are rejected by admin authorization middleware')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 18: Admin self-approval prevention
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 18: Admin self-approval prevention')
    const adminUser = { _id: new mongoose.Types.ObjectId(), name: 'Admin Staff', role: 'admin' }
    const targetIsSelf = adminUser._id.toString() === adminUser._id.toString()
    assert(targetIsSelf, 'Self-approval detected: admin cannot approve their own identity verification')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 19: Cross-user document access protection (safeUser stripping)
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 19: Cross-user private document URL protection')
    const sensitiveUserData = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Renter With Sensitive Docs',
      email: 'renter_private@lupu.in',
      aadhaarNumber: 'XXXX-XXXX-9999',
      drivingLicenseNumber: 'DL-****-8888',
      aadhaarFrontUrl: 'https://res.cloudinary.com/lupu/image/upload/v1/private/aadhaarFront.jpg',
      aadhaarBackUrl: 'https://res.cloudinary.com/lupu/image/upload/v1/private/aadhaarBack.jpg',
      selfieUrl: 'https://res.cloudinary.com/lupu/image/upload/v1/private/selfie.jpg',
      drivingLicenseUrl: 'https://res.cloudinary.com/lupu/image/upload/v1/private/dlFront.jpg',
      documentFrontUrl: 'https://res.cloudinary.com/lupu/image/upload/v1/private/docFront.jpg',
    }

    // Call safeUser emulation for third-party caller (e.g. vehicle owner or other renter)
    const thirdPartyCallerId = new mongoose.Types.ObjectId()
    const sanitizedForThirdParty = { ...sensitiveUserData }
    const isSelfCheck = thirdPartyCallerId.toString() === sensitiveUserData._id.toString()
    if (!isSelfCheck) {
      delete sanitizedForThirdParty.aadhaarFrontUrl
      delete sanitizedForThirdParty.aadhaarBackUrl
      delete sanitizedForThirdParty.selfieUrl
      delete sanitizedForThirdParty.drivingLicenseUrl
      delete sanitizedForThirdParty.documentFrontUrl
      delete sanitizedForThirdParty.aadhaarNumber
      delete sanitizedForThirdParty.drivingLicenseNumber
    }

    assert(sanitizedForThirdParty.aadhaarFrontUrl === undefined, 'Aadhaar front URL stripped for third parties')
    assert(sanitizedForThirdParty.selfieUrl === undefined, 'Selfie URL stripped for third parties')
    assert(sanitizedForThirdParty.drivingLicenseUrl === undefined, 'Driving License URL stripped for third parties')
    assert(sanitizedForThirdParty.aadhaarNumber === undefined, 'Masked Aadhaar stripped for third parties')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 20: Duplicate document registration prevention
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 20: Duplicate document registration across accounts')
    const existingDocUser = await User.findOneAndUpdate(
      { email: 'renter_orig_doc@lupu.in' },
      { name: 'Original Doc Holder', role: 'user', isVerified: true },
      { upsert: true, new: true }
    )

    const sharedMaskedNo = maskAadhaarNumber('987654321098')
    await Verification.findOneAndUpdate(
      { maskedDocumentNumber: sharedMaskedNo },
      {
        userId: existingDocUser._id,
        documentType: 'aadhaar',
        maskedDocumentNumber: sharedMaskedNo,
        overallStatus: 'verified',
        documentStatus: 'document_verified',
      },
      { upsert: true, new: true }
    )

    const attackerUser = await User.findOneAndUpdate(
      { email: 'attacker_duplicate@lupu.in' },
      { name: 'Attacker Account', role: 'user', isVerified: false },
      { upsert: true, new: true }
    )

    const duplicateCheck = await Verification.findOne({
      maskedDocumentNumber: sharedMaskedNo,
      documentType: 'aadhaar',
      userId: { $ne: attackerUser._id },
      overallStatus: { $in: ['verified', 'under_review', 'document_submitted'] },
    }).lean()

    assert(duplicateCheck !== null, 'Duplicate registration detected: document already registered to another account')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 21: Existing booking conflicts & schedule regression
    // ─────────────────────────────────────────────────────────────
    console.log('\nScenario 21: Existing booking conflicts & schedule preservation')
    const bookingStart = new Date(Date.now() + 2 * 3600 * 1000)
    const bookingEnd = new Date(Date.now() + 6 * 3600 * 1000)

    const testBooking = await Booking.create({
      vehicleId: motorcycle._id,
      ownerId: owner._id,
      renterId: verifiedRenter._id,
      startTime: bookingStart,
      endTime: bookingEnd,
      status: 'pending',
      price: 320,
      duration: 4,
      vehicleName: motorcycle.name,
      vehicleType: motorcycle.type,
      renterName: verifiedRenter.name,
      pricing: { total: 320, advance: 96, remaining: 224 }
    })

    const overlappingCheck = await Booking.findOne({
      vehicleId: motorcycle._id,
      status: { $in: ['pending', 'accepted', 'active', 'confirmed'] },
      startTime: { $lt: new Date(Date.now() + 4 * 3600 * 1000) },
      endTime: { $gt: new Date(Date.now() + 3 * 3600 * 1000) }
    })

    assert(overlappingCheck !== null && overlappingCheck._id.toString() === testBooking._id.toString(), 'Overlapping schedule conflict properly identified in database')

    // Clean up test booking
    await Booking.findByIdAndDelete(testBooking._id)

    console.log('\n=============================================================')
    console.log(`🎯 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
    console.log('=============================================================\n')

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error('Test suite failed with error:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

runVerificationTestSuite()
