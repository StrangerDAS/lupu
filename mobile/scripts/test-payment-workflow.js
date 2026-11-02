/**
 * LUPU Payment Method & Complete Booking Details Workflow Test Suite
 *
 * Validates:
 * 1. Mandatory Payment Method Selection ('cash' | 'online')
 * 2. Location Preservation (pickupLocation & returnLocation)
 * 3. Gated Online Payment Workflow:
 *    - Blocked while booking is pending/requested
 *    - Blocked for cash bookings
 *    - Allowed once accepted by owner
 *    - Authoritative server amount enforced
 *    - Online payment verification and duplicate prevention
 * 4. Direct Cash Payment Workflow:
 *    - Owner authoritative recording
 *    - Duplicate payment blocking
 * 5. Booking Details Enrichment:
 *    - Vehicle specs, images, locations
 *    - Owner contact revealed ONLY when accepted/confirmed
 */

import assert from 'assert';
import crypto from 'crypto';

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('=== LUPU Payment Method & Details Workflow Test Suite ===\n');

// ── In-Memory Mock Store ─────────────────────────────────────
const store = {
  users: new Map(),
  vehicles: new Map(),
  bookings: new Map(),
  payments: new Map(),
};

const ownerUser = {
  _id: 'user_owner_001',
  name: 'Pranjal Gogoi',
  email: 'owner@lupu.in',
  phone: '9876543210',
  role: 'owner',
};

const renterUser = {
  _id: 'user_renter_002',
  name: 'Anupam Barua',
  email: 'anupam@dibru.ac.in',
  phone: '9854012345',
  role: 'customer',
};

const intruderUser = {
  _id: 'user_intruder_003',
  name: 'Malicious Actor',
  email: 'intruder@evil.com',
  phone: '9000000000',
  role: 'customer',
};

store.users.set(ownerUser._id, ownerUser);
store.users.set(renterUser._id, renterUser);
store.users.set(intruderUser._id, intruderUser);

const sampleVehicle = {
  _id: 'veh_001',
  ownerId: ownerUser._id,
  name: 'Honda Activa 6G',
  brand: 'Honda',
  model: 'Activa 6G',
  type: 'scooty',
  pricePerHour: 49,
  securityDeposit: 0,
  location: { address: 'Dibrugarh University Campus Gate 1' },
  images: ['https://lupu.in/uploads/activa1.jpg'],
  isLive: true,
  status: 'approved',
};
store.vehicles.set(sampleVehicle._id, sampleVehicle);

// ── Business Logic Handlers Under Test ─────────────────────────

