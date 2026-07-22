import admin from 'firebase-admin'

if (!admin.apps.length) {
  // If FIREBASE_SERVICE_ACCOUNT is provided in .env as a JSON string, use it.
  // Otherwise, default to application default credentials (useful for GCP environments)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://uniride-9be37-default-rtdb.firebaseio.com"
      })
      console.log('Firebase Admin initialized with service account JSON.')
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', error)
      process.exit(1)
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT is missing. Initializing Firebase Admin with default credentials. Make sure GOOGLE_APPLICATION_CREDENTIALS is set.')
    admin.initializeApp({
      databaseURL: "https://uniride-9be37-default-rtdb.firebaseio.com"
    })
  }
}

export default admin
