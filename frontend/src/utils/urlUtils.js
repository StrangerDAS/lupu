/**
 * Utility to reliably resolve image URLs from the backend.
 *
 * Supports three URL types:
 *  1. Cloudinary URLs (res.cloudinary.com) — passed through as-is or with transformations
 *  2. Firebase Storage URLs (firebasestorage.googleapis.com) — passed through as-is
 *  3. Local disk paths (/uploads/...) — prepended with backend base URL
 *
 * Legacy Firebase and local /uploads/ images continue to work unchanged.
 */
import { isCloudinaryUrl, cloudinaryCardUrl, cloudinaryDetailUrl, cloudinaryThumbUrl } from './cloudinaryImageUrl.js'

/**
 * Resolve an image URL to a displayable src value.
 *
 * @param {string} path  - URL, Cloudinary URL, or local path
 * @param {'card'|'detail'|'thumb'|'raw'} size - Cloudinary transform preset (ignored for non-Cloudinary)
 * @returns {string}
 */
export const getImageUrl = (path, size = 'raw') => {
  if (!path) return ''

  // ── Cloudinary URLs ───────────────────────────────────────────────────────
  if (isCloudinaryUrl(path)) {
    if (size === 'card') return cloudinaryCardUrl(path)
    if (size === 'detail') return cloudinaryDetailUrl(path)
    if (size === 'thumb') return cloudinaryThumbUrl(path)
    // For raw HEIC/HEIF images, convert extension to .jpg so browsers render them natively
    if (path.match(/\.(heic|heif)$/i)) {
      return path.replace(/\.(heic|heif)$/i, '.jpg')
    }
    return path // 'raw' — return as-is (used for direct preview)
  }

  // ── Firebase Storage, external CDN, or any other http(s) URL ─────────────
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // ── Local /uploads/ path — prepend backend host ───────────────────────────
  const apiBase = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) || 'http://localhost:5001/api'
  let host = apiBase.replace(/\/api\/?$/, '')
  if (!host && typeof window !== 'undefined') {
    host = window.location.origin
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${host}${normalizedPath}`
}
