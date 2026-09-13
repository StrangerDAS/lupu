/**
 * OwnerSettings.jsx
 *
 * Full production-quality Account Control Center for LUPU.
 * Replaces the "Coming Soon" placeholder in the Owner Dashboard → Settings tab.
 *
 * Reuses: auth store, userAPI, paymentAPI, authAPI, Firebase logout,
 *         LUPU design system (card, btn-primary, input-field, badge, brand tokens)
 *
 * Security: All identity derived from authenticated req.user._id on backend.
 *           Role, admin status, verification — server-controlled, read-only here.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiUser, FiMail, FiPhone, FiShield, FiBell, FiSettings,
  FiLogOut, FiTrash2, FiCheckCircle, FiXCircle, FiClock,
  FiEdit2, FiSave, FiX, FiChevronRight, FiExternalLink,
  FiAlertTriangle, FiLock, FiFileText, FiInfo, FiDollarSign,
  FiCamera, FiCheck
} from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { userAPI, paymentAPI, authAPI } from '../api/endpoints'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/config'

/* ─── Settings navigation definition ────────────────────── */

const SETTINGS_NAV = [
  {
    group: 'ACCOUNT',
    items: [
      { key: 'profile',      label: 'Profile',           icon: FiUser },
      { key: 'verification', label: 'Verification',      icon: FiShield },
    ],
  },
  {
    group: 'PREFERENCES',
    items: [
      { key: 'notifications',       label: 'Notifications',      icon: FiBell },
      { key: 'rental-preferences',  label: 'Rental Preferences', icon: FiDollarSign, ownerOnly: true },
    ],
  },
  {
    group: 'SECURITY & PRIVACY',
    items: [
      { key: 'security', label: 'Security',       icon: FiLock },
      { key: 'privacy',  label: 'Privacy & Data', icon: FiFileText },
    ],
  },
  {
    group: 'LEGAL',
    items: [
      { key: 'legal', label: 'Legal', icon: FiFileText },
    ],
  },
  {
    group: 'ACCOUNT ACTIONS',
    items: [
      { key: 'logout',  label: 'Log Out',        icon: FiLogOut,  danger: true },
      { key: 'delete',  label: 'Delete Account', icon: FiTrash2,  danger: true },
    ],
  },
]

/* ─── Shared UI helpers ─────────────────────────────────── */

function SectionCard({ children, className = '' }) {
  return <div className={`card p-6 ${className}`}>{children}</div>
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center">
          <Icon className="text-brand text-base" />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {subtitle && <p className="text-white/40 text-sm ml-11">{subtitle}</p>}
    </div>
  )
}

function StatusPill({ verified, pending, label }) {
  if (verified) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
        <FiCheckCircle className="text-sm" /> {label || 'Verified'}
      </span>
    )
  }
  if (pending) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full">
        <FiClock className="text-sm" /> {label || 'Pending'}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-white/30 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
      <FiXCircle className="text-sm" /> {label || 'Not Verified'}
    </span>
  )
}

