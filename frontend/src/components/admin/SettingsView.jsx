import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSettings, FiSliders, FiServer, FiLock, FiGlobe, FiDatabase, FiMail, FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'

export default function SettingsView() {
  const [loading, setLoading] = useState(false)
  const [platformSettings, setPlatformSettings] = useState({
    maintenanceMode: false,
    restrictNewSignups: false,
    sessionTimeoutHours: 168, // 7 days default
    allowThirdPartyLogins: true,
    requireKycForRenting: true,
    requireKycForListing: true,
    emailGateway: 'smtp.sendgrid.net',
    supportEmail: 'support@lupu.in',
    backupFrequency: 'daily', // daily | weekly | monthly
    enableDatabaseAuditLogs: true,
  })

  const handleToggle = (key) => {
    setPlatformSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Simulate database write
    await new Promise(resolve => setTimeout(resolve, 800))
    setLoading(false)
    toast.success('System configuration parameters saved successfully!')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">System Administration Settings</h2>
        <p className="text-white/40 text-xs">Configure LUPU platform parameters, security policies, and integrations.</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Core Operations Settings */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass p-6 border border-white/5 rounded-2xl space-y-5">
            <h3 className="font-bold text-sm flex items-center gap-1.5 border-b border-white/5 pb-2">
              <FiSliders className="text-brand" /> Operation Toggles
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">System Maintenance Mode</h4>
                  <p className="text-[10px] text-white/40">Offline access for all users except developers & founders.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('maintenanceMode')}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                    platformSettings.maintenanceMode ? 'bg-red-500' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      platformSettings.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Restrict New User Registrations</h4>
                  <p className="text-[10px] text-white/40">Disable public signups. Only administrative profiles can add users.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('restrictNewSignups')}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                    platformSettings.restrictNewSignups ? 'bg-brand' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      platformSettings.restrictNewSignups ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Require KYC verification for Renting</h4>
                  <p className="text-[10px] text-white/40">Users must verify Aadhaar/License documents before placing bookings.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('requireKycForRenting')}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                    platformSettings.requireKycForRenting ? 'bg-green-500' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      platformSettings.requireKycForRenting ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Require KYC verification for Listing</h4>
                  <p className="text-[10px] text-white/40">Owners must verify Aadhaar/License documents before listing vehicles.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('requireKycForListing')}
                  className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                    platformSettings.requireKycForListing ? 'bg-green-500' : 'bg-white/10'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                      platformSettings.requireKycForListing ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Integration Configurations */}
          <div className="glass p-6 border border-white/5 rounded-2xl space-y-5">
            <h3 className="font-bold text-sm flex items-center gap-1.5 border-b border-white/5 pb-2">
              <FiServer className="text-brand" /> Server & Gateways
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-white/50 block">Email SMTP Gateway Host</label>
                <input
                  type="text"
                  value={platformSettings.emailGateway}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, emailGateway: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-white/50 block">System Notification Support Email</label>
                <input
                  type="email"
                  value={platformSettings.supportEmail}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, supportEmail: e.target.value })}
                  className="input-field py-2 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-white/50 block">Zustand & JWT Session Expiry (Hours)</label>
                <input
                  type="number"
                  value={platformSettings.sessionTimeoutHours}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, sessionTimeoutHours: Number(e.target.value) })}
                  className="input-field py-2 text-xs"
                  min="1"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-white/50 block">Database Backup Frequency</label>
                <select
                  value={platformSettings.backupFrequency}
                  onChange={(e) => setPlatformSettings({ ...platformSettings, backupFrequency: e.target.value })}
                  className="input-field py-2 text-xs bg-surface-2 text-white"
                >
                  <option value="daily">Daily Backup Schedule</option>
                  <option value="weekly">Weekly Backup Schedule</option>
                  <option value="monthly">Monthly Backup Schedule</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info & Save Button */}
        <div className="space-y-6">
          <div className="glass p-6 border border-white/5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-1.5 border-b border-white/5 pb-2">
              <FiLock className="text-brand" /> Security Profile
            </h3>
            <p className="text-[10px] text-white/40 leading-normal">
              Changing system parameters alters the platform security profile. All configuration changes are recorded in the Audit Logs trace.
            </p>
            <div className="space-y-2 text-[10px] text-white/70">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Encryption standard:</span>
                <span className="font-bold text-green-400">AES-256 GCM</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>SSL state:</span>
                <span className="font-bold text-green-400">Enforced HTTPS</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Database nodes:</span>
                <span className="font-bold text-white">Firestore Production</span>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 rounded-xl text-xs font-semibold flex justify-center items-center gap-1.5 mt-2"
            >
              {loading ? (
                <>
                  <FiRefreshCw className="animate-spin text-sm" />
                  <span>Committing...</span>
                </>
              ) : (
                <span>Commit System Config</span>
              )}
            </button>
          </div>

          <div className="glass p-6 border border-white/5 rounded-2xl text-center space-y-3">
            <FiDatabase className="mx-auto text-brand text-2xl" />
            <h4 className="font-bold text-xs">Backup Management</h4>
            <p className="text-[10px] text-white/40 leading-normal">
              Perform an immediate on-demand backup of all Firestore collections.
            </p>
            <button
              type="button"
              onClick={() => toast.success('Immediate database backup routine scheduled in background.')}
              className="w-full py-2 border border-white/10 hover:bg-white/5 transition rounded-xl text-[10px] font-semibold"
            >
              Trigger Backup Now
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}
