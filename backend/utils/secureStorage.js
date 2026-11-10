import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import { cloudinary, ensureCloudinaryConfigured } from './cloudinaryConfig.js'

/**
 * Secure Identity Document Storage & Short-Lived Signed URL Manager
 * 
 * - Handles private storage for sensitive documents (Aadhaar, Student ID, DL, Selfies).
 * - Generates 15-minute maximum TTL signed URLs.
 * - Protects local fallbacks using HMAC-SHA256 time-limited tokens.
 * - Integrates with Cloudinary authenticated resources.
 */

export const SECURE_UPLOAD_DIR = './secure-uploads'
export const SIGNED_URL_TTL_SECONDS = 15 * 60 // 15 minutes (900 seconds)

// Ensure secure-uploads directory exists and is restricted
if (!fs.existsSync(SECURE_UPLOAD_DIR)) {
  fs.mkdirSync(SECURE_UPLOAD_DIR, { recursive: true, mode: 0o700 })
}

const SIGNING_SECRET = process.env.DOCUMENT_SIGNING_SECRET || process.env.JWT_SECRET || 'lupu-secure-identity-storage-signing-secret-2026'

/**
 * Generates an HMAC-SHA256 signature for a file path and expiry timestamp.
 */
export function generateDocumentToken(relativeFilePath, expiresAtTimestamp) {
  const payload = `${relativeFilePath}:${expiresAtTimestamp}`
  return crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex')
}

/**
 * Verifies if a given token is valid and not expired for the specified file path.
 */
export function verifyDocumentToken(relativeFilePath, expiresAtTimestamp, token) {
  if (!relativeFilePath || !expiresAtTimestamp || !token) return false
  const now = Math.floor(Date.now() / 1000)
  if (now > parseInt(expiresAtTimestamp, 10)) {
    return false // Expired
  }
  const expectedToken = generateDocumentToken(relativeFilePath, expiresAtTimestamp)
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expectedToken, 'hex'))
  } catch (_) {
    return false
  }
}

/**
 * Generates a short-lived signed access URL for an identity document asset.
 * Max TTL: 15 minutes (900 seconds).
 *
 * @param {string} assetUrlOrPath - The stored URL or relative file path
 * @param {number} ttlSeconds - Expiration time in seconds (capped at 900)
 * @returns {string|null} - Signed access URL
 */
export function generateSecureDocumentUrl(assetUrlOrPath, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  if (!assetUrlOrPath || typeof assetUrlOrPath !== 'string') return null

  const effectiveTtl = Math.min(Math.max(1, parseInt(ttlSeconds, 10) || SIGNED_URL_TTL_SECONDS), SIGNED_URL_TTL_SECONDS)
  const expiresAt = Math.floor(Date.now() / 1000) + effectiveTtl

  // Case 1: Cloudinary authenticated resource URL
  if (assetUrlOrPath.includes('cloudinary.com') || assetUrlOrPath.startsWith('lupu/')) {
    try {
      ensureCloudinaryConfigured()
      // Extract public_id
      let publicId = assetUrlOrPath
      if (assetUrlOrPath.includes('res.cloudinary.com')) {
        const match = assetUrlOrPath.match(/\/image\/(?:upload|authenticated)\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i)
        if (match) publicId = match[1]
      }
      // Generate signed Cloudinary URL with expiration
      return cloudinary.utils.url(publicId, {
        type: 'authenticated',
        sign_url: true,
        expires_at: expiresAt,
        secure: true,
      })
    } catch (err) {
      // If Cloudinary credentials are not active, fall back to tokenized proxy
      console.warn('[SecureStorage] Cloudinary signed URL generation fallback:', err.message)
    }
  }

  // Case 2: Local storage file (either /uploads/xxx or /secure-uploads/xxx or relative filename)
  let cleanPath = assetUrlOrPath.replace(/^\/+/, '')
  const token = generateDocumentToken(cleanPath, expiresAt)

  return `/api/admin/verifications/secure-file?path=${encodeURIComponent(cleanPath)}&expires=${expiresAt}&token=${token}`
}

/**
 * Resolves a requested file path safely, preventing directory traversal.
 * Only files inside SECURE_UPLOAD_DIR or UPLOAD_DIR are permitted.
 */
export function resolveSecureFilePath(requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') return null

  // Clean path to prevent null byte injection and directory traversal
  const normalized = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '')
  const fileName = path.basename(normalized)

  // Try in secure-uploads first
  const securePath = path.resolve(SECURE_UPLOAD_DIR, fileName)
  if (fs.existsSync(securePath)) {
    return securePath
  }

  // Try in standard uploads as legacy fallback
  const uploadsPath = path.resolve('./uploads', fileName)
  if (fs.existsSync(uploadsPath)) {
    return uploadsPath
  }

  return null
}
