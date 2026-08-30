import mongoose from 'mongoose'
import User from './models/User.js'
import Vehicle from './models/Vehicle.js'
import Accessory from './models/Accessory.js'
import Booking from './models/Booking.js'

export async function seedDatabase() {
  try {
    const userCount = await User.countDocuments()
    if (userCount > 0) {
      console.log('  ℹ️  Database already seeded — skipping.')
      return
    }

    console.log('  🌱 Seeding database with initial data...')

    // Seed users (1 admin, 1 Owner, 1 Renter)
    const [admin, owner, renter] = await User.insertMany([
      { name: 'Admin User', email: 'admin@lupu.in', phone: '9876543210', role: 'user', isRider: true, isOwner: false, kycStatus: 'verified' },
      { name: 'Owner User', email: 'owner@lupu.in', phone: '9876543211', role: 'owner', isRider: true, isOwner: true, kycStatus: 'verified' },
      { name: 'Renter User', email: 'renter@lupu.in', phone: '9876543212', role: 'user', isRider: true, isOwner: false, kycStatus: 'verified' },
    ])

    // Vehicles start empty — real vehicles added by owners
    const vehicles = []

    // Seed accessories
    await Accessory.insertMany([
      { name: 'Full-Face Helmet', category: 'accessory', pricePerDay: 50, description: 'ISI-certified full-face helmet. Visor included.', availability: true, ownerId: owner._id, owner: { name: owner.name }, rating: 4.8, totalReviews: 15, location: 'AT Road, Dibrugarh', images: [] },
      { name: 'Riding Gloves', category: 'accessory', pricePerDay: 30, description: 'Touch-screen compatible riding gloves. Good grip.', availability: true, ownerId: owner._id, owner: { name: owner.name }, rating: 4.5, totalReviews: 8, location: 'AT Road, Dibrugarh', images: [] }
    ])

    console.log(`  ✅ Seeded: 3 users, ${vehicles.length} vehicles, 2 accessories`)
    console.log('')
    console.log('  📧 Test accounts (use send-otp to get code, printed in console):')
    console.log('     admin@lupu.in  (User)')
    console.log('     owner@lupu.in  (Owner)')
    console.log('     renter@lupu.in (Renter)')

  } catch (error) {
    console.error('  ❌ Error seeding database:', error)
  }
}
