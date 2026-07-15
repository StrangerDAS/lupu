import 'dotenv/config'
import mongoose from 'mongoose'
import User from './models/User.js'
import Vehicle from './models/Vehicle.js'

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }
  const state = stateMap[mongoose.connection.readyState]
  
  const dbName = mongoose.connection.name
  const host = mongoose.connection.host
  
  const adminCount = await User.countDocuments({ role: 'admin' })
  const ownerCount = await User.countDocuments({ role: 'owner' })
  const renterCount = await User.countDocuments({ role: 'user' })
  const vehicleCount = await Vehicle.countDocuments()
  
  console.log(JSON.stringify({
    connection: { state, dbName, host },
    counts: { adminCount, ownerCount, renterCount, vehicleCount }
  }, null, 2))
  
  await mongoose.connection.close()
}

verify().catch(console.error)