function validateAndCreateBooking(caller, payload) {
  const { vehicleId, startTime, endTime, paymentMethod, pickupLocation, returnLocation, agreementAccepted } = payload;
  if (!agreementAccepted) {
    return { status: 400, error: 'You must read and accept the mandatory Rental Agreement to proceed.' };
  }
  if (!paymentMethod || !['cash', 'online'].includes(paymentMethod.toLowerCase().trim())) {
    return { status: 400, error: "Mandatory payment method selection is required. Please choose either 'cash' or 'online'." };
  }
  const vehicle = store.vehicles.get(vehicleId);
  if (!vehicle) {
    return { status: 404, error: 'Vehicle not found.' };
  }
  if (vehicle.ownerId === caller._id) {
    return { status: 400, error: 'Owners cannot book their own vehicles.' };
  }

  const normalizedMethod = paymentMethod.toLowerCase().trim();
  const bookingId = `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const hours = 4;
  const totalAmount = hours * vehicle.pricePerHour; // 196

  const vehicleAddress = typeof vehicle.location === 'string' ? vehicle.location : (vehicle.location?.address || 'Dibrugarh University Campus');

  const newBooking = {
    _id: bookingId,
    vehicleId: vehicle._id,
    vehicleName: vehicle.name,
    vehicleType: vehicle.type,
    ownerId: vehicle.ownerId,
    ownerName: ownerUser.name,
    renterId: caller._id,
    renterName: caller.name,
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    status: 'pending',
    paymentStatus: 'Pending',
    paymentMethod: normalizedMethod,
    totalAmount,
    pickupLocation: pickupLocation || vehicleAddress,
    returnLocation: returnLocation || vehicleAddress,
    createdAt: new Date(),
  };

  store.bookings.set(bookingId, newBooking);
  return { status: 201, data: newBooking };
}

function handleAcceptBooking(caller, bookingId) {
  const booking = store.bookings.get(bookingId);
  if (!booking) return { status: 404, error: 'Booking not found.' };
  if (booking.ownerId !== caller._id) {
    return { status: 403, error: 'You are not authorized to accept this booking.' };
  }
  if (booking.status !== 'pending' && booking.status !== 'requested') {
    return { status: 400, error: `Cannot accept booking in "${booking.status}" status.` };
  }
  booking.status = 'accepted';
  return { status: 200, data: booking };
}

function handleCreateOnlineOrder(caller, bookingId) {
  const booking = store.bookings.get(bookingId);
  if (!booking) return { status: 404, error: 'Booking not found.' };
  if (booking.renterId !== caller._id) {
    return { status: 403, error: 'Only the booking renter can initiate online payment.' };
  }
  const allowed = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'];
  if (!allowed.includes(booking.status)) {
    return {
      status: 400,
      error: `Online payment is only available after the vehicle owner accepts your booking request. Current status: "${booking.status}".`
    };
  }
  if (booking.paymentMethod !== 'online') {
    return {
      status: 400,
      error: 'This booking is configured for cash payment. Only online bookings can initiate digital payment.'
    };
  }
  if (booking.paymentStatus.toLowerCase() === 'paid') {
    return { status: 400, error: 'This booking has already been paid.' };
  }

  const authoritativeAmount = booking.totalAmount;
  const orderId = `ORDER_${booking._id}_${Date.now()}`;
  return {
    status: 200,
    data: {
      orderId,
      amount: authoritativeAmount,
      currency: 'INR',
      bookingId: booking._id,
      paymentMethod: 'online',
    }
  };
}

function handleVerifyOnlinePayment(caller, payload) {
  const { bookingId, orderId, paymentId } = payload;
  const booking = store.bookings.get(bookingId);
  if (!booking) return { status: 404, error: 'Booking not found.' };
  if (booking.renterId !== caller._id) {
    return { status: 403, error: 'Only the booking renter can verify online payment.' };
  }
  if (booking.paymentStatus.toLowerCase() === 'paid') {
    return { status: 400, error: 'This booking has already been marked as paid.' };
  }

  const referenceId = `LUPU-PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const paymentRecord = {
    _id: `pay_${Date.now()}`,
    bookingId: booking._id,
    vehicleId: booking.vehicleId,
    renterId: booking.renterId,
    ownerId: booking.ownerId,
    amount: booking.totalAmount, // authoritative
    paymentMethod: 'online',
    paymentPurpose: 'rental',
    status: 'paid',
    referenceId,
    transactionId: paymentId || `PAY_${Date.now()}`,
    transactionReference: orderId,
    recordedBy: caller._id,
  };

  store.payments.set(paymentRecord._id, paymentRecord);
  booking.paymentStatus = 'paid';

  return { status: 200, data: paymentRecord };
}

