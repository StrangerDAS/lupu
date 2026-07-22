import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// Only initialize once (guard for hot-reload environments)
if (!getApps().length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: 'https://uniride-9be37-default-rtdb.firebaseio.com'
      })
      console.log('[Firebase Admin] ✅ Initialized with service account.')
    } catch (error) {
      console.error('[Firebase Admin] ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT:', error.message)
      process.exit(1)
    }
  } else {
    console.warn('[Firebase Admin] ⚠️  FIREBASE_SERVICE_ACCOUNT not set — using default credentials.')
    initializeApp({
      databaseURL: 'https://uniride-9be37-default-rtdb.firebaseio.com'
    })
  }
}

export const adminAuth = getAuth()
export default { auth: () => getAuth() }
