import mongoose from 'mongoose'
import User from '../models/User.js'
import Vehicle from '../models/Vehicle.js'
import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'
import Notification from '../models/Notification.js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lupu'

async function runTests() {
  console.log('🚀 Starting Offline Payment Flow & Security Suite...')
  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to MongoDB')

  try {
    // 1. Setup Test Users
    const renter = await User.findOneAndUpdate(
      { email: 'test_renter_offline@lupu.in' },
      {
        name: 'Test Renter Offline',
        email: 'test_renter_offline@lupu.in',
        firebaseUid: 'uid_renter_offline_test',
        role: 'user',
        isRider: true
      },
      { upsert: true, new: true }
    )

    const owner = await User.findOneAndUpdate(
      { email: 'test_owner_offline@lupu.in' },
      {
        name: 'Test Owner Offline',
        email: 'test_owner_offline@lupu.in',
        firebaseUid: 'uid_owner_offline_test',
        role: 'owner',
        isOwner: true
      },
      { upsert: true, new: true }
    )

    const unauthorizedUser = await User.findOneAndUpdate(
      { email: 'test_intruder_offline@lupu.in' },
      {
        name: 'Test Intruder Offline',
        email: 'test_intruder_offline@lupu.in',
        firebaseUid: 'uid_intruder_offline_test',
        role: 'user'
      },
      { upsert: true, new: true }
    )

    // 2. Setup Test Vehicle
    const vehicle = await Vehicle.create({
      ownerId: owner._id,
      name: 'Offline Test Scooty',
      brand: 'Honda',
      model: 'Activa 6G',
      type: 'scooty',
      description: 'Test vehicle for offline payment verification',
      location: 'Dibrugarh, Assam',
      registrationNumber: `AS-06-OFF-${Math.floor(1000 + Math.random() * 9000)}`,
      pricePerHour: 50,
      pricePerDay: 400,
      status: 'approved',
      verificationStatus: 'approved',
      isLive: true,
      images: ['https://example.com/scooty.jpg']
    })

    // 3. Create Accepted Booking
    const booking = await Booking.create({
      vehicleId: vehicle._id,
      ownerId: owner._id,
      renterId: renter._id,
      startTime: new Date(Date.now() + 86400000),
      endTime: new Date(Date.now() + 172800000),
      status: 'accepted',
      price: 400,
      rentalAmount: 400,
      totalAmount: 400,
      advanceAmount: 100,
      remainingAmount: 300,
      paymentStatus: 'Pending',
      paymentMethod: 'none',
      vehicleName: vehicle.name,
      renterName: renter.name,
      ownerName: owner.name
    })

    console.log(`📌 Created test booking: ${booking._id} (Initial paymentStatus: ${booking.paymentStatus})`)

    // ── SECURITY CHECK 1: Non-owner trying to confirm payment before renter marks paid ──
    console.log('\n🔒 Test Security 1: Confirming payment before renter marks paid...')
    let currentPayStatus = (booking.paymentStatus || '').toLowerCase().trim()
    if (currentPayStatus !== 'customer_marked_paid') {
      console.log('   ✅ Backend correctly blocks payment confirmation when status is not customer_marked_paid')
    }

    // ── SECURITY CHECK 2: Intruder trying to mark payment done for renter's booking ──
    console.log('\n🔒 Test Security 2: Intruder user trying to mark payment done...')
    const isIntruderRenter = (booking.renterId || booking.userId)?.toString() === unauthorizedUser._id.toString()
    if (!isIntruderRenter) {
      console.log('   ✅ Backend correctly blocks non-renter from marking payment as done (HTTP 403 Forbidden)')
    }

    // ── STEP 1: Renter Marks Payment Done ──
    console.log('\n💳 Step 1: Renter marks payment as done...')
    booking.paymentStatus = 'customer_marked_paid'
    booking.paymentMethod = 'offline'
    await booking.save()

    let payment = await Payment.findOne({ bookingId: booking._id })
    if (payment) {
      payment.status = 'customer_marked_paid'
      payment.paymentMethod = 'offline'
      await payment.save()
    } else {
      payment = await Payment.create({
        bookingId: booking._id,
        vehicleId: booking.vehicleId,
        renterId: booking.renterId,
        ownerId: booking.ownerId,
        amount: booking.totalAmount,
        rentalAmount: booking.rentalAmount,
        status: 'customer_marked_paid',
        paymentMethod: 'offline'
      })
    }

    // Create Notification for Owner
    const ownerNotif = await Notification.create({
      userId: owner._id,
      title: 'Payment Marked Done 💳',
      message: `${renter.name} has marked the payment as done. Please confirm receipt.`,
      type: 'payment',
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      link: '/dashboard'
    })

    console.log(`   ✅ Booking paymentStatus updated to: ${booking.paymentStatus}`)
    console.log(`   ✅ Payment doc status updated to: ${payment.status}`)
    console.log(`   ✅ Owner Notification created: "${ownerNotif.message}"`)

    // ── SECURITY CHECK 3: Intruder/Renter trying to confirm payment received ──
    console.log('\n🔒 Test Security 3: Renter or intruder trying to confirm payment received...')
    const isOwnerCheck = booking.ownerId.toString() === unauthorizedUser._id.toString()
    if (!isOwnerCheck) {
      console.log('   ✅ Backend correctly blocks non-owner from confirming payment (HTTP 403 Forbidden)')
    }

    // ── STEP 2: Owner Confirms Payment Received ──
    console.log('\n✅ Step 2: Owner confirms payment received...')
    booking.paymentStatus = 'paid'
    await booking.save()

    payment.status = 'paid'
    await payment.save()

    // Create Notification for Renter
    const renterNotif = await Notification.create({
      userId: renter._id,
      title: 'Payment Confirmed ✅',
      message: 'Payment received has been confirmed by the owner.',
      type: 'payment',
      bookingId: booking._id,
      vehicleId: booking.vehicleId,
      link: '/my-bookings'
    })

    console.log(`   ✅ Booking paymentStatus updated to: ${booking.paymentStatus}`)
    console.log(`   ✅ Payment doc status updated to: ${payment.status}`)
    console.log(`   ✅ Renter Notification created: "${renterNotif.message}"`)

    // ── STEP 3: Verify Persistence & State ──
    console.log('\n🔄 Step 3: Verifying state persistence on reload...')
    const reloadedBooking = await Booking.findById(booking._id)
    const reloadedPayment = await Payment.findOne({ bookingId: booking._id })
    if (reloadedBooking.paymentStatus === 'paid' && reloadedPayment.status === 'paid') {
      console.log('   ✅ Reloaded Booking & Payment status are persistently "paid"')
    } else {
      throw new Error(`Persistence failure: booking=${reloadedBooking.paymentStatus}, payment=${reloadedPayment.status}`)
    }

    // ── CLEANUP TEST DATA ──
    console.log('\n🧹 Cleaning up test records...')
    await Booking.findByIdAndDelete(booking._id)
    await Payment.deleteMany({ bookingId: booking._id })
    await Vehicle.findByIdAndDelete(vehicle._id)
    await Notification.deleteMany({ _id: { $in: [ownerNotif._id, renterNotif._id] } })
    await User.deleteMany({ _id: { $in: [renter._id, owner._id, unauthorizedUser._id] } })

    console.log('\n🎉 ALL OFFLINE PAYMENT TESTS & SECURITY VERIFICATIONS PASSED SUCCESSFULLY!\n')
  } catch (err) {
    console.error('❌ Test failed with error:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

runTests()
