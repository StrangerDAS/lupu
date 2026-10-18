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
export async function resizeImageForUpload(file, maxDim = 1920, quality = 0.85) {
  if (!file.type.startsWith('image/')) return file

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
 * Request a signed upload credential from the LUPU backend.
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
 * Upload a single image directly to Cloudinary using a pre-obtained signature.
 * Image binary goes directly from browser → Cloudinary (bypasses LUPU server).
 *
 * @param {Blob|File} imageBlob
 * @param {{ signature, timestamp, cloudName, apiKey, folder, publicId, tags }} sigParams
 * @param {{ onProgress?: (pct: number) => void }} options
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export async function uploadToCloudinaryDirect(imageBlob, sigParams, { onProgress } = {}) {
  const { signature, timestamp, cloudName, apiKey, folder, publicId, tags } = sigParams

  const formData = new FormData()
  formData.append('file', imageBlob)
  formData.append('api_key', apiKey)
  formData.append('timestamp', timestamp)
  formData.append('signature', signature)
  formData.append('folder', folder)
  formData.append('public_id', publicId)
  if (tags) formData.append('tags', tags)

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

/**
 * Upload a single vehicle photo with resize + signature request + direct upload.
 * Designed to be called with controlled concurrency (see uploadVehiclePhotos).
 *
 * @param {File} file
 * @param {string} vehicleId
 * @param {number} photoIndex
 * @param {{ onProgress?: (pct: number) => void }} options
 * @returns {Promise<{ secure_url: string, public_id: string, file: File }>}
 */
export async function uploadSingleVehiclePhoto(file, vehicleId, photoIndex, { onProgress } = {}) {
  // Step 1: Single-pass client-side resize (fast, no sequential compression)
  const resized = await resizeImageForUpload(file, 1920, 0.85)
  onProgress?.(5) // resize done

  // Step 2: Get signed params from backend
  const sigParams = await requestUploadSignature(vehicleId, photoIndex)
  onProgress?.(10) // signature acquired

  // Step 3: Upload directly to Cloudinary
  const result = await uploadToCloudinaryDirect(resized, sigParams, {
    onProgress: (pct) => {
      // Map 10–100 range to the remaining 90%
      onProgress?.(10 + Math.round(pct * 0.9))
    },
  })

  return { ...result, file }
}

/**
 * Upload multiple vehicle photos with bounded concurrency (default: 3 at a time).
 * Each photo gets individual progress tracking.
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
    concurrency = 3,
    onPhotoProgress,
    onPhotoComplete,
    onPhotoError,
  } = options

  const results = Array(files.length).fill(null)
  const queue = files.map((file, index) => ({ file, index }))
  const active = new Set()

  return new Promise((resolve) => {
    function runNext() {
      while (active.size < concurrency && queue.length > 0) {
        const { file, index } = queue.shift()
        active.add(index)

        uploadSingleVehiclePhoto(file, vehicleId, index, {
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
