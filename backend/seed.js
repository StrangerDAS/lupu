import mongoose from 'mongoose'
import User from './models/User.js'
import Vehicle from './models/Vehicle.js'
import Accessory from './models/Accessory.js'
import Booking from './models/Booking.js'

export async function seedDatabase() {
  // Production DB initialization: real accounts and listings are managed through the application
  console.log('  ℹ️  Production seed check: No automated demo data injected.')
}
