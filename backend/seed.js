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

    // Seed users (1 Admin, 1 Owner, 1 Renter)
    const [admin, owner, renter] = await User.insertMany([
      { name: 'Admin User', email: 'admin@lupu.in', phone: '9876543210', role: 'admin', isRider: true, isOwner: true, otpVerified: true },
      { name: 'Owner User', email: 'owner@lupu.in', phone: '9876543211', role: 'owner', isRider: true, isOwner: true, otpVerified: true },
      { name: 'Renter User', email: 'renter@lupu.in', phone: '9876543212', role: 'user', isRider: true, isOwner: false, otpVerified: true },
    ])

    // Seed vehicles
    const vehicles = await Vehicle.insertMany([
      { name: 'Royal Enfield Classic 350', type: 'bike', pricePerHour: 120, pricePerDay: 800, status: 'approved', isLive: true, rating: 4.8, totalReviews: 24, location: 'AT Road, Dibrugarh', description: 'A well-maintained Royal Enfield Classic 350. Full-service history available. Helmet included. Perfect for long rides and city commuting.', specs: { year: 2022, cc: 350, fuel: 'Petrol', transmission: 'Manual' }, images: [], ownerId: owner._id, owner: { name: owner.name, rating: 4.9, totalTrips: 47 } },
      { name: 'Honda Activa 6G', type: 'scooty', pricePerHour: 55, pricePerDay: 350, status: 'approved', isLive: true, rating: 4.6, totalReviews: 18, location: 'Chowkidinghee, Dibrugarh', description: 'Reliable Honda Activa — ideal for city errands and college commutes.', specs: { year: 2023, cc: 110, fuel: 'Petrol', transmission: 'Automatic' }, images: [], ownerId: owner._id, owner: { name: owner.name, rating: 4.7, totalTrips: 31 } },
      { name: 'Bajaj Pulsar NS200', type: 'bike', pricePerHour: 100, pricePerDay: 650, status: 'approved', isLive: false, rating: 4.5, totalReviews: 9, location: 'Graham Bazar, Dibrugarh', description: 'Sporty Pulsar NS200 in great condition. Good for highway and city rides.', specs: { year: 2021, cc: 200, fuel: 'Petrol', transmission: 'Manual' }, images: [], ownerId: owner._id, owner: { name: owner.name, rating: 4.5, totalTrips: 12 } },
      { name: 'Hero Splendor Plus', type: 'bike', pricePerHour: 40, pricePerDay: 250, status: 'pending', isLive: false, rating: 0, totalReviews: 0, location: 'Mohanbari, Dibrugarh', description: 'Budget-friendly Hero Splendor. Perfect for city commuting.', specs: { year: 2023, cc: 100, fuel: 'Petrol', transmission: 'Manual' }, images: [], ownerId: owner._id, owner: { name: owner.name, rating: 0, totalTrips: 0 } }
    ])

    // Seed accessories
    await Accessory.insertMany([
      { name: 'Full-Face Helmet', category: 'accessory', pricePerDay: 50, description: 'ISI-certified full-face helmet. Visor included.', availability: true, ownerId: owner._id, owner: { name: owner.name }, rating: 4.8, totalReviews: 15, location: 'AT Road, Dibrugarh', images: [] },
      { name: 'Riding Gloves', category: 'accessory', pricePerDay: 30, description: 'Touch-screen compatible riding gloves. Good grip.', availability: true, ownerId: owner._id, owner: { name: owner.name }, rating: 4.5, totalReviews: 8, location: 'AT Road, Dibrugarh', images: [] }
    ])

    // Seed sample bookings
    await Booking.insertMany([
      {
        userId: renter._id,
        items: [{ itemId: vehicles[1]._id.toString(), name: 'Honda Activa 6G', type: 'vehicle', price: 350 }],
        startTime: new Date('2024-05-10T09:00:00Z'),
        endTime: new Date('2024-05-10T18:00:00Z'),
        status: 'completed',
        totalAmount: 495,
        agreementAccepted: true,
        agreementTimestamp: new Date('2024-05-10T08:30:00Z'),
      }
    ])

    console.log(`  ✅ Seeded: 3 users, ${vehicles.length} vehicles, 2 accessories, 1 bookings`)
    console.log('')
    console.log('  📧 Test accounts (use send-otp to get code, printed in console):')
    console.log('     admin@lupu.in  (Admin)')
    console.log('     owner@lupu.in  (Owner)')
    console.log('     renter@lupu.in (Renter)')

  } catch (error) {
    console.error('  ❌ Error seeding database:', error)
  }
}
