import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiX, FiUpload, FiTrash2 } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { editVehicleSchema } from '../utils/schemas'
import { updateVehicle, uploadVehicleImages } from '../firebase/firestoreService'

export default function EditVehicleModal({ vehicle, onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(editVehicleSchema),
    defaultValues: {
      name: vehicle.name || '',
      type: vehicle.type || 'bike',
      vehicleNumber: vehicle.vehicleNumber || '',
      pricePerHour: vehicle.pricePerHour || '',
      pricePerDay: vehicle.pricePerDay || '',
      location: vehicle.location || '',
      description: vehicle.description || '',
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [existingImages, setExistingImages] = useState(vehicle.images || [])
  const [newFiles, setNewFiles] = useState([])

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data) => {
    setSubmitting(true)
    const toastId = toast.loading('Updating vehicle...')
    try {
      let allImages = [...existingImages]

      // Upload new images if any
      if (newFiles.length > 0) {
        const newUrls = await uploadVehicleImages(vehicle._id, newFiles)
        allImages = [...allImages, ...newUrls]
      }

      await updateVehicle(vehicle._id, {
        ...data,
        images: allImages,
      })

      toast.success('Vehicle updated successfully!', { id: toastId })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error('Failed to update vehicle: ' + err.message, { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Edit Vehicle</h2>
          <button onClick={onClose} className="btn-ghost p-2"><FiX /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label" htmlFor="edit-name">Vehicle name</label>
            <input id="edit-name" className="input-field" {...register('name')} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="edit-type">Type</label>
              <select id="edit-type" className="input-field" {...register('type')}>
                <option value="bike">Bike</option>
                <option value="scooty">Scooty</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="edit-vnum">Vehicle Number</label>
              <input id="edit-vnum" className="input-field" placeholder="AS-06-XX-1234" {...register('vehicleNumber')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="edit-pph">Price/hour (₹)</label>
              <input id="edit-pph" type="number" className="input-field" {...register('pricePerHour')} />
              {errors.pricePerHour && <p className="text-red-400 text-xs mt-1">{errors.pricePerHour.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="edit-ppd">Price/day (₹)</label>
              <input id="edit-ppd" type="number" className="input-field" {...register('pricePerDay')} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="edit-location">Pickup location</label>
            <input id="edit-location" className="input-field" {...register('location')} />
            {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="edit-desc">Description</label>
            <textarea id="edit-desc" rows={3} className="input-field resize-none" {...register('description')} />
          </div>

          {/* Existing images */}
          {existingImages.length > 0 && (
            <div>
              <label className="label">Current Photos</label>
              <div className="grid grid-cols-3 gap-2">
                {existingImages.map((url, i) => (
                  <div key={i} className="relative group aspect-video rounded-lg overflow-hidden bg-surface-2">
                    {url.startsWith('http') ? (
                      <img src={url} alt={`Vehicle ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">{url}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <FiTrash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload new images */}
          <div>
            <label className="label">Add Photos</label>
            <label
              htmlFor="edit-images"
              className="flex flex-col items-center gap-2 border-2 border-dashed border-white/10 rounded-xl p-5 cursor-pointer hover:border-white/20 bg-surface-2 transition text-center"
            >
              <FiUpload className="text-white/30 text-xl" />
              <span className="text-sm text-white/40">
                {newFiles.length > 0 ? `${newFiles.length} new file(s) selected` : 'Upload additional photos'}
              </span>
              <input
                id="edit-images"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setNewFiles(Array.from(e.target.files))}
              />
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
