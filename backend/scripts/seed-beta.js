import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import User from '../models/User.js'
import Vehicle from '../models/Vehicle.js'
import Booking from '../models/Booking.js'
import Review from '../models/Review.js'
import Report from '../models/Report.js'
import Dispute from '../models/Dispute.js'
import SOS from '../models/SOS.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lupu'

// Utility to generate random phone numbers
const generatePhone = () => {
  return '9' + Math.floor(Math.random() * 900000000 + 100000000).toString()
}

// Utility to get random items from array
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)]

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Shaurya', 'Atharv', 'Rudra', 'Kabir', 'Dhruv', 'Ananya', 'Diya', 'Advika', 'Jiya', 'Myra', 'Aadya', 'Kavya', 'Anvi', 'Aarohi', 'Fatima', 'Rahul', 'Amit', 'Priya', 'Neha', 'Rohan', 'Sneha', 'Vikram', 'Pooja', 'Siddharth', 'Simran']
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Das', 'Gogoi', 'Borah', 'Saikia', 'Baruah', 'Phukan', 'Sonowal', 'Kachari', 'Bhattacharya', 'Choudhury', 'Nath', 'Deka', 'Kalita', 'Mahanta', 'Hazarika', 'Sarma', 'Goswami']

const locations = ['AT Road, Dibrugarh', 'Chowkidinghee, Dibrugarh', 'Graham Bazar, Dibrugarh', 'Mohanbari, Dibrugarh', 'Jalukpara, Dibrugarh', 'Naliapool, Dibrugarh', 'Marwari Patty, Dibrugarh', 'Dibrugarh University']

const vehicleModels = [
  { brand: 'Royal Enfield', model: 'Classic 350', type: 'bike', pricePerHour: 120, pricePerDay: 800, cc: 350 },
  { brand: 'Honda', model: 'Activa 6G', type: 'scooty', pricePerHour: 55, pricePerDay: 350, cc: 110 },
  { brand: 'Bajaj', model: 'Pulsar NS200', type: 'bike', pricePerHour: 100, pricePerDay: 650, cc: 200 },
  { brand: 'Hero', model: 'Splendor Plus', type: 'bike', pricePerHour: 40, pricePerDay: 250, cc: 100 },
  { brand: 'TVS', model: 'Jupiter', type: 'scooty', pricePerHour: 60, pricePerDay: 380, cc: 110 },
  { brand: 'KTM', model: 'Duke 200', type: 'bike', pricePerHour: 150, pricePerDay: 1000, cc: 200 },
  { brand: 'Yamaha', model: 'FZ-S V3', type: 'bike', pricePerHour: 80, pricePerDay: 500, cc: 150 },
  { brand: 'Suzuki', model: 'Access 125', type: 'scooty', pricePerHour: 65, pricePerDay: 400, cc: 125 },
  { brand: 'Royal Enfield', model: 'Himalayan', type: 'bike', pricePerHour: 180, pricePerDay: 1200, cc: 411 },
  { brand: 'TVS', model: 'Apache RTR 160', type: 'bike', pricePerHour: 90, pricePerDay: 550, cc: 160 }
]

async function run() {
  console.log('Connecting to MongoDB...')
  await mongoose.connect(MONGODB_URI)
  console.log('Connected.')

  // Optional: Clean DB? Let's just append to not break the user's admin account.
  // We will tag beta generated users with a special prefix in email to easily identify or clean them later.

  console.log('🌱 Generating 20 Verified Owners...')
  const owners = []
  for (let i = 0; i < 20; i++) {
    const fn = sample(firstNames)
    const ln = sample(lastNames)
    const owner = await User.create({
      name: `${fn} ${ln}`,
      email: `beta_owner_${i}@lupu.in`,
      phone: generatePhone(),
      role: 'owner',
      isRider: true,
      isOwner: true,
      otpVerified: true,
      kycStatus: 'verified',
    })
    owners.push(owner)
  }

  console.log('🌱 Generating 100 Verified Users...')
  const users = []
  for (let i = 0; i < 100; i++) {
    const fn = sample(firstNames)
    const ln = sample(lastNames)
    const user = await User.create({
      name: `${fn} ${ln}`,
      email: `beta_user_${i}@lupu.in`,
      phone: generatePhone(),
      role: 'user',
      isRider: true,
      isOwner: false,
      otpVerified: true,
      kycStatus: 'verified',
    })
    users.push(user)
  }

  console.log('🌱 Generating 50 Verified Vehicles...')
  const vehicles = []
  for (let i = 0; i < 50; i++) {
    const owner = sample(owners)
    const vModel = sample(vehicleModels)
    const year = 2018 + Math.floor(Math.random() * 6) // 2018-2023
    
    const reg1 = 'AS'
    const reg2 = '06' // Dibrugarh
    const reg3 = sample(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    const reg4 = Math.floor(1000 + Math.random() * 9000)
    const regNum = `${reg1}${reg2}${reg3}${reg4}`

    const vehicle = await Vehicle.create({
      name: `${vModel.brand} ${vModel.model}`,
      brand: vModel.brand,
      model: vModel.model,
      registrationNumber: regNum,
      type: vModel.type,
      pricePerHour: vModel.pricePerHour,
      pricePerDay: vModel.pricePerDay,
      verificationStatus: 'approved',
      status: 'approved',
      isLive: true,
      rating: (4 + Math.random()).toFixed(1), // 4.0 to 5.0
      totalReviews: Math.floor(Math.random() * 30),
      location: sample(locations),
      description: `Well maintained ${vModel.brand} ${vModel.model} available for rent in Dibrugarh. Comes with helmet.`,
      specs: { year, cc: vModel.cc, fuel: 'Petrol', transmission: vModel.type === 'scooty' ? 'Automatic' : 'Manual' },
      ownerId: owner._id,
      owner: { name: owner.name, rating: 4.8, totalTrips: Math.floor(Math.random() * 50) }
    })
    vehicles.push(vehicle)
  }

  console.log(`✅ Beta data seeded successfully!`)
  console.log(`   - 20 Owners Created`)
  console.log(`   - 100 Users Created`)
  console.log(`   - 50 Vehicles Created`)

  mongoose.disconnect()
}

run().catch(err => {
  console.error('Failed to seed beta data:', err)
  process.exit(1)
})
