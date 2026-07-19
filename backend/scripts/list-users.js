import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')
    
    const users = await User.find({})
    
    users.forEach(u => {
      console.log(`Email: ${u.email}, Phone: ${u.phone}, Name: ${u.name}, Role: ${u.role}`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

listUsers()
