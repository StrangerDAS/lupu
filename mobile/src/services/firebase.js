import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// LUPU Firebase Configuration (uniride-9be37)
export const firebaseConfig = {
  apiKey: "AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o",
  authDomain: "uniride-9be37.firebaseapp.com",
  databaseURL: "https://uniride-9be37-default-rtdb.firebaseio.com",
  projectId: "uniride-9be37",
  storageBucket: "uniride-9be37.firebasestorage.app",
  messagingSenderId: "760677444428",
  appId: "1:760677444428:web:a419f39fd2dc273cbbfde9",
  measurementId: "G-PKEVRXK33G"
};

// Initialize Firebase App (prevent duplicate app creation)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with React Native AsyncStorage persistence
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
};
