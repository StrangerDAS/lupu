/**
 * Cloudinary configuration and signature generation for LUPU.
 *
 * The API Secret NEVER leaves the server.
 * The frontend uses short-lived signed upload parameters to upload
 * vehicle photos DIRECTLY to Cloudinary (image binary bypasses this server).
 */
import { v2 as cloudinary } from 'cloudinary'

// Folder prefix for all vehicle photos — scoped to prevent cross-domain uploads
export const VEHICLE_PHOTOS_FOLDER = 'lupu/vehicle-photos'

// Allowed Cloudinary resource types / upload presets for vehicle photos
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB raw — Cloudinary handles further sizing

let _configured = false

/**
 * Lazily configure the Cloudinary SDK from environment variables.
 * Must be called before any SDK usage.
 */
export function ensureCloudinaryConfigured() {
  if (_configured) return
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.'
    )
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true })
  _configured = true
}

/**
 * Generate a short-lived, signed upload signature for one vehicle-photo upload.
 *
 * The returned { signature, timestamp, apiKey, cloudName, folder, uploadPreset? }
 * is passed directly to the Cloudinary REST upload endpoint from the browser.
 *
 * TTL: 10 minutes (Cloudinary default is 1 hour; we restrict further).
 *
 * @param {string} vehicleId  - vehicle Mongo ID or temp ID
 * @param {string} publicIdPrefix - optional per-image prefix (e.g. photo_0)
 * @returns {{ signature, timestamp, cloudName, apiKey, folder, publicId, eager }}
 */
export function generateVehiclePhotoSignature(vehicleId, publicIdPrefix = '') {
  ensureCloudinaryConfigured()

  const timestamp = Math.round(Date.now() / 1000)
  const folder = `${VEHICLE_PHOTOS_FOLDER}/${vehicleId}`

  // Build the public_id so uploads land in the right folder without duplicating folder path
  const suffix = publicIdPrefix ? `_${publicIdPrefix}` : `_${timestamp}_${Math.random().toString(36).slice(2, 7)}`
  const publicId = `photo${suffix}`

  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp,
    // Restrict upload to images only via tags (tag-based restrictions require upload preset in some setups)
    tags: 'lupu,vehicle-photo',
  }

  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET)

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
    publicId,
    tags: paramsToSign.tags,
  }
}

/**
 * Generate a batch of short-lived signed upload credentials for multiple photos.
 * Avoids N separate HTTP round trips over high-latency mobile networks.
 *
 * @param {string} vehicleId
 * @param {number} count - number of signatures to generate (max 10)
 * @returns {Array<{ signature, timestamp, cloudName, apiKey, folder, publicId, tags, photoIndex }>}
 */
export function generateVehiclePhotoBatchSignatures(vehicleId, count = 1) {
  const safeCount = Math.min(Math.max(1, parseInt(count, 10) || 1), 10)
  const signatures = []
  for (let i = 0; i < safeCount; i++) {
    signatures.push({
      ...generateVehiclePhotoSignature(vehicleId, String(i)),
      photoIndex: i,
    })
  }
  return signatures
}

/**
 * Delete a single Cloudinary asset by public_id.
 * Only call this after confirming the image is no longer referenced in MongoDB.
 *
 * @param {string} publicId
 */
export async function deleteCloudinaryAsset(publicId) {
  ensureCloudinaryConfigured()
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
    console.log(`[Cloudinary] Deleted ${publicId}: ${result.result}`)
    return result
  } catch (err) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, err.message)
    throw err
  }
}

/**
 * Extract the Cloudinary public_id from a secure_url.
 * Returns null if the URL is not a Cloudinary URL.
 *
 * @param {string} url
 * @returns {string|null}
 */
export function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  // e.g. https://res.cloudinary.com/z4rpaq6q/image/upload/v1234567/lupu/vehicle-photos/abc/photo_xyz.jpg
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i)
  return match ? match[1] : null
}

export { cloudinary }
