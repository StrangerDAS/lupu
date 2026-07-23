const mongoose = require('mongoose');
const User = require('./backend/models/User').default;
require('dotenv').config({ path: './backend/.env' });

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Try to create a user exactly as the route does
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
