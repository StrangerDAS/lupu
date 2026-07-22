import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o",
  authDomain: "uniride-9be37.firebaseapp.com",
  projectId: "uniride-9be37",
  storageBucket: "uniride-9be37.firebasestorage.app",
  messagingSenderId: "760677444428",
  appId: "1:760677444428:web:a419f39fd2dc273cbbfde9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
