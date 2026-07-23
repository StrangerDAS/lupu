import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const firebaseUser = {
    uid: "mock-uid-12345",
    email: "test@example.com",
    name: "Mock User",
    email_verified: true
  };
  
  try {
    let user = new User({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.name || 'LUPU User',
        role: 'user',
        isRider: true,
        isOwner: false,
        emailVerified: firebaseUser.email_verified,
        phone: firebaseUser.phone_number || '',
        lastLogin: new Date()
      });
    await user.save();
    console.log("Success");
  } catch (err) {
    console.error("Save Error:", err.message);
    console.error(err.stack);
  }
  
  await mongoose.connection.close();
}

test();
