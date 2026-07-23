import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Cleanup any old test users
  await User.deleteMany({ email: { $in: ['test1@example.com', 'test2@example.com'] } });
  
  const createMockUser = async (uid, email) => {
    const firebaseUser = { uid, email, name: "Mock User", email_verified: true };
    let user = new User({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.name || 'LUPU User',
        role: 'user',
        isRider: true,
        isOwner: false,
        emailVerified: firebaseUser.email_verified,
        ...(firebaseUser.phone_number && { phone: firebaseUser.phone_number }),
        lastLogin: new Date()
      });
    return await user.save();
  };

  try {
    console.log("Creating user 1...");
    const u1 = await createMockUser("uid-1", "test1@example.com");
    console.log("User 1 created successfully, phone exists?", 'phone' in u1.toObject());
    
    console.log("Creating user 2...");
    const u2 = await createMockUser("uid-2", "test2@example.com");
    console.log("User 2 created successfully, phone exists?", 'phone' in u2.toObject());
    
  } catch (err) {
    console.error("Save Error:", err.message);
  }
  
  await mongoose.connection.close();
}

test();
