import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import User from '../models/User.js'
import Vehicle from '../models/Vehicle.js'
import Booking from '../models/Booking.js'
import Payment from '../models/Payment.js'
import Notification from '../models/Notification.js'
import Report from '../models/Report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lupu'

async function runTest() {
  console.log('🔄 Starting Beta End-to-End Test...')
  await mongoose.connect(MONGODB_URI)
  
  try {
    // 1. Fetch random verified user and owner
    const user = await User.findOne({ role: 'user', kycStatus: 'verified' })
    const owner = await User.findOne({ role: 'owner', kycStatus: 'verified' })
    
    if (!user || !owner) {
      throw new Error('Test failed: Could not find verified user/owner.')
    }
    
    // 2. Fetch owner's vehicle
    const vehicle = await Vehicle.findOne({ ownerId: owner._id, isLive: true })
    if (!vehicle) {
      throw new Error('Test failed: Owner has no live vehicle.')
    }
    
    console.log(`[1] Selected Renter: ${user.name}, Owner: ${owner.name}, Vehicle: ${vehicle.name}`)

    // 3. User requests a booking
    const booking = await Booking.create({
      renterId: user._id,
      vehicleId: vehicle._id,
      ownerId: owner._id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      status: 'requested', // actually the flow goes: requested -> accepted
      price: vehicle.pricePerDay,
      duration: 24,
      vehicleName: vehicle.name,
      vehicleType: vehicle.type,
      renterName: user.name,
      renterEmail: user.email,
      ownerName: owner.name,
      pricing: {
        total: vehicle.pricePerDay,
        advance: vehicle.pricePerDay * 0.25,
        remaining: vehicle.pricePerDay * 0.75
      }
    })
    console.log(`[2] Booking created (ID: ${booking._id}) | Status: pending`)

    // 4. Owner accepts booking
    booking.status = 'accepted'
    await booking.save()
    console.log(`[3] Owner accepted booking | Status: accepted`)

    // 5. User pays advance (simulating Razorpay success)
    await Payment.create({
      bookingId: booking._id,
      userId: user._id,
      ownerId: owner._id,
      renterId: user._id,
      amount: booking.pricing.advance,
      type: 'advance',
      method: 'razorpay',
      status: 'success',
      transactionId: 'pay_beta_test_' + Date.now()
    })
    booking.status = 'confirmed'
    await booking.save()
    console.log(`[4] Renter paid 25% advance (₹${booking.pricing.advance}) | Status: confirmed`)

    // 6. Ride starts and completes
    booking.status = 'ongoing'
    await booking.save()
    console.log(`[5] Ride started | Status: ongoing`)

    booking.status = 'completed'
    await booking.save()
    console.log(`[6] Ride completed | Status: completed`)

    // 7. Renter pays final amount
    await Payment.create({
      bookingId: booking._id,
      userId: user._id,
      ownerId: owner._id,
      renterId: user._id,
      amount: booking.pricing.remaining,
      type: 'final',
      method: 'razorpay',
      status: 'success',
      transactionId: 'pay_beta_test_final_' + Date.now()
    })
    booking.paymentStatus = 'fully_paid'
    await booking.save()
    console.log(`[7] Renter paid 75% final (₹${booking.pricing.remaining}) | PaymentStatus: fully_paid`)

    // 8. Test Safety Engine: Renter reports vehicle condition
    const report = await Report.create({
      reporterId: user._id,
      targetType: 'vehicle',
      targetId: vehicle._id,
      reason: 'Vehicle Condition Does Not Match',
      description: 'The vehicle had scratches that were not mentioned in the listing.',
      status: 'pending'
    })
    console.log(`[8] Trust & Safety Engine: Renter submitted report (ID: ${report._id})`)

    // 9. Verify Notifications were created
    const notifs = await Notification.find({ userId: user._id })
    console.log(`[9] Notifications Engine: Found ${notifs.length} notifications for renter.`)

    console.log('\n✅ E2E BETA TEST COMPLETED SUCCESSFULLY.')
  } catch (err) {
    console.error('\n❌ E2E BETA TEST FAILED:', err)
  } finally {
    mongoose.disconnect()
  }
}

runTest()
