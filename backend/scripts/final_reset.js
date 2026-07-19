import mongoose from 'mongoose'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get env variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import User from '../models/User.js'
import Vehicle from '../models/Vehicle.js'
import Booking from '../models/Booking.js'
import Review from '../models/Review.js'
import Notification from '../models/Notification.js'
import Dispute from '../models/Dispute.js'
import Report from '../models/Report.js'
import Payment from '../models/Payment.js'
import Accessory from '../models/Accessory.js'
import Email from '../models/Email.js'
import SOS from '../models/SOS.js'

async function cleanup() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected.')

    console.log('Starting Final Beta Reset...')

    // 1. Delete all non-super-admin users
    const SUPER_ADMIN_EMAIL = 'ddlfqwer@gmail.com'
    const deletedUsers = await User.deleteMany({ email: { $ne: SUPER_ADMIN_EMAIL } })
    console.log(`Deleted ${deletedUsers.deletedCount} non-super-admin users.`)

    // 2. Wipe everything else entirely since vehicles and bookings only belong to non-super admins
    // Or even if they did, instructions say "Vehicles: 0, Bookings: 0"
    
    const deletions = await Promise.all([
      Vehicle.deleteMany({}),
      Booking.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Dispute.deleteMany({}),
      Report.deleteMany({}),
      Payment.deleteMany({}),
      Accessory.deleteMany({}),
      Email.deleteMany({}),
      SOS.deleteMany({})
    ])

    console.log('Deleted all Vehicles, Bookings, Notifications, Reviews, and linked records.')

    // 3. Clear the uploads directory
    const uploadsDir = path.join(__dirname, '..', 'uploads')
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir)
      let deletedFilesCount = 0
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(uploadsDir, file))
          deletedFilesCount++
        }
      }
      console.log(`Deleted ${deletedFilesCount} files from uploads directory.`)
    }

    // 4. Verify Final State
    const finalUsersCount = await User.countDocuments()
    const finalSuperAdmins = await User.countDocuments({ email: SUPER_ADMIN_EMAIL })
    const finalOwners = await User.countDocuments({ role: 'owner' })
    const finalCustomers = await User.countDocuments({ role: 'user' })
    const finalVehicles = await Vehicle.countDocuments()
    const finalBookings = await Booking.countDocuments()
    const pendingKyc = await User.countDocuments({ kycStatus: 'pending' })

    console.log('\n--- Final Verification ---')
    console.log(`Users: ${finalUsersCount}`)
    console.log(`Super Admin: ${finalSuperAdmins}`)
    console.log(`Owners: ${finalOwners}`)
    console.log(`Customers: ${finalCustomers}`)
    console.log(`Vehicles: ${finalVehicles}`)
    console.log(`Bookings: ${finalBookings}`)
    console.log(`Pending KYC: ${pendingKyc}`)

    process.exit(0)
  } catch (error) {
    console.error('Cleanup failed:', error)
    process.exit(1)
  }
}

cleanup()
