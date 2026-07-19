import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'

async function makeSuperAdmin() {
  const email = 'ddlfqwer@gmail.com'
  
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')
    
    const user = await User.findOne({ email })
    
    if (!user) {
      console.log(`User with email ${email} not found.`)
      process.exit(1)
    }
    
    user.role = 'super_admin'
    await user.save()
    
    console.log(`Successfully updated ${email} to super_admin!`)
    process.exit(0)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

makeSuperAdmin()
