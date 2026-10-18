/**
 * cloudinaryImageUrl.js — Cloudinary CDN URL builder for LUPU
 *
 * Generates optimised Cloudinary delivery URLs with automatic format,
 * quality, and dimension transformations.
 *
 * Cloud name is read from VITE_CLOUDINARY_CLOUD_NAME (never a secret).
 *
 * Supports:
 *  - Explore card: ~500px wide
 *  - Vehicle detail hero: ~1200px wide
 *  - Gallery thumbnail: ~150px wide
 *  - Automatic format (WebP/AVIF where supported)
 *  - Automatic quality
 */

const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_CLOUDINARY_CLOUD_NAME) || 'z4rpaq6q'
const CDN_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`

/**
 * Returns true if the URL is a Cloudinary URL for this cloud.
 * @param {string} url
 */
export function isCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return false
  return url.includes('res.cloudinary.com') || url.includes(`cloudinary.com/${CLOUD_NAME}`)
}

/**
 * Build a Cloudinary transformation URL from a secure_url or public_id.
 *
 * @param {string} urlOrPublicId - Either a full Cloudinary secure_url or a public_id string
 * @param {string[]} transforms - Array of Cloudinary transformation strings
 * @returns {string}
 */
function buildCloudinaryUrl(urlOrPublicId, transforms) {
  if (!urlOrPublicId) return ''

  // If it's a full Cloudinary URL, extract the upload path and rebuild with transforms
  if (urlOrPublicId.startsWith('http') && urlOrPublicId.includes('/image/upload/')) {
    // Insert transforms after /image/upload/
    const parts = urlOrPublicId.split('/image/upload/')
    const rest = parts[1] || ''
    // Strip leading version segment (v12345678/) if present
    const withoutVersion = rest.replace(/^v\d+\//, '')
    const tfStr = transforms.join(',')
    return `${CDN_BASE}/${tfStr}/${withoutVersion}`
  }

  // Treat as public_id directly
  const tfStr = transforms.join(',')
  return `${CDN_BASE}/${tfStr}/${urlOrPublicId}`
}

/**
 * Explore / listing card image — optimized ~500px, auto format & quality.
 * @param {string} urlOrId
 */
export function cloudinaryCardUrl(urlOrId) {
  return buildCloudinaryUrl(urlOrId, ['f_auto', 'q_auto', 'w_500', 'c_fill', 'g_auto'])
}

/**
 * Vehicle detail hero image — optimized ~1200px, auto format & quality.
 * @param {string} urlOrId
 */
export function cloudinaryDetailUrl(urlOrId) {
  return buildCloudinaryUrl(urlOrId, ['f_auto', 'q_auto', 'w_1200', 'c_limit'])
}

/**
 * Gallery thumbnail — optimized ~150px square, auto format & quality.
 * @param {string} urlOrId
 */
export function cloudinaryThumbUrl(urlOrId) {
  return buildCloudinaryUrl(urlOrId, ['f_auto', 'q_auto', 'w_150', 'h_150', 'c_fill', 'g_auto'])
}

/**
 * Universal smart URL builder.
 * - If the input is a Cloudinary URL/public_id, apply requested transformation.
 * - Otherwise, fall through (returns input untouched for Firebase/local URLs).
 *
 * @param {string} urlOrId
 * @param {'card'|'detail'|'thumb'} size
 * @returns {string}
 */
export function getCloudinaryUrl(urlOrId, size = 'card') {
  if (!urlOrId) return ''
  if (!isCloudinaryUrl(urlOrId) && !urlOrId.startsWith('lupu/')) return urlOrId

  switch (size) {
    case 'detail': return cloudinaryDetailUrl(urlOrId)
    case 'thumb': return cloudinaryThumbUrl(urlOrId)
    case 'card':
    default: return cloudinaryCardUrl(urlOrId)
  }
}

/**
 * Extract the Cloudinary public_id from a secure_url.
 * Returns null if the URL is not a Cloudinary URL.
 * @param {string} url
 * @returns {string|null}
 */
export function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i)
  return match ? match[1] : null
}
