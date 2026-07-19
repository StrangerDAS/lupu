import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

import User from './models/User.js';
import Vehicle from './models/Vehicle.js';
import Booking from './models/Booking.js';
import Accessory from './models/Accessory.js';
import Dispute from './models/Dispute.js';
import Email from './models/Email.js';
import Notification from './models/Notification.js';
import Payment from './models/Payment.js';
import Report from './models/Report.js';
import Review from './models/Review.js';
import SOS from './models/SOS.js';

async function resetDb() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    // 1. Find the super_admin
    const superAdmins = await User.find({ role: 'super_admin' });
    if (superAdmins.length === 0) {
      console.error('ERROR: No super_admin found! Aborting to prevent deleting all users without preserving super admin.');
      process.exit(1);
    }
    
    const superAdminIds = superAdmins.map(admin => admin._id);
    console.log(`Found ${superAdmins.length} super_admin(s). Preserving them.`);

    // 2. Delete all non-super_admin users
    const userDeleteResult = await User.deleteMany({ _id: { $nin: superAdminIds } });
    console.log(`Deleted ${userDeleteResult.deletedCount} non-admin users.`);

    // 3. Clear other collections entirely
    const modelsToClear = [
      { name: 'Vehicle', model: Vehicle },
      { name: 'Booking', model: Booking },
      { name: 'Accessory', model: Accessory },
      { name: 'Dispute', model: Dispute },
      { name: 'Email', model: Email },
      { name: 'Notification', model: Notification },
      { name: 'Payment', model: Payment },
      { name: 'Report', model: Report },
      { name: 'Review', model: Review },
      { name: 'SOS', model: SOS },
    ];

    for (const { name, model } of modelsToClear) {
      const result = await model.deleteMany({});
      console.log(`Deleted ${result.deletedCount} records from ${name}.`);
    }

    // 4. Verify DB state
    console.log('\n--- VERIFICATION ---');
    const remainingUsers = await User.countDocuments();
    const remainingVehicles = await Vehicle.countDocuments();
    const remainingBookings = await Booking.countDocuments();
    
    console.log(`Remaining Users: ${remainingUsers}`);
    console.log(`Remaining Vehicles: ${remainingVehicles}`);
    console.log(`Remaining Bookings: ${remainingBookings}`);

    if (remainingUsers === superAdmins.length && remainingVehicles === 0 && remainingBookings === 0) {
      console.log('Verification PASSED: Database successfully reset for beta testing.');
    } else {
      console.warn('Verification WARNING: Expected counts do not match.');
    }

  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

resetDb();
