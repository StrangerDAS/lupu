import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Firebase configuration for LUPU.
 *
 * SECURITY: All credentials MUST come from environment variables.
 * No hardcoded fallback values — the app will fail to start if env vars are missing
 * rather than silently exposing credentials in the JS bundle.
 *
 * Firebase Auth is used for user authentication.
 * Firebase Firestore: used for real-time features (notifications, reviews, etc.)
 * Firebase Storage: used for user file uploads (avatars, KYC docs, vehicle photos)
 *
 * Migration roadmap: Firestore → MongoDB in Sprint 3.
 */

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate required config in development to catch missing env vars early
if (import.meta.env.DEV) {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    console.warn(
      `[Firebase] ⚠️ Missing env vars: ${missing.join(', ')}\n` +
      '  Copy frontend/.env.example to frontend/.env and fill in the values.'
    )
  }
}

const app = initializeApp(firebaseConfig);

// Firestore — real-time data (notifications, reviews, favorites, etc.)
export const db = getFirestore(app);

// Storage — user file uploads
export const storage = getStorage(app);

// NOTE: Auth logic is in src/firebase.js
