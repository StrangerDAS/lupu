import { useState, useEffect } from 'react'
import { getPlatformSettings, updatePlatformSettings } from '../../firebase/firestoreService'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function CommissionView() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    commissionPercentage: 15,
    serviceFee: 50,
    cancellationFee: 100,
    lateFee: 200,
    gstPercentage: 18,
    refundRules: ''
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await getPlatformSettings()
        if (res) setSettings(res)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      await updatePlatformSettings(settings, user._id, user.name)
      toast.success('Commission & Platform parameters updated successfully!')
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-white/40 text-xs">Fetching Platform settings config...</div>
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Commission & Billing Engine</h2>
        <p className="text-white/40 text-xs">Founder parameters for commission rates, fees, taxes, and refunds.</p>
      </div>

      <form onSubmit={handleSave} className="glass p-6 border border-white/5 rounded-2xl space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/50 block">Platform Commission (%)</label>
            <input
              type="number"
              value={settings.commissionPercentage}
              onChange={(e) => setSettings({ ...settings, commissionPercentage: Number(e.target.value) })}
              className="input-field py-2 text-xs"
              min="0"
              max="100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/50 block">GST Surcharge (%)</label>
            <input
              type="number"
              value={settings.gstPercentage}
              onChange={(e) => setSettings({ ...settings, gstPercentage: Number(e.target.value) })}
              className="input-field py-2 text-xs"
              min="0"
              max="100"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/50 block">Service Fee (₹)</label>
            <input
              type="number"
              value={settings.serviceFee}
              onChange={(e) => setSettings({ ...settings, serviceFee: Number(e.target.value) })}
              className="input-field py-2 text-xs"
              min="0"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/50 block">Cancellation Fee (₹)</label>
            <input
              type="number"
              value={settings.cancellationFee}
              onChange={(e) => setSettings({ ...settings, cancellationFee: Number(e.target.value) })}
              className="input-field py-2 text-xs"
              min="0"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-white/50 block">Late Fee / Hr (₹)</label>
            <input
              type="number"
              value={settings.lateFee}
              onChange={(e) => setSettings({ ...settings, lateFee: Number(e.target.value) })}
              className="input-field py-2 text-xs"
              min="0"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-white/50 block">Cancellation & Refund Rules Description</label>
          <textarea
            value={settings.refundRules}
            onChange={(e) => setSettings({ ...settings, refundRules: e.target.value })}
            className="input-field text-xs h-24 resize-none p-2.5"
            placeholder="Document standard refund structures..."
          />
        </div>

        <button type="submit" className="btn-primary w-full py-2.5 rounded-xl text-xs font-semibold">
          Commit System Parameters
        </button>
      </form>
    </div>
  )
}
