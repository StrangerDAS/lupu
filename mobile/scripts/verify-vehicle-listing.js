import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o",
  authDomain: "uniride-9be37.firebaseapp.com",
  projectId: "uniride-9be37",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = 'urentofficial26_test2@gmail.com';
const password = 'LupuTestPassword2026!';

async function verifyVehicleListing() {
  console.log('===> 1. Authenticating test owner...');
  const loginCred = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await loginCred.user.getIdToken();
  console.log('✅ Authenticated successfully.');

  // Sync login
  const syncRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ name: 'Verified Owner', role: 'user' })
  });
  console.log('✅ User sync login status:', syncRes.status);

  // Test Submission
  console.log('\n===> 2. Testing Vehicle Submission (Verification Pending)...');
  const regNumber = 'AS06VERIFY' + Math.floor(1000 + Math.random() * 9000);
  const submitPayload = {
    name: 'Meteor 350 Fireball',
    brand: 'Royal Enfield',
    model: 'Fireball Yellow',
    registrationNumber: regNumber,
    type: 'bike',
    pricePerHour: 89,
    pricePerDay: 799,
    securityDeposit: 0,
    location: 'Dibrugarh University Gate 2',
    description: 'Verified Royal Enfield Meteor 350 available for self-drive rental in Dibrugarh.',
    verificationStatus: 'submitted',
    ownerName: 'Verified Owner',
    ownerPhone: '9876543210',
    photos: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=800&auto=format&fit=crop&q=80'
    ],
    documents: {
      RC: 'https://lupu.in/docs/rc_pending_review.pdf',
      Insurance: 'https://lupu.in/docs/insurance_pending_review.pdf',
      PUC: 'https://lupu.in/docs/puc_pending_review.pdf'
    }
  };

  const submitRes = await fetch('http://localhost:5001/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify(submitPayload),
  });

  console.log('Submission HTTP status:', submitRes.status);
  const submitData = await submitRes.json();
  if (submitRes.status !== 201) {
    throw new Error(`Failed to submit vehicle: ${JSON.stringify(submitData)}`);
  }
  console.log(`✅ Vehicle submitted successfully! ID: ${submitData._id}, status: ${submitData.status}, verificationStatus: ${submitData.verificationStatus}`);

  // Test Draft
  console.log('\n===> 3. Testing Vehicle Draft Creation...');
  const draftRegNumber = 'AS06DRAFT' + Math.floor(1000 + Math.random() * 9000);
  const draftPayload = {
    name: 'Jupiter 125 SmartXonnect',
    brand: 'TVS',
    model: 'SmartXonnect Disc',
    registrationNumber: draftRegNumber,
    type: 'scooty',
    pricePerHour: 45,
    pricePerDay: 400,
    securityDeposit: 0,
    location: 'Borbheta Chariali, Dibrugarh',
    description: 'Draft listing for TVS Jupiter 125.',
    verificationStatus: 'draft',
    photos: [
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80'
    ]
  };

  const draftRes = await fetch('http://localhost:5001/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify(draftPayload),
  });

  console.log('Draft HTTP status:', draftRes.status);
  const draftData = await draftRes.json();
  if (draftRes.status !== 201) {
    throw new Error(`Failed to save draft: ${JSON.stringify(draftData)}`);
  }
  console.log(`✅ Draft saved successfully! ID: ${draftData._id}, status: ${draftData.status}, verificationStatus: ${draftData.verificationStatus}`);

  // Test Owner Fleet Listing
  console.log('\n===> 4. Verifying /api/vehicles/my returns both vehicles...');
  const myRes = await fetch('http://localhost:5001/api/vehicles/my', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${idToken}` },
  });
  const myData = await myRes.json();
  console.log(`Owner Fleet count: ${myData.vehicles?.length}`);
  const foundSubmitted = myData.vehicles?.some(v => v._id === submitData._id);
  const foundDraft = myData.vehicles?.some(v => v._id === draftData._id);

  if (!foundSubmitted || !foundDraft) {
    throw new Error('Vehicles were not found in owner fleet!');
  }
  console.log('✅ Both submitted vehicle and draft vehicle verified in owner fleet!');

  // Cleanup test vehicles
  console.log('\n===> 5. Cleaning up test vehicles...');
  await fetch(`http://localhost:5001/api/vehicles/${submitData._id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` },
  });
  await fetch(`http://localhost:5001/api/vehicles/${draftData._id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` },
  });
  console.log('✅ Test vehicles cleaned up.');

  console.log('\n🎉 ALL VEHICLE LISTING TESTS PASSED!');
}

verifyVehicleListing().catch((e) => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