function FieldRow({ label, value, action }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-white/40 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-white truncate">{value || '—'}</p>
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`toggle-switch ${checked ? 'toggle-switch--on' : 'toggle-switch--off'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      aria-checked={checked}
      role="switch"
    >
      <div className="toggle-switch__knob" />
    </button>
  )
}

function NotifRow({ label, prefKey, prefs, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/70">{label}</span>
      <ToggleSwitch
        checked={prefs[prefKey] !== false}
        onChange={(val) => onChange(prefKey, val)}
        disabled={disabled}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN SETTINGS COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function OwnerSettings() {
  const { user, updateUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')
  const [mobileOpen, setMobileOpen] = useState(false)

  // Re-sync user profile from backend on mount
  useEffect(() => {
    const sync = async () => {
      try {
        const { data } = await authAPI.me()
        const userObj = data.user || data
        updateUser(userObj)
      } catch (_) {}
    }
    sync()
  }, [updateUser])

  const handleNavSelect = (key) => {
    setActiveSection(key)
    setMobileOpen(false)
  }

  const isOwnerAccount = user?.isOwner || user?.role === 'owner' || user?.role === 'admin'

  // Filter nav items by role
  const visibleNav = SETTINGS_NAV.map(group => ({
    ...group,
    items: group.items.filter(item => !item.ownerOnly || isOwnerAccount),
  })).filter(g => g.items.length > 0)

  const flatItems = SETTINGS_NAV.flatMap(g => g.items)
  const activeItem = flatItems.find(i => i.key === activeSection)
  const ActiveIcon = activeItem?.icon || FiSettings

  return (
    <div className="flex flex-col md:flex-row gap-6">

      {/* ── Mobile section picker ──────────────────────────── */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full card p-4 flex items-center justify-between text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <ActiveIcon className="text-brand" />
            {activeItem?.label || 'Settings'}
          </span>
          <FiChevronRight className={`transition-transform ${mobileOpen ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card mt-2 overflow-hidden"
            >
              {visibleNav.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] font-semibold tracking-widest text-white/20 uppercase px-4 pt-4 pb-1">
                    {group.group}
                  </p>
                  {group.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => handleNavSelect(item.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                        activeSection === item.key
                          ? 'bg-brand/10 text-brand'
                          : item.danger
                            ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/5'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className="text-base shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Desktop sidebar ──────────────────────────────── */}
      <aside className="hidden md:block w-56 shrink-0">
        <nav className="bg-surface rounded-2xl border border-white/5 overflow-hidden sticky top-24">
          {visibleNav.map((group, gi) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold tracking-widest text-white/20 uppercase px-5 pt-4 pb-1">
                {group.group}
              </p>
              {group.items.map(item => (
                <button
                  key={item.key}
                  onClick={() => handleNavSelect(item.key)}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-all relative ${
                    activeSection === item.key
                      ? 'bg-brand/10 text-brand border-l-2 border-brand'
                      : item.danger
                        ? 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5 border-l-2 border-transparent'
                        : 'text-white/50 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                  }`}
                >
                  <item.icon className="text-base shrink-0" />
                  {item.label}
                </button>
              ))}
              {gi < visibleNav.length - 1 && (
                <div className="mx-4 border-t border-white/5 my-1" />
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Content area ────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'profile'            && <ProfileSection user={user} updateUser={updateUser} isOwnerAccount={isOwnerAccount} />}
            {activeSection === 'verification'       && <VerificationSection user={user} />}
            {activeSection === 'notifications'      && <NotificationsSection user={user} updateUser={updateUser} />}
            {activeSection === 'rental-preferences' && <RentalPreferencesSection />}
            {activeSection === 'security'           && <SecuritySection user={user} />}
            {activeSection === 'privacy'            && <PrivacySection />}
            {activeSection === 'legal'              && <LegalSection />}
            {activeSection === 'logout'             && <LogoutSection logout={logout} navigate={navigate} />}
            {activeSection === 'delete'             && <DeleteSection user={user} logout={logout} navigate={navigate} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   PROFILE SECTION
   ═══════════════════════════════════════════════════════════ */

function ProfileSection({ user, updateUser, isOwnerAccount }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef()

  const [form, setForm] = useState({ name: '', college: '', address: '' })

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        college: user.college || '',
        address: user.address || '',
      })
    }
  }, [user])

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploadingAvatar(true)
    try {
      const storageRef = ref(storage, `avatars/${user._id || Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      const fd = new FormData()
      fd.append('avatar', url)
      const { data } = await userAPI.updateProfile(fd)
      updateUser(data.user || data)
      toast.success('Profile photo updated')
    } catch (_) {
      try {
        const fd = new FormData()
        fd.append('avatar', file)
        const { data } = await userAPI.updateProfile(fd)
        updateUser(data.user || data)
        toast.success('Profile photo updated')
      } catch (err2) {
        toast.error('Failed to upload photo')
      }
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('college', form.college || '')
      fd.append('address', form.address || '')
      const { data } = await userAPI.updateProfile(fd)
      updateUser(data.user || data)
      toast.success('Profile updated ✓')
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({ name: user?.name || '', college: user?.college || '', address: user?.address || '' })
    setEditing(false)
  }

  const avatarSrc = user?.avatar
    ? (user.avatar.startsWith('http') ? user.avatar : `${(import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace('/api', '')}${user.avatar}`)
    : null

  const initials = (user?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel = user?.role === 'admin' ? 'Admin' : isOwnerAccount ? 'Owner' : 'Renter'
  const roleColor = user?.role === 'admin'
    ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
    : isOwnerAccount
      ? 'text-brand bg-brand/10 border-brand/20'
      : 'text-blue-400 bg-blue-500/10 border-blue-500/20'

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiUser} title="Profile" subtitle="Your personal information and account identity" />

        {/* Avatar + identity */}
        <div className="flex items-center gap-5 mb-8 pb-6 border-b border-white/5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-surface-2 border border-white/10 flex items-center justify-center">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <span className="text-2xl font-bold text-white/40">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-brand rounded-lg flex items-center justify-center hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
              title="Change profile photo"
            >
              {uploadingAvatar
                ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <FiCamera className="text-white text-xs" />
              }
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div>
            <h3 className="text-xl font-bold">{user?.name || '—'}</h3>
            <span className={`badge border text-xs mt-1.5 ${roleColor}`}>{roleLabel}</span>
            {user?.status === 'active' && (
              <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                <FiCheckCircle className="text-xs" /> Active Account
              </p>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-0">
          {/* Name */}
          <div className="flex items-start justify-between py-3.5 border-b border-white/5">
            <div className="min-w-0 flex-1 mr-4">
              <p className="text-xs text-white/40 mb-1">Full Name</p>
              {editing ? (
                <input
                  className="input-field text-sm py-2 mt-1"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  maxLength={80}
                />
              ) : (
                <p className="text-sm font-medium">{user?.name || '—'}</p>
              )}
            </div>
          </div>

          {/* Email — read-only */}
          <FieldRow
            label="Email Address"
            value={user?.email}
            action={<StatusPill verified={user?.emailVerified} label={user?.emailVerified ? 'Verified' : 'Unverified'} />}
          />

          {/* Phone — with inline edit */}
          <div className="py-3.5 border-b border-white/5">
            <PhoneEditRow user={user} updateUser={updateUser} />
          </div>

          {/* College */}
          <div className="flex items-start py-3.5 border-b border-white/5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/40 mb-1">College / Institution</p>
              {editing ? (
                <input
                  className="input-field text-sm py-2 mt-1"
                  value={form.college}
                  onChange={e => setForm(f => ({ ...f, college: e.target.value }))}
                  placeholder="e.g. BITS Pilani, VIT Vellore"
                  maxLength={120}
                />
              ) : (
                <p className="text-sm font-medium">{user?.college || '—'}</p>
              )}
            </div>
          </div>

          {/* Account type — read-only */}
          <FieldRow label="Account Type" value={roleLabel} />

          {/* Status */}
          <FieldRow
            label="Account Status"
            value={null}
            action={
              <span className={`badge text-xs border ${
                user?.status === 'active'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {user?.status || 'active'}
              </span>
            }
          />
        </div>

        {/* Edit/Save buttons */}
        <div className="flex items-center gap-3 mt-6">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-sm py-2.5 px-5"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  : <><FiSave /> Save Changes</>
                }
              </button>
              <button onClick={handleCancel} disabled={saving} className="btn-secondary text-sm py-2.5">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2 text-sm py-2.5">
              <FiEdit2 /> Edit Profile
            </button>
          )}
        </div>
      </SectionCard>

      {/* Read-only notice */}
      <div className="bg-surface-2 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
        <FiInfo className="text-white/30 text-base mt-0.5 shrink-0" />
        <p className="text-xs text-white/30 leading-relaxed">
          Account role, verification status, Firebase UID, and admin permissions are managed by LUPU and cannot be changed here.
        </p>
      </div>
    </div>
  )
}

/* ─── Phone edit inline row ─────────────────────────────── */

function PhoneEditRow({ user, updateUser }) {
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneVal, setPhoneVal] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  const startEdit = () => {
    setPhoneVal(user?.phone ? String(user.phone).replace(/^\+91/, '').replace(/\s/g, '') : '')
    setEditingPhone(true)
  }

  const handleSave = async () => {
    setSavingPhone(true)
    try {
      const { data } = await userAPI.updatePhone(phoneVal.trim())
      if (data.user) updateUser(data.user)
      toast.success(data.message || 'Phone number updated')
      setEditingPhone(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update phone number')
    } finally {
      setSavingPhone(false)
    }
  }

  if (editingPhone) {
    return (
      <div>
        <p className="text-xs text-white/40 mb-2">Phone Number</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">+91</span>
            <input
              className="input-field text-sm py-2.5 pl-10"
              value={phoneVal}
              onChange={e => setPhoneVal(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit number"
              inputMode="numeric"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={savingPhone || phoneVal.length !== 10}
            className="btn-primary py-2.5 px-3.5"
          >
            {savingPhone
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <FiCheck />
            }
          </button>
          <button onClick={() => setEditingPhone(false)} className="btn-ghost py-2.5 px-3">
            <FiX />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-1">Phone Number</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-medium">{user?.phone || 'Not added'}</p>
          {user?.phone && (
            <StatusPill
              verified={user.phoneVerified}
              label={user.phoneVerified ? 'Verified' : 'Unverified'}
            />
          )}
        </div>
        <button onClick={startEdit} className="text-xs text-brand hover:text-brand-light transition-colors font-medium">
          {user?.phone ? 'Change' : 'Add phone'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   VERIFICATION SECTION
   ═══════════════════════════════════════════════════════════ */

function VerificationSection({ user, updateUser, isOwner }) {
  const kycStatus = (user?.kycStatus || 'unsubmitted').toLowerCase()
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [docType, setDocType] = useState('driving_license') // 'driving_license' | 'aadhaar' | 'pan' | 'college_id'
  const [docNumber, setDocNumber] = useState('')
  const [files, setFiles] = useState({ front: null, back: null, selfie: null })
  const [previews, setPreviews] = useState({ front: '', back: '', selfie: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = (key, file) => {
    if (!file) return
    setFiles(prev => ({ ...prev, [key]: file }))
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviews(prev => ({ ...prev, [key]: reader.result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitKyc = async (e) => {
    e.preventDefault()
    if (!files.front && !docNumber) {
      return toast.error('Please upload at least one document image or enter your document ID number.')
    }

    setSubmitting(true)
    const toastId = toast.loading('Submitting verification documents...')
    try {
      const formData = new FormData()
      formData.append('kycType', docType)

      if (docType === 'driving_license') {
        if (docNumber) formData.append('drivingLicenseNumber', docNumber)
        if (files.front) formData.append('drivingLicense', files.front)
        if (files.back) formData.append('document', files.back)
      } else if (docType === 'aadhaar') {
        if (docNumber) formData.append('aadhaarNumber', docNumber)
        if (files.front) formData.append('aadhaarFront', files.front)
        if (files.back) formData.append('aadhaarBack', files.back)
      } else if (docType === 'pan') {
        if (docNumber) formData.append('panNumber', docNumber)
        if (files.front) formData.append('pan', files.front)
      } else if (docType === 'college_id') {
        if (docNumber) formData.append('collegeName', docNumber)
        if (files.front) formData.append('collegeId', files.front)
      }

      if (files.selfie) formData.append('selfie', files.selfie)

      const { data } = await userAPI.submitKyc(formData)
      if (data.user) {
        updateUser(data.user)
      } else {
        updateUser({ kycStatus: 'pending' })
      }
      toast.success('Identity verification documents submitted! Our team will review shortly.', { id: toastId })
      setShowUploadForm(false)
    } catch (err) {
      console.error('KYC submit error:', err)
      toast.error('Failed to submit documents: ' + (err.response?.data?.message || err.message), { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  function VerifCard({ icon: Icon, title, status, detail, action }) {
    const map = {
      verified:    { bg: 'bg-green-500/8',  border: 'border-green-500/20',  text: 'text-green-400',  label: 'Verified' },
      pending:     { bg: 'bg-yellow-500/8', border: 'border-yellow-500/20', text: 'text-yellow-400', label: 'Under Review' },
      rejected:    { bg: 'bg-red-500/8',    border: 'border-red-500/20',    text: 'text-red-400',    label: 'Rejected' },
      unsubmitted: { bg: 'bg-surface-2',    border: 'border-white/5',       text: 'text-white/30',   label: 'Not Submitted' },
    }
    const s = map[status] || map.unsubmitted
    return (
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${s.border} bg-surface-2`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.border} border bg-black/30`}>
          <Icon className={`text-lg ${s.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className={`text-xs mt-0.5 ${s.text}`}>{detail || s.label}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`badge text-xs border ${s.border} ${s.text}`}>{s.label}</span>
          {action}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiShield} title="Verification" subtitle="Your identity and account verification status" />
        <div className="space-y-3">
          <VerifCard
            icon={FiUser}
            title="Identity Verification (KYC)"
            status={kycStatus}
            detail={
              ['verified', 'verified'].includes(kycStatus)  ? 'Your identity has been officially verified.' :
              ['pending', 'under review'].includes(kycStatus) ? 'Your verification is currently under admin review.' :
              kycStatus === 'rejected'   ? (user?.kycRejectionReason || 'Documents rejected. Please resubmit clear photos.') :
              'Submit your ID documents (Driving License, Aadhaar, PAN, or Student ID) to verify your identity.'
            }
            action={
              (kycStatus === 'unsubmitted' || kycStatus === 'rejected' || showUploadForm) ? (
                <button
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="text-xs text-brand hover:text-brand-light font-medium flex items-center gap-1 bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-lg transition"
                >
                  {showUploadForm ? 'Cancel' : kycStatus === 'rejected' ? 'Resubmit KYC' : 'Verify Identity'}
                </button>
              ) : (
                <button
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="text-xs text-white/50 hover:text-white font-medium flex items-center gap-1"
                >
                  {showUploadForm ? 'Close' : 'View Uploaded Documents'}
                </button>
              )
            }
          />

          {/* Interactive KYC Document Upload Form */}
          <AnimatePresence>
            {showUploadForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSubmitKyc}
                className="bg-surface-2 border border-brand/20 rounded-xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <FiUpload className="text-brand" /> Submit Identity Documents
                  </h4>
                  <span className="text-[11px] text-white/40">Secure & Confidential</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs">Select Document Type</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="input-field text-xs py-2"
                    >
                      <option value="driving_license">Driving License (Rider / Owner)</option>
                      <option value="aadhaar">Aadhaar Card (National ID)</option>
                      <option value="pan">PAN Card (Tax ID)</option>
                      <option value="college_id">College / Student ID</option>
                    </select>
                  </div>

                  <div>
                    <label className="label text-xs">
                      {docType === 'driving_license' ? 'Driving License Number' :
                       docType === 'aadhaar' ? '12-Digit Aadhaar Number' :
                       docType === 'pan' ? 'PAN Card Number' : 'College / University Name'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        docType === 'driving_license' ? 'e.g. KA0120200012345' :
                        docType === 'aadhaar' ? 'e.g. 1234 5678 9012' :
                        docType === 'pan' ? 'e.g. ABCDE1234F' : 'e.g. IIT Bombay'
                      }
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      className="input-field text-xs py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {/* Front Side Document */}
                  <div className="border border-white/10 rounded-lg p-3 bg-surface text-center space-y-2">
                    <p className="text-xs text-white/70 font-medium">Front Side Photo</p>
                    {previews.front ? (
                      <div className="relative group">
                        <img src={previews.front} alt="Front Preview" className="w-full h-24 object-cover rounded border border-white/10" />
                        <button type="button" onClick={() => { setFiles(p => ({ ...p, front: null })); setPreviews(p => ({ ...p, front: '' })) }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-[10px]">✕</button>
                      </div>
                    ) : (
                      <label className="block cursor-pointer py-4 border border-dashed border-white/20 rounded hover:border-brand/50 transition">
                        <FiUpload className="mx-auto text-white/40 text-lg mb-1" />
                        <span className="text-[11px] text-brand">Choose Image</span>
                        <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange('front', e.target.files[0])} className="hidden" />
                      </label>
                    )}
                  </div>

                  {/* Back Side Document (If applicable) */}
                  {['driving_license', 'aadhaar'].includes(docType) && (
                    <div className="border border-white/10 rounded-lg p-3 bg-surface text-center space-y-2">
                      <p className="text-xs text-white/70 font-medium">Back Side Photo</p>
                      {previews.back ? (
                        <div className="relative group">
                          <img src={previews.back} alt="Back Preview" className="w-full h-24 object-cover rounded border border-white/10" />
                          <button type="button" onClick={() => { setFiles(p => ({ ...p, back: null })); setPreviews(p => ({ ...p, back: '' })) }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-[10px]">✕</button>
                        </div>
                      ) : (
                        <label className="block cursor-pointer py-4 border border-dashed border-white/20 rounded hover:border-brand/50 transition">
                          <FiUpload className="mx-auto text-white/40 text-lg mb-1" />
                          <span className="text-[11px] text-brand">Choose Image</span>
                          <input type="file" accept="image/*,.pdf" onChange={(e) => handleFileChange('back', e.target.files[0])} className="hidden" />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Selfie / Photo */}
                  <div className="border border-white/10 rounded-lg p-3 bg-surface text-center space-y-2">
                    <p className="text-xs text-white/70 font-medium">Selfie / Profile Photo</p>
                    {previews.selfie ? (
                      <div className="relative group">
                        <img src={previews.selfie} alt="Selfie Preview" className="w-full h-24 object-cover rounded border border-white/10" />
                        <button type="button" onClick={() => { setFiles(p => ({ ...p, selfie: null })); setPreviews(p => ({ ...p, selfie: '' })) }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-[10px]">✕</button>
                      </div>
                    ) : (
                      <label className="block cursor-pointer py-4 border border-dashed border-white/20 rounded hover:border-brand/50 transition">
                        <FiUpload className="mx-auto text-white/40 text-lg mb-1" />
                        <span className="text-[11px] text-brand">Upload Selfie</span>
                        <input type="file" accept="image/*" onChange={(e) => handleFileChange('selfie', e.target.files[0])} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(false)}
                    className="btn-ghost text-xs py-2 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5"
                  >
                    {submitting ? 'Submitting...' : 'Submit Verification'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <VerifCard
            icon={FiMail}
            title="Email Verification"
            status={user?.emailVerified ? 'verified' : 'unsubmitted'}
            detail={user?.emailVerified ? `${user.email} is verified.` : 'Please verify your email address.'}
          />

          <VerifCard
            icon={FiPhone}
            title="Phone Verification"
            status={!user?.phone ? 'unsubmitted' : user?.phoneVerified ? 'verified' : 'unsubmitted'}
            detail={
              !user?.phone ? 'Add a phone number to enable verification.' :
              user?.phoneVerified ? `${user.phone} is verified.` :
              'Phone added but not yet verified.'
            }
          />

          {isOwner && (
            <VerifCard
              icon={RiMotorbikeLine}
              title="Owner Account"
              status="verified"
              detail="Your owner account is active. You can list vehicles and accept bookings."
            />
          )}
        </div>
      </SectionCard>

      <div className="bg-surface-2 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
        <FiInfo className="text-white/30 shrink-0 mt-0.5" />
        <p className="text-xs text-white/30 leading-relaxed">
          Verification statuses reflect the actual data in our secure database and are managed by the LUPU platform team.
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   NOTIFICATIONS SECTION
   ═══════════════════════════════════════════════════════════ */

function NotificationsSection({ user, updateUser }) {
  const defaultPrefs = {
    bookingRequest: true, bookingAccepted: true, bookingRejected: true, bookingCancelled: true,
    paymentRecorded: true, paymentConfirmed: true, paymentDisputed: true,
    securityAlerts: true, verificationUpdates: true,
  }

  const [prefs, setPrefs] = useState(defaultPrefs)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef(null)

  useEffect(() => {
    if (user?.notificationPreferences) {
      setPrefs(prev => ({ ...prev, ...user.notificationPreferences }))
    }
  }, [user])

  const handleToggle = useCallback((key, val) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: val }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          const { data } = await userAPI.updateNotificationPreferences({ [key]: val })
          if (data.notificationPreferences) {
            updateUser({ notificationPreferences: data.notificationPreferences })
          }
        } catch (_) {
          toast.error('Could not save preference.')
          setPrefs(p2 => ({ ...p2, [key]: !val }))
        } finally {
          setSaving(false)
        }
      }, 600)
      return next
    })
  }, [updateUser])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center">
                <FiBell className="text-brand text-base" />
              </div>
              <h2 className="text-lg font-bold">Notifications</h2>
            </div>
            <p className="text-white/40 text-sm ml-11">Choose which notifications you receive</p>
          </div>
          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-white/30 mt-1">
              <div className="w-3 h-3 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
              Saving…
            </div>
          )}
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-3">Bookings</p>
          <div className="bg-surface-2 rounded-xl px-4 divide-y divide-white/5">
            <NotifRow label="New booking request"  prefKey="bookingRequest"  prefs={prefs} onChange={handleToggle} disabled={saving} />
            <NotifRow label="Booking accepted"     prefKey="bookingAccepted" prefs={prefs} onChange={handleToggle} disabled={saving} />
            <NotifRow label="Booking rejected"     prefKey="bookingRejected" prefs={prefs} onChange={handleToggle} disabled={saving} />
            <NotifRow label="Booking cancelled"    prefKey="bookingCancelled" prefs={prefs} onChange={handleToggle} disabled={saving} />
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-3">Payments</p>
          <div className="bg-surface-2 rounded-xl px-4 divide-y divide-white/5">
            <NotifRow label="Payment recorded"   prefKey="paymentRecorded"  prefs={prefs} onChange={handleToggle} disabled={saving} />
            <NotifRow label="Payment confirmed"  prefKey="paymentConfirmed" prefs={prefs} onChange={handleToggle} disabled={saving} />
            <NotifRow label="Payment disputed"   prefKey="paymentDisputed"  prefs={prefs} onChange={handleToggle} disabled={saving} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-3">Account</p>
          <div className="bg-surface-2 rounded-xl px-4 divide-y divide-white/5">
            <NotifRow label="Security alerts"       prefKey="securityAlerts"      prefs={prefs} onChange={handleToggle} disabled={saving} />
            <NotifRow label="Verification updates"  prefKey="verificationUpdates" prefs={prefs} onChange={handleToggle} disabled={saving} />
          </div>
        </div>
      </SectionCard>

      <div className="bg-surface-2 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
        <FiInfo className="text-white/30 shrink-0 mt-0.5" />
        <p className="text-xs text-white/30 leading-relaxed">
          Preferences are saved automatically and persist across sessions and devices. Security alerts are always recommended.
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   RENTAL PREFERENCES SECTION (owner-only)
   ═══════════════════════════════════════════════════════════ */

function RentalPreferencesSection() {
  const [payoutDetails, setPayoutDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await paymentAPI.getPayoutDetails()
        const d = data.payoutDetails || {}
        setPayoutDetails(d)
        setForm(d)
      } catch (_) {
        setPayoutDetails({})
        setForm({})
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await paymentAPI.updatePayoutDetails(form)
      setPayoutDetails(data.payoutDetails || {})
      setEditing(false)
      toast.success('Payout details saved securely ✓')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payout details')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiDollarSign} title="Rental Preferences" subtitle="Your payout information and rental rules" />

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-white/70">Payout Details</p>
          {!editing && !loading && (
            <button onClick={() => setEditing(true)} className="text-xs text-brand hover:text-brand-light font-medium flex items-center gap-1">
              <FiEdit2 className="text-xs" /> Edit
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-10 skeleton rounded-xl" />)}
          </div>
        ) : editing ? (
          <div className="space-y-3">
            <div>
              <label className="label">UPI ID</label>
              <input className="input-field text-sm" placeholder="yourname@paytm" value={form.upiId || ''} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))} />
            </div>
            <div>
              <label className="label">Account Holder Name</label>
              <input className="input-field text-sm" placeholder="As per bank records" value={form.accountHolderName || ''} onChange={e => setForm(f => ({ ...f, accountHolderName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Account Number</label>
              <input className="input-field text-sm" placeholder="Bank account number" inputMode="numeric" value={form.accountNumber || ''} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">IFSC Code</label>
                <input className="input-field text-sm uppercase" placeholder="HDFC0001234" value={form.ifscCode || ''} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input className="input-field text-sm" placeholder="e.g. HDFC Bank" value={form.bankName || ''} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-2.5 flex items-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : <><FiSave /> Save Payout Details</>}
              </button>
              <button onClick={() => { setEditing(false); setForm(payoutDetails || {}) }} disabled={saving} className="btn-secondary text-sm py-2.5">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            <FieldRow label="UPI ID" value={payoutDetails?.upiId || 'Not set'} />
            <FieldRow label="Account Holder" value={payoutDetails?.accountHolderName || 'Not set'} />
            <FieldRow label="Account Number" value={payoutDetails?.accountNumber || 'Not set'} />
            <FieldRow label="IFSC Code" value={payoutDetails?.ifscCode || 'Not set'} />
            <FieldRow label="Bank Name" value={payoutDetails?.bankName || 'Not set'} />
            <FieldRow
              label="Status"
              value={null}
              action={
                <StatusPill
                  verified={payoutDetails?.isVerified}
                  pending={!payoutDetails?.isVerified && !!(payoutDetails?.accountNumber || payoutDetails?.upiId)}
                  label={payoutDetails?.isVerified ? 'Verified' : 'Pending Review'}
                />
              }
            />
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="text-sm font-semibold text-white/70 mb-4">Rental Rules</p>
        <div className="space-y-3 text-xs text-white/40 leading-relaxed">
          {[
            ['Advance Payment', 'Renters pay a ₹500 advance at booking. Confirmed on acceptance.'],
            ['Security Deposit', 'Collected at handover. Set individually per vehicle listing.'],
            ['Payouts', 'Payouts are processed manually. Contact support for settlement queries.'],
            ['Phone Disclosure', 'Your number is only shared with renters after you accept their booking.'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-start gap-2">
              <FiInfo className="mt-0.5 shrink-0 text-brand/50" />
              <span><strong className="text-white/60">{k}:</strong> {v}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   SECURITY SECTION
   ═══════════════════════════════════════════════════════════ */

function SecuritySection({ user }) {
  const lastLogin = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiLock} title="Security" subtitle="Account security status and authentication" />
        <div className="space-y-3 mb-6">
          {[
            {
              icon: FiMail, label: 'Email', sub: user?.email || '—',
              verified: user?.emailVerified, pending: false,
              statusLabel: user?.emailVerified ? 'Verified' : 'Unverified'
            },
            {
              icon: FiPhone, label: 'Phone', sub: user?.phone || 'Not added',
              verified: user?.phone && user?.phoneVerified,
              pending: user?.phone && !user?.phoneVerified,
              statusLabel: !user?.phone ? 'Not Added' : user?.phoneVerified ? 'Verified' : 'Unverified'
            },
            {
              icon: FiShield, label: 'Authentication', sub: 'Firebase (Google / Email)',
              verified: true, statusLabel: 'Active'
            },
          ].map(({ icon: Icon, label, sub, verified, pending, statusLabel }) => (
            <div key={label} className="flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${verified ? 'bg-green-500/10' : pending ? 'bg-yellow-500/10' : 'bg-surface-3'}`}>
                  <Icon className={`text-base ${verified ? 'text-green-400' : pending ? 'text-yellow-400' : 'text-white/30'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{sub}</p>
                </div>
              </div>
              <StatusPill verified={verified} pending={pending} label={statusLabel} />
            </div>
          ))}

          {lastLogin && (
            <div className="flex items-center gap-3 p-4 bg-surface-2 rounded-xl border border-white/5">
              <div className="w-9 h-9 bg-surface-3 rounded-lg flex items-center justify-center">
                <FiClock className="text-white/30 text-base" />
              </div>
              <div>
                <p className="text-sm font-medium">Last Login</p>
                <p className="text-xs text-white/40 mt-0.5">{lastLogin}</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface-2 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
          <FiInfo className="text-white/30 shrink-0 mt-0.5" />
          <p className="text-xs text-white/30 leading-relaxed">
            LUPU uses Firebase Authentication. Passwords and tokens are managed securely by Google Firebase and never stored in LUPU servers. To change your login credentials, use your Firebase/Google account settings.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   PRIVACY & DATA SECTION
   ═══════════════════════════════════════════════════════════ */

function PrivacySection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiFileText} title="Privacy & Data" subtitle="How LUPU handles your information" />
        <div className="space-y-4">
          {[
            { t: 'Account Information', d: 'Your name, email, and phone number are stored securely. Your phone number is only disclosed to renters after you accept their booking.' },
            { t: 'KYC Documents', d: 'Identity documents uploaded for KYC are stored securely and only accessed by LUPU administrators for verification. Documents are never shared with other users.' },
            { t: 'Booking Records', d: 'All booking history is retained for financial, legal, and dispute resolution purposes, even after account closure.' },
            { t: 'Payment Information', d: 'Payout details (bank account, UPI) are stored securely. Payment records are retained for compliance and audit purposes.' },
            { t: 'Usage Data', d: 'LUPU collects standard analytics to improve the platform. No personal data is sold to third parties.' },
          ].map(({ t, d }) => (
            <div key={t} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-semibold mb-1">{t}</p>
              <p className="text-xs text-white/40 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <p className="text-sm font-semibold text-white/70 mb-4">Legal Documents</p>
        <div className="space-y-2">
          {[
            { label: 'Privacy Policy',   to: '/privacy' },
            { label: 'Terms of Service', to: '/terms' },
            { label: 'Legal Center',     to: '/legal' },
          ].map(({ label, to }) => (
            <Link key={to} to={to} className="flex items-center justify-between p-3.5 bg-surface-2 rounded-xl border border-white/5 hover:border-brand/20 hover:bg-brand/5 transition-all group">
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">{label}</span>
              <FiExternalLink className="text-white/20 group-hover:text-brand transition-colors text-sm" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   LEGAL SECTION
   ═══════════════════════════════════════════════════════════ */

function LegalSection() {
  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiFileText} title="Legal" subtitle="LUPU platform terms, policies, and legal documents" />
        <div className="space-y-3">
          {[
            { label: 'Terms of Service',  to: '/terms',   desc: 'Rental terms, user obligations, and platform rules' },
            { label: 'Privacy Policy',    to: '/privacy', desc: 'How LUPU collects, uses, and protects your data' },
            { label: 'Legal Center',      to: '/legal',   desc: 'Cancellation policy, safety guidelines, and more' },
          ].map(({ label, to, desc }) => (
            <Link key={to} to={to} className="flex items-center gap-4 p-4 bg-surface-2 rounded-xl border border-white/5 hover:border-brand/20 hover:bg-brand/5 transition-all group">
              <div className="w-9 h-9 bg-surface-3 group-hover:bg-brand/10 rounded-lg flex items-center justify-center transition-colors shrink-0">
                <FiFileText className="text-white/30 group-hover:text-brand text-base transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold group-hover:text-brand transition-colors">{label}</p>
                <p className="text-xs text-white/40 mt-0.5">{desc}</p>
              </div>
              <FiChevronRight className="text-white/20 group-hover:text-brand transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </SectionCard>
      <div className="card p-5 text-center">
        <p className="text-xs text-white/30">
          LUPU Platform · Governed by Indian Law<br />
          Legal queries: <span className="text-brand/60">legal@lupu.in</span>
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   LOG OUT SECTION
   ═══════════════════════════════════════════════════════════ */

function LogoutSection({ logout, navigate }) {
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout(navigate)
    } catch (_) {
      toast.error('Logout failed. Please try again.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiLogOut} title="Log Out" subtitle="Sign out of your LUPU account on this device" />
        <div className="bg-surface-2 rounded-xl p-5 border border-white/5 mb-6">
          <p className="text-sm text-white/60 leading-relaxed">
            Logging out will clear your authenticated session on this device. Your account data, vehicles, and bookings remain intact.
          </p>
          <p className="text-xs text-white/30 mt-2">
            You can log back in at any time with your registered email or Google account.
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-3 px-6 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loggingOut ? (
            <><div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> Logging out…</>
          ) : (
            <><FiLogOut className="text-lg" /> Log Out of LUPU</>
          )}
        </button>
      </SectionCard>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   DELETE ACCOUNT SECTION
   ═══════════════════════════════════════════════════════════ */

function DeleteSection({ user, logout, navigate }) {
  const [step, setStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isAdminEmail = user?.email?.toLowerCase() === 'dasstranger421@gmail.com'

  const handleRequest = async () => {
    if (confirmText !== 'DELETE') { toast.error('Type DELETE exactly to confirm'); return }
    setSubmitting(true)
    try {
      const { data } = await userAPI.requestAccountDeletion()
      toast.success(data.message || 'Account deletion request submitted.')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to submit request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isAdminEmail || user?.role === 'admin') {
    return (
      <SectionCard>
        <SectionTitle icon={FiTrash2} title="Delete Account" subtitle="Account deletion settings" />
        <div className="bg-surface-2 rounded-xl p-5 border border-white/5">
          <p className="text-sm text-white/50">The platform administrator account cannot be deleted through self-service.</p>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <SectionTitle icon={FiTrash2} title="Delete Account" subtitle="Permanently remove your LUPU account" />

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <FiAlertTriangle className="text-red-400 text-xl mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-400">Permanent Action</p>
                    <p className="text-sm text-white/60 mt-1 leading-relaxed">
                      Deleting your account is permanent and may affect your active bookings, vehicles, and rental history.
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5 text-xs text-white/40 ml-8 list-disc leading-relaxed">
                  <li>All active bookings must be resolved before deletion</li>
                  <li>Your vehicles will be removed from the platform</li>
                  <li>Financial records are retained for legal compliance</li>
                  <li>Booking history and dispute records are preserved per legal requirements</li>
                  <li>This action cannot be undone once processed by our team</li>
                </ul>
              </div>
              <div className="bg-surface-2 rounded-xl p-4 border border-white/5 mb-6">
                <p className="text-xs text-white/40 leading-relaxed">
                  Account deletion is processed manually by the LUPU team within 7 business days to ensure financial records and legal obligations are handled before closure.
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all"
              >
                <FiTrash2 /> Request Account Deletion
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 mb-6">
                <p className="text-sm font-bold text-red-400 mb-2">Final Confirmation Required</p>
                <p className="text-sm text-white/50 leading-relaxed mb-4">
                  Type <strong className="text-white font-mono">DELETE</strong> below to confirm your deletion request.
                </p>
                <input
                  className="input-field text-sm border-red-500/30 focus:border-red-500 focus:ring-red-500/30"
                  placeholder="Type DELETE here"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRequest}
                  disabled={submitting || confirmText !== 'DELETE'}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                    confirmText === 'DELETE' && !submitting
                      ? 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
                      : 'bg-red-500/10 text-red-400/40 cursor-not-allowed border border-red-500/20'
                  }`}
                >
                  {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : <><FiTrash2 /> Confirm Deletion Request</>}
                </button>
                <button onClick={() => { setStep(1); setConfirmText('') }} disabled={submitting} className="btn-secondary text-sm py-3">
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 text-center">
                <FiCheckCircle className="text-green-400 text-4xl mx-auto mb-3" />
                <p className="text-base font-bold text-green-400 mb-2">Request Submitted</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  Your account deletion request has been received. The LUPU team will review it and contact you at your registered email within 7 business days.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionCard>
    </div>
  )
}