function handleRecordCashPayment(caller, payload) {
  const { bookingId, amount, paymentPurpose = 'rental' } = payload;
  const booking = store.bookings.get(bookingId);
  if (!booking) return { status: 404, error: 'Booking not found.' };
  if (booking.ownerId !== caller._id) {
    return { status: 403, error: 'Only the vehicle owner can record offline cash payments.' };
  }
  const allowed = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed'];
  if (!allowed.includes(booking.status)) {
    return { status: 400, error: `Cannot record payment for booking in "${booking.status}" status.` };
  }
  if (booking.paymentStatus.toLowerCase() === 'paid') {
    return { status: 400, error: 'This booking has already been marked as paid. Duplicate payment confirmation is blocked.' };
  }

  const authoritativeAmount = booking.totalAmount;
  const referenceId = `LUPU-PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const paymentRecord = {
    _id: `pay_${Date.now()}`,
    bookingId: booking._id,
    vehicleId: booking.vehicleId,
    renterId: booking.renterId,
    ownerId: booking.ownerId,
    amount: authoritativeAmount, // server-derived authoritative amount
    paymentMethod: 'cash',
    paymentPurpose,
    status: 'recorded',
    referenceId,
    recordedBy: caller._id,
  };

  store.payments.set(paymentRecord._id, paymentRecord);
  booking.paymentStatus = 'paid';
  return { status: 201, data: paymentRecord };
}

function enrichBookingWithContact(booking, requestingUser) {
  if (!booking) return null;
  const b = { ...booking };
  const vehicle = store.vehicles.get(b.vehicleId);
  if (vehicle) {
    b.vehicle = { ...vehicle };
  }
  b.pickupLocation = b.pickupLocation || 'Dibrugarh University Campus';
  b.returnLocation = b.returnLocation || 'Dibrugarh University Campus';

  const isRenter = b.renterId === requestingUser._id;
  const isOwner = b.ownerId === requestingUser._id;
  const isAcceptedOrLater = ['accepted', 'approved', 'active', 'ongoing', 'ready_for_pickup', 'confirmed', 'completed'].includes((b.status || '').toLowerCase());

  if (isRenter && isAcceptedOrLater) {
    const owner = store.users.get(b.ownerId);
    if (owner) {
      b.ownerPhone = owner.phone;
      b.ownerEmail = owner.email;
    }
  } else {
    delete b.ownerPhone;
    delete b.ownerEmail;
  }

  if (isOwner) {
    const renter = store.users.get(b.renterId);
    if (renter) {
      b.renterPhone = renter.phone;
      b.renterEmail = renter.email;
    }
  }

  return b;
}

// ── Test Execution ───────────────────────────────────────────

console.log('--- Test Suite 1: Mandatory Payment Method Validation ---');

it('Fails booking creation when paymentMethod is missing', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    agreementAccepted: true,
  });
  assert.strictEqual(res.status, 400);
  assert(res.error.includes("Mandatory payment method selection is required"));
});

it('Fails booking creation when paymentMethod is invalid (e.g., "crypto")', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    paymentMethod: 'crypto',
    agreementAccepted: true,
  });
  assert.strictEqual(res.status, 400);
  assert(res.error.includes("Mandatory payment method selection is required"));
});

it('Creates booking with paymentMethod="cash" and saves locations', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    paymentMethod: 'cash',
    pickupLocation: 'Dibrugarh Campus Gate 2',
    returnLocation: 'Dibrugarh Campus Gate 2',
    agreementAccepted: true,
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.paymentMethod, 'cash');
  assert.strictEqual(res.data.status, 'pending');
  assert.strictEqual(res.data.paymentStatus, 'Pending');
  assert.strictEqual(res.data.pickupLocation, 'Dibrugarh Campus Gate 2');
  assert.strictEqual(res.data.returnLocation, 'Dibrugarh Campus Gate 2');
});

it('Creates booking with paymentMethod="online" and defaults locations from vehicle', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    paymentMethod: 'online',
    agreementAccepted: true,
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.paymentMethod, 'online');
  assert.strictEqual(res.data.pickupLocation, 'Dibrugarh University Campus Gate 1');
  assert.strictEqual(res.data.returnLocation, 'Dibrugarh University Campus Gate 1');
});

console.log('\n--- Test Suite 2: Online Payment Workflow ---');

let onlineBookingId;
it('Creates an online booking for lifecycle testing', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    paymentMethod: 'online',
    agreementAccepted: true,
  });
  assert.strictEqual(res.status, 201);
  onlineBookingId = res.data._id;
});

it('Blocks online payment order while booking is pending owner approval', () => {
  const res = handleCreateOnlineOrder(renterUser, onlineBookingId);
  assert.strictEqual(res.status, 400);
  assert(res.error.includes('Online payment is only available after the vehicle owner accepts your booking request'));
});

it('Blocks non-renters from initiating online payment', () => {
  // Owner accepts booking first
  handleAcceptBooking(ownerUser, onlineBookingId);
  const res = handleCreateOnlineOrder(intruderUser, onlineBookingId);
  assert.strictEqual(res.status, 403);
  assert(res.error.includes('Only the booking renter can initiate online payment'));
});

let onlineOrder;
it('Allows renter to initiate online payment order once accepted by owner', () => {
  const res = handleCreateOnlineOrder(renterUser, onlineBookingId);
  assert.strictEqual(res.status, 200);
  assert(res.data.orderId.startsWith('ORDER_'));
  assert.strictEqual(res.data.amount, 196);
  assert.strictEqual(res.data.currency, 'INR');
  assert.strictEqual(res.data.paymentMethod, 'online');
  onlineOrder = res.data;
});

it('Verifies online payment, creates Payment record, and marks booking as paid', () => {
  const res = handleVerifyOnlinePayment(renterUser, {
    bookingId: onlineBookingId,
    orderId: onlineOrder.orderId,
    paymentId: 'PAY_MOCK_12345',
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.status, 'paid');
  assert.strictEqual(res.data.paymentMethod, 'online');
  assert(res.data.referenceId.startsWith('LUPU-PAY-'));
  
  const updatedBooking = store.bookings.get(onlineBookingId);
  assert.strictEqual(updatedBooking.paymentStatus, 'paid');
});

it('Blocks duplicate online payment verification once already paid', () => {
  const res = handleVerifyOnlinePayment(renterUser, {
    bookingId: onlineBookingId,
    orderId: onlineOrder.orderId,
    paymentId: 'PAY_MOCK_DUPLICATE',
  });
  assert.strictEqual(res.status, 400);
  assert(res.error.includes('already been marked as paid'));
});

console.log('\n--- Test Suite 3: Cash Payment Safeguards ---');

let cashBookingId;
it('Creates a cash booking and owner accepts it', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    paymentMethod: 'cash',
    agreementAccepted: true,
  });
  assert.strictEqual(res.status, 201);
  cashBookingId = res.data._id;

  const acceptRes = handleAcceptBooking(ownerUser, cashBookingId);
  assert.strictEqual(acceptRes.status, 200);
});

it('Blocks online payment order for a cash booking', () => {
  const res = handleCreateOnlineOrder(renterUser, cashBookingId);
  assert.strictEqual(res.status, 400);
  assert(res.error.includes('configured for cash payment'));
});

it('Owner confirms cash payment, enforcing authoritative amount and updating status to paid', () => {
  const res = handleRecordCashPayment(ownerUser, {
    bookingId: cashBookingId,
    amount: 999999, // tampered amount
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.data.amount, 196); // authoritative 196
  assert.strictEqual(res.data.paymentMethod, 'cash');
  assert.strictEqual(res.data.status, 'recorded');

  const updatedBooking = store.bookings.get(cashBookingId);
  assert.strictEqual(updatedBooking.paymentStatus, 'paid');
});

it('Blocks duplicate cash confirmation for already paid booking', () => {
  const res = handleRecordCashPayment(ownerUser, {
    bookingId: cashBookingId,
  });
  assert.strictEqual(res.status, 400);
  assert(res.error.includes('already been marked as paid'));
});

console.log('\n--- Test Suite 4: Booking Details & Contact Privacy ---');

it('Hides owner contact info when booking is still pending', () => {
  const res = validateAndCreateBooking(renterUser, {
    vehicleId: sampleVehicle._id,
    paymentMethod: 'online',
    agreementAccepted: true,
  });
  const enriched = enrichBookingWithContact(res.data, renterUser);
  assert.strictEqual(enriched.ownerPhone, undefined);
  assert.strictEqual(enriched.ownerEmail, undefined);
});

it('Reveals owner contact info to renter once booking is accepted', () => {
  const enriched = enrichBookingWithContact(store.bookings.get(onlineBookingId), renterUser);
  assert.strictEqual(enriched.ownerPhone, '9876543210');
  assert.strictEqual(enriched.ownerEmail, 'owner@lupu.in');
  assert.strictEqual(enriched.pickupLocation, 'Dibrugarh University Campus Gate 1');
  assert(enriched.vehicle.images.length > 0);
});

it('Reveals renter contact info to owner', () => {
  const enriched = enrichBookingWithContact(store.bookings.get(onlineBookingId), ownerUser);
  assert.strictEqual(enriched.renterPhone, '9854012345');
  assert.strictEqual(enriched.renterEmail, 'anupam@dibru.ac.in');
});

console.log(`\n=== Verification Summary: ${passedTests} passed, ${totalTests - passedTests} failed ===\n`);
