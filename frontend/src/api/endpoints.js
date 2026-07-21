import api from './axiosInstance'

/* ── Auth ───────────────────────────────────────────────── */
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  signup: (data) => api.post('/auth/signup', data),
  me: () => api.get('/auth/me'),
  sendOtp: (data) => api.post('/auth/send-otp', data),
  verifyContact: (data) => api.post('/auth/verify-contact', data),
}

/* ── Vehicles ───────────────────────────────────────────── */
export const vehicleAPI = {
  getAll: (params) => api.get('/vehicles', { params }),
  getById: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/vehicles/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/vehicles/${id}`),
  myVehicles: () => api.get('/vehicles/my'),
  toggleStatus: (id) => api.patch(`/vehicles/${id}/toggle-status`),
}

/* ── Bookings ───────────────────────────────────────────── */
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  myBookings: () => api.get('/bookings/my'),
  cancel: (id) => api.patch(`/bookings/${id}/cancel`),
  getAll: () => api.get('/bookings'),         // admin, owner, renter
  getById: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, status) => api.patch(`/bookings/${id}/status`, { status }),
  updateBooking: (id, data) => api.put(`/bookings/${id}`, data),
  getCalendar: (vehicleId) => api.get(`/vehicles/${vehicleId}/calendar`),
}

/* ── Users ──────────────────────────────────────────────── */
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getAll: () => api.get('/users'),            // admin
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/users/${id}`),
  submitKyc: (data) => api.post('/users/kyc', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

/* ── Admin ──────────────────────────────────────────────── */
export const adminAPI = {
  approveVehicle: (id, notes) => api.patch(`/admin/vehicles/${id}/approve`, { adminNotes: notes }),
  rejectVehicle: (id, reason, notes) => api.patch(`/admin/vehicles/${id}/reject`, { reason, adminNotes: notes }),
  requestChanges: (id, notes) => api.patch(`/admin/vehicles/${id}/request-changes`, { adminNotes: notes }),
  getPendingVehicles: () => api.get('/admin/vehicles/pending'),
  getAllVehicles: () => api.get('/admin/vehicles'),
  getDashboardStats: () => api.get('/admin/stats'),
}



/* ── Items (unified vehicles + accessories) ────────────── */
export const itemAPI = {
  getAll: (type) => api.get('/items', { params: type ? { type } : {} }),
  getById: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
}

/* ── Role ───────────────────────────────────────────────── */
export const roleAPI = {
  activateOwner: () => api.post('/user/activate-owner'),
  activateRider: () => api.post('/user/activate-rider'),
}

/* ── Payments ───────────────────────────────────────────── */
export const paymentAPI = {
  createOrder: (data) => api.post('/payment/create-order', data),
  verify: (data) => api.post('/payment/verify', data),
  refund: (id) => api.post(`/payment/${id}/refund`),
  getHistory: () => api.get('/payment/history'),
}

/* ── Notifications ──────────────────────────────────────── */
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
}

/* ── Simulated Emails ───────────────────────────────────── */
export const simulatedEmailAPI = {
  getEmails: () => api.get('/emails/simulated'),
  clearInbox: () => api.delete('/emails/simulated'),
}

/* ── Reviews ────────────────────────────────────────────── */
export const reviewAPI = {
  submit: (data) => api.post('/reviews', data),
  getVehicleReviews: (vehicleId) => api.get(`/reviews/vehicle/${vehicleId}`),
  getUserReviews: (userId) => api.get(`/reviews/user/${userId}`),
  getEligibility: (bookingId) => api.get(`/reviews/eligible/${bookingId}`),
}

/* ── Trust & Safety ─────────────────────────────────────── */
export const safetyAPI = {
  report: (data) => api.post('/safety/report', data),
  dispute: (data) => api.post('/safety/dispute', data),
  triggerSOS: (data) => api.post('/safety/sos', data),
  updateEmergencyContacts: (data) => api.put('/users/emergency-contacts', data),
}

/* ── Admin Safety ───────────────────────────────────────── */
export const adminSafetyAPI = {
  suspendUser: (id, isSuspended) => api.patch(`/admin/users/${id}/suspend`, { isSuspended }),
  updateFraudScore: (id, fraudScore) => api.patch(`/admin/users/${id}/fraud`, { fraudScore }),
  getReports: () => api.get('/admin/safety/reports'),
  getDisputes: () => api.get('/admin/safety/disputes'),
  getSOS: () => api.get('/admin/safety/sos'),
}

