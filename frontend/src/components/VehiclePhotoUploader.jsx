/**
 * VehiclePhotoUploader — Rich photo upload UI for LUPU vehicle listings.
 *
 * Features:
 *  - Immediate local thumbnail preview on selection (no waiting for upload)
 *  - Single-pass canvas resize before upload (fast, no sequential compression)
 *  - Controlled concurrency (3 at a time)
 *  - Individual progress bar per image
 *  - Individual retry for failed images
 *  - Duplicate file detection (by name+size)
 *  - Never freezes the listing form
 *  - Uploads directly to Cloudinary (image binary bypasses LUPU server)
 *
 * Props:
 *  - vehicleId {string}     — vehicle ID or temp ID for Cloudinary folder
 *  - onChange   {function}  — called with array of { secure_url, public_id } on every completion
 *  - maxPhotos  {number}    — default 10
 *  - minPhotos  {number}    — default 3
 *  - disabled   {boolean}
 */
import { useState, useRef, useCallback } from 'react'
import { FiUploadCloud, FiX, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { uploadSingleVehiclePhoto } from '../utils/cloudinaryUpload'

const STATUS = {
  PENDING: 'pending',
  RESIZING: 'resizing',
  UPLOADING: 'uploading',
  DONE: 'done',
  ERROR: 'error',
}

const MAX_FILE_SIZE_MB = 25
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const CONCURRENCY = 3

export default function VehiclePhotoUploader({
  vehicleId,
  onChange,
  maxPhotos = 10,
  minPhotos = 3,
  disabled = false,
  className = '',
}) {
  const [photos, setPhotos] = useState([]) // Array of photo state objects
  const fileInputRef = useRef(null)
  const uploadQueueRef = useRef([]) // pending indexes to upload
  const activeUploadsRef = useRef(0) // current active upload count
  const photosRef = useRef([]) // ref mirror to avoid stale closure issues

  // Keep ref in sync
  photosRef.current = photos

  // Notify parent whenever completed photos change
  const notifyParent = useCallback((updatedPhotos) => {
    const completed = updatedPhotos
      .filter(p => p.status === STATUS.DONE && p.secure_url)
      .map(p => ({ secure_url: p.secure_url, public_id: p.public_id }))
    onChange?.(completed)
  }, [onChange])

  const updatePhoto = useCallback((id, patch) => {
    setPhotos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p)
      notifyParent(next)
      return next
    })
  }, [notifyParent])

  const startUpload = useCallback(async (photoQueueItem) => {
    activeUploadsRef.current++
    const { id: photoId, file, index } = photoQueueItem

    updatePhoto(photoId, { status: STATUS.RESIZING, progress: 0 })

    try {
      const result = await uploadSingleVehiclePhoto(
        file,
        vehicleId || `tmp_${Date.now()}`,
        index,
        {
          onProgress: (pct) => {
            updatePhoto(photoId, {
              status: pct < 10 ? STATUS.RESIZING : STATUS.UPLOADING,
              progress: pct,
            })
          },
        }
      )
      updatePhoto(photoId, {
        status: STATUS.DONE,
        progress: 100,
        secure_url: result.secure_url,
        public_id: result.public_id,
      })
    } catch (err) {
      console.error('[VehiclePhotoUploader] Upload failed:', err.message)
      updatePhoto(photoId, { status: STATUS.ERROR, progress: 0, errorMsg: err.message })
    } finally {
      activeUploadsRef.current--
      drainQueue()
    }
  }, [vehicleId, updatePhoto])

  function drainQueue() {
    while (activeUploadsRef.current < CONCURRENCY && uploadQueueRef.current.length > 0) {
      const nextItem = uploadQueueRef.current.shift()
      startUpload(nextItem)
    }
  }

  const handleFilesSelected = useCallback((files) => {
    if (disabled) return
    const currentCount = photosRef.current.length
    const remaining = maxPhotos - currentCount
    if (remaining <= 0) return

    const existingKeys = new Set(photosRef.current.map(p => `${p.file.name}_${p.file.size}`))
    const newFiles = []

    for (const file of files) {
      if (newFiles.length + currentCount >= maxPhotos) break

      // Duplicate check
      const key = `${file.name}_${file.size}`
      if (existingKeys.has(key)) continue

      // Type check
      const type = file.type.toLowerCase()
      if (!ALLOWED_TYPES.some(t => type === t || type.startsWith('image/'))) continue

      // Size check
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) continue

      existingKeys.add(key)
      newFiles.push(file)
    }

    if (newFiles.length === 0) return

    const newPhotoObjects = newFiles.map((file, i) => ({
      id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      index: currentCount + i,
      file,
      previewUrl: URL.createObjectURL(file),
      status: STATUS.PENDING,
      progress: 0,
      secure_url: null,
      public_id: null,
      errorMsg: null,
    }))

    setPhotos(prev => {
      const next = [...prev, ...newPhotoObjects]
      return next
    })

    // Queue uploads
    for (const photo of newPhotoObjects) {
      uploadQueueRef.current.push({ id: photo.id, file: photo.file, index: photo.index })
    }
    drainQueue()
  }, [disabled, maxPhotos, startUpload])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    if (disabled) return
    handleFilesSelected(Array.from(e.dataTransfer.files))
  }, [disabled, handleFilesSelected])

  const handleInputChange = (e) => {
    handleFilesSelected(Array.from(e.target.files))
    e.target.value = '' // reset so same file can be re-added after retry
  }

  const removePhoto = (id) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id)
      if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl)
      const next = prev.filter(p => p.id !== id)
      // Re-index remaining photos
      notifyParent(next)
      return next
    })
  }

  const retryPhoto = (id) => {
    updatePhoto(id, { status: STATUS.PENDING, progress: 0, errorMsg: null })
    uploadQueueRef.current.unshift(id)
    drainQueue()
  }

  const doneCount = photos.filter(p => p.status === STATUS.DONE).length
  const errorCount = photos.filter(p => p.status === STATUS.ERROR).length
  const uploadingCount = photos.filter(p => p.status === STATUS.UPLOADING || p.status === STATUS.RESIZING).length
  const canAddMore = photos.length < maxPhotos && !disabled

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Drop zone */}
      {canAddMore && (
        <label
          htmlFor="cloudinary-photo-input"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center gap-2 border-2 border-dashed border-white/15 rounded-xl p-5 cursor-pointer hover:border-brand/40 hover:bg-brand/5 bg-surface-2 transition-all text-center select-none"
        >
          <FiUploadCloud className="text-white/30 text-2xl" />
          <div className="text-xs text-white/50">
            <span className="text-white/70 font-medium">Click to select</span> or drag &amp; drop
          </div>
          <div className="text-[10px] text-white/30">
            JPEG · PNG · WEBP · up to {MAX_FILE_SIZE_MB}MB · max {maxPhotos} photos
          </div>
          <input
            ref={fileInputRef}
            id="cloudinary-photo-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleInputChange}
            disabled={disabled}
          />
        </label>
      )}

      {/* Status summary */}
      {photos.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-white/50">
          <span>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
          {doneCount > 0 && <span className="text-green-400">✓ {doneCount} ready</span>}
          {uploadingCount > 0 && <span className="text-brand animate-pulse">↑ uploading {uploadingCount}</span>}
          {errorCount > 0 && <span className="text-red-400">⚠ {errorCount} failed</span>}
          {doneCount < minPhotos && (
            <span className="text-yellow-400">min {minPhotos} required</span>
          )}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-surface-2 border border-white/5"
            >
              {/* Thumbnail */}
              <img
                src={photo.previewUrl}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              {/* Overlay for in-progress */}
              {(photo.status === STATUS.RESIZING || photo.status === STATUS.UPLOADING) && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                  <div className="w-3/4 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand transition-all duration-200 rounded-full"
                      style={{ width: `${photo.progress}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-white/60">
                    {photo.status === STATUS.RESIZING ? 'Resizing…' : `${photo.progress}%`}
                  </span>
                </div>
              )}

              {/* Done checkmark */}
              {photo.status === STATUS.DONE && (
                <div className="absolute bottom-1 right-1 bg-green-500 rounded-full p-0.5">
                  <FiCheck size={9} className="text-white" />
                </div>
              )}

              {/* Error overlay */}
              {photo.status === STATUS.ERROR && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1 px-1">
                  <FiAlertCircle className="text-red-400 text-sm" />
                  <span className="text-[8px] text-red-300 text-center line-clamp-2">{photo.errorMsg || 'Failed'}</span>
                  <button
                    type="button"
                    onClick={() => retryPhoto(photo.id)}
                    className="flex items-center gap-0.5 text-[9px] text-brand hover:text-brand/80 mt-0.5"
                  >
                    <FiRefreshCw size={9} /> Retry
                  </button>
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute top-1 left-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
              >
                <FiX size={10} />
              </button>

              {/* Index badge */}
              <span className="absolute top-1 right-1 bg-black/50 text-white/60 text-[8px] rounded px-1 opacity-0 group-hover:opacity-100 transition">
                #{i + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
