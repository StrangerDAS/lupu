import { adminAuth } from '../config/firebaseAdmin.js'
import User from '../models/User.js'

export const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token provided.' })
  }

  const idToken = authHeader.split('Bearer ')[1]

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    req.firebaseUser = decodedToken
    
    // Check if the Firebase UID already exists in MongoDB
    let user = await User.findOne({ firebaseUid: decodedToken.uid })
    
    if (!user && decodedToken.email) {
      // Fallback check by email (for migrating existing users)
      user = await User.findOne({ email: decodedToken.email })
    }
    
    if (user) {
      req.user = user
    }
    
    next()
  } catch (error) {
    console.error('Firebase token verification error:', error)
    return res.status(401).json({ message: 'Invalid or expired authentication token.' })
  }
}

// Middleware to require MongoDB user profile (for routes that need more than just a verified email)
export const requireMongoUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User profile not found. Please log in again.' })
  }
  next()
}
