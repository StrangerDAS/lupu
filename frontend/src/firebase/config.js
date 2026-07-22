import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Re-use the already-initialized Firebase app from the single source of truth.
// Do NOT call initializeApp() here — that would create a duplicate app error.
import { auth } from "../config/firebase";

const app = auth.app;

// Firestore — real-time data (notifications, reviews, favorites, etc.)
export const db = getFirestore(app);

// Storage — user file uploads
export const storage = getStorage(app);
