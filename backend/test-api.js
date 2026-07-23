import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import User from './models/User.js';

async function run() {
  const mongod = await MongoMemoryServer.create({ instance: { startupTimeout: 60000 } });
  const uri = mongod.getUri();
  
  await mongoose.connect(uri);
  
  // Insert the "bad" document that was created before the fix
  await User.collection.insertOne({
    name: "Old User",
    email: "old@example.com",
    firebaseUid: "old-uid",
    phone: "",
    role: "user"
  });

  // Simulate POST /api/auth/login for a NEW user
  const firebaseUser = { uid: "new-uid", email: "new@example.com", email_verified: true };
  
  try {
    let user = new User({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: 'LUPU User',
        role: 'user',
        isRider: true,
        isOwner: false,
        emailVerified: firebaseUser.email_verified,
        ...(firebaseUser.phone_number && { phone: firebaseUser.phone_number }),
        lastLogin: new Date()
      });
    await user.save();
    console.log("New user saved successfully.");
  } catch (err) {
    console.error("New user save error:", err);
  }

  // Simulate POST /api/auth/login for the OLD user
  try {
    let oldUser = await User.findOne({ firebaseUid: "old-uid" });
    oldUser.lastLogin = new Date();
    await oldUser.save();
    console.log("Old user updated successfully.");
  } catch (err) {
    console.log("-------------------");
    console.log("HTTP 500 RUNTIME ERROR:");
    console.error(err);
    console.log("-------------------");
  }

  await mongoose.disconnect();
  await mongod.stop();
}

run();
