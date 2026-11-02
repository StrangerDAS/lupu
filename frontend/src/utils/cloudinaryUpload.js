/**
 * cloudinaryUpload.js — LUPU Cloudinary Direct Upload Utility
 *
 * Architecture:
 *  1. Frontend requests a short-lived signed upload signature from LUPU backend.
 *  2. Frontend uploads image DIRECTLY to Cloudinary REST API.
 *  3. No image binary passes through the Node/Render server.
 *  4. Returns { secure_url, public_id } for storage in MongoDB via backend.
 *
 * Security:
 *  - Cloudinary API Secret is NEVER present in the frontend bundle.
 *  - Each signature is vehicle-scoped and expires after Cloudinary's window (~1 hr).
 *  - Cloud name is the only Cloudinary credential in the frontend.
 */

import api from '../api/axiosInstance'

const CLOUDINARY_UPLOAD_URL = (cloudName) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`

/**
 * Resize a File/Blob using a canvas so uploads stay fast even for 12–20MP phone shots.
 * Single-pass resize — no expensive sequential compression library.
 *
 * @param {File} file  - original file
 * @param {number} maxDim - max dimension in px (default 1920)
 * @param {number} quality - JPEG quality 0–1 (default 0.85)
 * @returns {Promise<Blob>}
 */
/**
 * Resize a File/Blob using canvas/createImageBitmap so uploads stay fast even for 12–48MP mobile shots.
 * Optimized target: 1440px max dimension, quality 0.78.
 * Yields ~75% smaller files with crisp retina fidelity, dramatically reducing mobile upload time.
 *
 * @param {File} file  - original file
 * @param {number} maxDim - max dimension in px (default 1440)
 * @param {number} quality - JPEG quality 0–1 (default 0.78)
 * @returns {Promise<Blob>}
 */
export async function resizeImageForUpload(file, maxDim = 1440, quality = 0.78) {
  const isImageMime = file.type && file.type.startsWith('image/')
  const isImageExt = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')
  if (!isImageMime && !isImageExt) return file

  // Fast path: use createImageBitmap if available (hardware-accelerated, handles EXIF orientation)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      let { width, height } = bitmap

      if (width <= maxDim && height <= maxDim) {
        bitmap.close?.()
        return file
      }

      if (width > height) {
        height = Math.round((height * maxDim) / width)
        width = maxDim
      } else {
        width = Math.round((width * maxDim) / height)
        height = maxDim
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0, width, height)
      bitmap.close?.()

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
      if (blob) return blob
    } catch (_) {
      // Fallback to Image() below if createImageBitmap fails (e.g. certain formats)
    }
  }

  // Standard Image() fallback
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img

      // Skip resize if already small enough
      if (width <= maxDim && height <= maxDim) {
        resolve(file)
        return
      }

      if (width > height) {
        height = Math.round((height * maxDim) / width)
        width = maxDim
      } else {
        width = Math.round((width * maxDim) / height)
        height = maxDim
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas resize failed')); return }
          resolve(blob)
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/**
 * Request a single signed upload credential from the LUPU backend.
 *
 * @param {string} vehicleId
 * @param {number} photoIndex
 * @returns {Promise<{signature, timestamp, cloudName, apiKey, folder, publicId, tags}>}
 */
export async function requestUploadSignature(vehicleId, photoIndex) {
  const { data } = await api.post('/vehicles/upload-signature', { vehicleId, photoIndex })
  return data
}

/**
 * Request batch signed upload credentials from the LUPU backend in a SINGLE round-trip.
 * Cuts mobile latency by eliminating N separate network handshakes.
 *
 * @param {string} vehicleId
 * @param {number} count
 * @returns {Promise<Array<{signature, timestamp, cloudName, apiKey, folder, publicId, tags, photoIndex}>>}
 */
export async function requestBatchUploadSignatures(vehicleId, count) {
  try {
    const { data } = await api.post('/vehicles/upload-signature', { vehicleId, count })
    if (data?.signatures && Array.isArray(data.signatures)) {
      return data.signatures
    }
    return [data]
  } catch (err) {
    console.warn('[CloudinaryUpload] Batch signature request failed, falling back to per-item signature:', err.message)
    return null
  }
}

/**
 * Upload a single image directly to Cloudinary using a pre-obtained signature.
 * Includes automatic retry with backoff on transient network interruptions.
 *
 * @param {Blob|File} imageBlob
 * @param {{ signature, timestamp, cloudName, apiKey, folder, publicId, tags }} sigParams
 * @param {{ onProgress?: (pct: number) => void, retryCount?: number }} options
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadToCloudinaryDirect(imageBlob, sigParams, { onProgress, retryCount = 1 } = {}) {
  const { signature, timestamp, cloudName, apiKey, folder, publicId, tags } = sigParams

  const formData = new FormData()
  formData.append('file', imageBlob)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp)
  formData.append('signature', signature)
  formData.append('folder', folder)
  formData.append('public_id', publicId)
  if (tags) formData.append('tags', tags)

  function attemptUpload() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', CLOUDINARY_UPLOAD_URL(cloudName))

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText)
          resolve({ secure_url: data.secure_url, public_id: data.public_id })
        } else {
          let errMsg = `Cloudinary upload failed (HTTP ${xhr.status})`
          try {
            const errData = JSON.parse(xhr.responseText)
            errMsg = errData?.error?.message || errMsg
          } catch (_) {}
          reject(new Error(errMsg))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'))
      xhr.ontimeout = () => reject(new Error('Cloudinary upload timed out'))
      xhr.timeout = 120_000 // 2 minutes
      xhr.send(formData)
    })
  }

  try {
    return await attemptUpload()
  } catch (err) {
    if (retryCount > 0) {
      console.warn('[CloudinaryUpload] Retrying upload after transient error:', err.message)
      await new Promise(r => setTimeout(r, 1500))
      return uploadToCloudinaryDirect(imageBlob, sigParams, { onProgress, retryCount: retryCount - 1 })
    }
    throw err
  }
}

/**
 * Upload a single vehicle photo with resize + signature request + direct upload.
 *
 * @param {File} file
 * @param {string} vehicleId
 * @param {number} photoIndex
 * @param {{ onProgress?: (pct: number) => void, sigParams?: object }} options
 * @returns {Promise<{ secure_url: string, public_id: string, file: File }>}
 */
export async function uploadSingleVehiclePhoto(file, vehicleId, photoIndex, { onProgress, sigParams: preloadedSig } = {}) {
  // Step 1: Client-side resize (1440px / 0.78 quality — fast, low memory)
  const resized = await resizeImageForUpload(file, 1440, 0.78)
  onProgress?.(8) // resize complete

  // Step 2: Get signed params (use preloaded batch signature if available)
  const sigParams = preloadedSig || await requestUploadSignature(vehicleId, photoIndex)
  onProgress?.(15) // signature acquired

  // Step 3: Upload directly to Cloudinary
  const result = await uploadToCloudinaryDirect(resized, sigParams, {
    onProgress: (pct) => {
      // Map 15–100 range to remaining 85%
      onProgress?.(15 + Math.round(pct * 0.85))
    },
  })

  return { ...result, file }
}

/**
 * Upload multiple vehicle photos with bounded concurrency (default: 2 for mobile network stability).
 *
 * @param {File[]} files
 * @param {string} vehicleId
 * @param {{
 *   concurrency?: number,
 *   onPhotoProgress?: (index: number, pct: number) => void,
 *   onPhotoComplete?: (index: number, result: { secure_url, public_id }) => void,
 *   onPhotoError?: (index: number, error: Error) => void,
 * }} options
 * @returns {Promise<Array<{ index: number, secure_url?: string, public_id?: string, error?: Error }>>}
 */
export async function uploadVehiclePhotos(files, vehicleId, options = {}) {
  const {
    concurrency = 2,
    onPhotoProgress,
    onPhotoComplete,
    onPhotoError,
  } = options

  // Pre-fetch batch signatures in a single network round-trip
  const batchSigs = await requestBatchUploadSignatures(vehicleId, files.length)

  const results = Array(files.length).fill(null)
  const queue = files.map((file, index) => ({
    file,
    index,
    sig: batchSigs?.[index] || null,
  }))
  const active = new Set()

  return new Promise((resolve) => {
    function runNext() {
      while (active.size < concurrency && queue.length > 0) {
        const { file, index, sig } = queue.shift()
        active.add(index)

        uploadSingleVehiclePhoto(file, vehicleId, index, {
          sigParams: sig,
          onProgress: (pct) => onPhotoProgress?.(index, pct),
        })
          .then((result) => {
            results[index] = { index, secure_url: result.secure_url, public_id: result.public_id }
            onPhotoComplete?.(index, result)
          })
          .catch((err) => {
            results[index] = { index, error: err }
            onPhotoError?.(index, err)
          })
          .finally(() => {
            active.delete(index)
            if (queue.length > 0) {
              runNext()
            } else if (active.size === 0) {
              resolve(results)
            }
          })
      }
    }
    runNext()
  })
}
