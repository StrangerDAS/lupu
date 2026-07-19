import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FiX, FiUploadCloud, FiTrash2 } from 'react-icons/fi'
import { getImageUrl } from '../utils/urlUtils'
import toast from 'react-hot-toast'
import { editVehicleSchema } from '../utils/schemas'
import { vehicleAPI } from '../api/endpoints'

export default function EditVehicleModal({ vehicle, onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(editVehicleSchema),
    defaultValues: {
      name: vehicle.name || '',
      brand: vehicle.brand || '',
      model: vehicle.model || '',
      type: vehicle.type || 'bike',
      registrationNumber: vehicle.registrationNumber || '',
      pricePerHour: vehicle.pricePerHour || '',
      pricePerDay: vehicle.pricePerDay || '',
      securityDeposit: vehicle.securityDeposit || '',
      location: vehicle.location || '',
      description: vehicle.description || '',
      year: vehicle.specs?.year || '',
      fuel: vehicle.specs?.fuel || 'Petrol',
      transmission: vehicle.specs?.transmission || 'Manual',
      helmetAvailable: !!vehicle.helmetAvailable,
    },
  })

  const [submitting, setSubmitting] = useState(false)
  const [existingImages, setExistingImages] = useState(vehicle.photos || vehicle.images || [])
  const [newFiles, setNewFiles] = useState([])
  const [rcFile, setRcFile] = useState(null)
  const [insFile, setInsFile] = useState(null)
  const [pucFile, setPucFile] = useState(null)

  const removeExistingImage = (index) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data) => {
    setSubmitting(true)
    const toastId = toast.loading('Updating vehicle...')
    try {
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('brand', data.brand)
      formData.append('model', data.model)
      formData.append('type', data.type)
      formData.append('registrationNumber', data.registrationNumber)
      formData.append('pricePerHour', data.pricePerHour)
      formData.append('pricePerDay', data.pricePerDay || 0)
      formData.append('securityDeposit', data.securityDeposit || 0)
      formData.append('location', data.location)
      formData.append('description', data.description)
      formData.append('year', data.year)
      formData.append('fuel', data.fuel)
      formData.append('transmission', data.transmission)
      formData.append('helmetAvailable', data.helmetAvailable ? 'true' : 'false')

      // If editing a rejected/under_review vehicle, submit it back for review
      if (vehicle.verificationStatus === 'rejected' || vehicle.verificationStatus === 'draft') {
        formData.append('verificationStatus', 'submitted')
      } else {
        formData.append('verificationStatus', vehicle.verificationStatus || 'submitted')
      }

      if (rcFile) formData.append('RC', rcFile)
      if (insFile) formData.append('Insurance', insFile)
      if (pucFile) formData.append('PUC', pucFile)

      // Append existing photos we decided to keep
      existingImages.forEach(img => {
        formData.append('photos', img)
      })

      // Append new photos upload
      newFiles.forEach(file => {
        formData.append('photos', file)
      })

      await vehicleAPI.update(vehicle._id || vehicle.id, formData)

      toast.success('Vehicle updated successfully!', { id: toastId })
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || 'Failed to update vehicle', { id: toastId })
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
        className="relative card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10 bg-[#111111] border border-white/10"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Edit Vehicle</h2>
          <button onClick={onClose} className="btn-ghost p-2"><FiX /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vehicle Name</label>
              <input className="input-field" placeholder="e.g. Cruiser 350" {...register('name')} />
              {errors.name && <p className="text-red-400 text-[10px] mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Brand</label>
              <input className="input-field" placeholder="e.g. Royal Enfield" {...register('brand')} />
              {errors.brand && <p className="text-red-400 text-[10px] mt-1">{errors.brand.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Model</label>
              <input className="input-field" placeholder="e.g. Classic 350" {...register('model')} />
              {errors.model && <p className="text-red-400 text-[10px] mt-1">{errors.model.message}</p>}
            </div>
            <div>
              <label className="label">Registration Number</label>
              <input className="input-field" placeholder="AS-06-K-1234" {...register('registrationNumber')} />
              {errors.registrationNumber && <p className="text-red-400 text-[10px] mt-1">{errors.registrationNumber.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input-field" {...register('type')}>
                <option value="bike">Bike</option>
                <option value="scooty">Scooty</option>
              </select>
            </div>
            <div>
              <label className="label">Year</label>
              <input type="number" className="input-field" placeholder="2022" {...register('year')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price/Hour (₹)</label>
              <input type="number" className="input-field" placeholder="80" {...register('pricePerHour')} />
              {errors.pricePerHour && <p className="text-red-400 text-[10px] mt-1">{errors.pricePerHour.message}</p>}
            </div>
            <div>
              <label className="label">Price/Day (₹)</label>
              <input type="number" className="input-field" placeholder="500" {...register('pricePerDay')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Security Deposit (₹)</label>
              <input type="number" className="input-field" placeholder="1000" {...register('securityDeposit')} />
            </div>
            <div>
              <label className="label">Pickup Location</label>
              <input className="input-field" placeholder="AT Road, Dibrugarh" {...register('location')} />
              {errors.location && <p className="text-red-400 text-[10px] mt-1">{errors.location.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fuel Type</label>
              <input className="input-field" placeholder="Petrol" {...register('fuel')} />
            </div>
            <div>
              <label className="label">Transmission</label>
              <select className="input-field" {...register('transmission')}>
                <option value="Manual">Manual</option>
                <option value="Automatic">Automatic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="edit-desc">Description</label>
            <textarea id="edit-desc" rows={3} className="input-field resize-none p-2" placeholder="Describe condition of ride..." {...register('description')} />
            {errors.description && <p className="text-red-400 text-[10px] mt-1">{errors.description.message}</p>}
          </div>

          <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/5 rounded-xl">
            <input type="checkbox" id="edit-helmet" className="w-4 h-4 rounded accent-brand" {...register('helmetAvailable')} />
            <label htmlFor="edit-helmet" className="text-white/80 font-medium">Helmet Available with ride</label>
          </div>

          {/* Current Documents list */}
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
            <div className="font-semibold text-white/50 text-[10px] uppercase">Verify Current Documents</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-black/30 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[9px] font-bold">RC CARD</span>
                {vehicle.documents?.RC ? (
                  <a href={getImageUrl(vehicle.documents.RC)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-semibold text-[10px]">View Current</a>
                ) : (
                  <span className="text-red-400 font-semibold text-[10px]">Missing</span>
                )}
              </div>
              <div className="text-center bg-black/30 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[9px] font-bold">INSURANCE</span>
                {vehicle.documents?.Insurance ? (
                  <a href={getImageUrl(vehicle.documents.Insurance)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-semibold text-[10px]">View Current</a>
                ) : (
                  <span className="text-red-400 font-semibold text-[10px]">Missing</span>
                )}
              </div>
              <div className="text-center bg-black/30 p-2 rounded-lg border border-white/5">
                <span className="text-white/40 block text-[9px] font-bold">PUC CARD</span>
                {vehicle.documents?.PUC ? (
                  <a href={getImageUrl(vehicle.documents.PUC)} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline font-semibold text-[10px]">View Current</a>
                ) : (
                  <span className="text-red-400 font-semibold text-[10px]">Missing</span>
                )}
              </div>
            </div>
          </div>

          {/* Re-upload document options */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-white/70">Update Compliance Documents (PDF / Images)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Registration (RC)</label>
                <input type="file" accept="image/*,.pdf" className="input-field p-1 text-[10px]" onChange={(e) => setRcFile(e.target.files[0])} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Insurance Policy</label>
                <input type="file" accept="image/*,.pdf" className="input-field p-1 text-[10px]" onChange={(e) => setInsFile(e.target.files[0])} />
              </div>
              <div>
                <label className="text-[10px] text-white/40 block mb-1">Pollution (PUC)</label>
                <input type="file" accept="image/*,.pdf" className="input-field p-1 text-[10px]" onChange={(e) => setPucFile(e.target.files[0])} />
              </div>
            </div>
          </div>

          {/* Existing images */}
          {existingImages.length > 0 && (
            <div>
              <label className="label">Current Photos</label>
              <div className="grid grid-cols-3 gap-2">
                {existingImages.map((url, i) => (
                  <div key={i} className="relative group aspect-video rounded-lg overflow-hidden bg-surface-2 border border-white/5">
                    <img src={getImageUrl(url)} alt={`Vehicle ${i + 1}`} className="w-full h-full object-cover" />
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

          {/* Upload new photos */}
          <div>
            <label className="label">Add Photos</label>
            <label
              htmlFor="edit-images"
              className="flex flex-col items-center gap-1.5 border-2 border-dashed border-white/10 rounded-xl p-4 cursor-pointer hover:border-white/20 bg-surface-2 transition text-center"
            >
              <FiUpload className="text-white/30 text-lg" />
              <span className="text-xs text-white/40">
                {newFiles.length > 0 ? `${newFiles.length} new photo(s) selected` : 'Upload additional photos'}
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

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
