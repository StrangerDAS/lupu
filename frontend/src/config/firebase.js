import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase project: uniride-9be37
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "uniride-9be37.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://uniride-9be37-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "uniride-9be37",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "uniride-9be37.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "760677444428",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:760677444428:web:a419f39fd2dc273cbbfde9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PKEVRXK33G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
