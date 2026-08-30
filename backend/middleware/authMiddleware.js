import { adminAuth } from '../config/firebaseAdmin.js'
import User from '../models/User.js'

export const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token provided.' })
  }

  const idToken = authHeader.split('Bearer ')[1]

  // Developer E2E Integration test bypass
  if (process.env.NODE_ENV !== 'production' && idToken.startsWith('mock-')) {
    let email = `${idToken}@lupu.test`
    let role = 'user'
    let isOwner = false

    if (idToken.startsWith('mock-admin-')) {
      const uid = idToken.split('mock-admin-')[1]
      email = uid === 'dasstranger' || uid === 'jAML2Id2PDc74UxehU68nSVB1SZ2' ? 'dasstranger421@gmail.com' : (uid === 'fakeadmin' ? 'fakeadmin@example.com' : `${idToken}@lupu.test`)
      role = (email.toLowerCase() === 'dasstranger421@gmail.com') ? 'admin' : 'user'
      isOwner = true
    } else if (idToken.startsWith('mock-owner-')) {
      email = 'owner@lupu.test'
      role = 'owner'
      isOwner = true
    } else if (idToken.startsWith('mock-renter-')) {
      email = 'renter@lupu.test'
      role = 'user'
      isOwner = false
    }

    req.firebaseUser = { uid: idToken, email, email_verified: true, name: role === 'admin' ? 'Stranger Admin' : 'E2E Tester' }
    
    if (email.toLowerCase() === 'dasstranger421@gmail.com') {
      let adminUser = await User.findOne({ email: 'dasstranger421@gmail.com' })
      if (adminUser) {
        adminUser.role = 'admin'
        adminUser.status = 'active'
        adminUser.isSuspended = false
        req.user = adminUser
        return next()
      }
    }

    // For other test bypass tokens, attach transient mock user without polluting database
    req.user = {
      _id: 'mock-transient-' + role,
      firebaseUid: idToken,
      email,
      name: role === 'owner' ? 'Owner User' : 'Test User',
      role,
      isOwner,
      isRider: true,
      status: 'active',
      isSuspended: false,
      emailVerified: true
    }
    return next()
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    req.firebaseUser = decodedToken
    
    // Check if the Firebase UID already exists in MongoDB
    let user = await User.findOne({ firebaseUid: decodedToken.uid })
    
    if (!user && decodedToken.email) {
      // Case-insensitive fallback check by email
      const emailRegex = new RegExp(`^${decodedToken.email.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i')
      user = await User.findOne({ email: emailRegex })
      if (user) {
        user.firebaseUid = decodedToken.uid
        if (decodedToken.email_verified) user.emailVerified = true
        await user.save()
      }
    }

    if (!user && decodedToken.uid) {
      try {
        // Auto-create MongoDB user profile if missing
        user = await User.create({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || `${decodedToken.uid}@lupu.in`,
          name: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'LUPU User'),
          role: 'user',
          isRider: true,
          isOwner: true,
          emailVerified: !!decodedToken.email_verified,
          lastLogin: new Date()
        })
      } catch (createErr) {
        if (createErr.code === 11000 && decodedToken.email) {
          // If duplicate key error, fetch by email and link firebaseUid
          const emailRegex = new RegExp(`^${decodedToken.email.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i')
          user = await User.findOne({ email: emailRegex })
          if (user) {
            user.firebaseUid = decodedToken.uid
            if (decodedToken.email_verified) user.emailVerified = true
            await user.save()
          }
        } else {
          throw createErr
        }
      }
    }
    
    if (user) {
      const isSoleAdmin = user.email?.toLowerCase() === 'dasstranger421@gmail.com'
      if (isSoleAdmin) {
        if (user.role !== 'admin') {
          user.role = 'admin'
          user.isOwner = true
          user.isRider = true
          await user.save()
        }
      } else {
        if (['admin', 'super_admin', 'founder'].includes(user.role)) {
          user.role = user.isOwner ? 'owner' : 'user'
          await user.save()
        }
      }
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
