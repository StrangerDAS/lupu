import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase project: lupu-9fbcd
const firebaseConfig = {
  apiKey: "AIzaSyC6SGYmPBYZ2tEsYLRTwmAYPSDP5h9qLOM",
  authDomain: "lupu-9fbcd.firebaseapp.com",
  projectId: "lupu-9fbcd",
  storageBucket: "lupu-9fbcd.firebasestorage.app",
  messagingSenderId: "540230115580",
  appId: "1:540230115580:web:c2f73c8893edc39284f779",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
