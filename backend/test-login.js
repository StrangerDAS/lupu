import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const uid = 'jAML2Id2PDc74UxehU68nSVB1SZ2'; // User UID from previous diagnostics
const apiKey = 'AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o'; // From frontend config

async function run() {
  try {
    // 1. Init Firebase Admin
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'uniride-9be37'
      });
    }

    const auth = getAuth();
    console.log("Firebase admin initialized. Setting email as verified...");
    await auth.updateUser(uid, { emailVerified: true });

    console.log("Creating custom token...");
    const customToken = await auth.createCustomToken(uid);

    console.log("Exchanging custom token for ID token...");
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    });
    
    const data = await res.json();
    if (data.error) {
      throw new Error(`Auth Error: ${data.error.message}`);
    }
    
    const idToken = data.idToken;
    console.log("Got ID token! Making request to local backend POST /api/auth/login...");

    const backendRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        name: 'Pratyay Borborah',
        role: 'user'
      })
    });

    const backendData = await backendRes.json();
    console.log("Backend response:", JSON.stringify(backendData, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
}

run();
