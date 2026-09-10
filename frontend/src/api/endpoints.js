import api from './axiosInstance'

/* ── Auth ───────────────────────────────────────────────── */
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
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
  getOwnerContact: (id) => api.get(`/bookings/${id}/owner-contact`),
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

/* ── Payments & Financials ──────────────────────────────── */
export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
  createRecord: (data) => api.post('/payments/records', data),
  getBookingPayments: (bookingId) => api.get(`/payments/booking/${bookingId}`),
  getHistory: () => api.get('/payments/history'),
  getPayoutDetails: () => api.get('/user/payout-details'),
  updatePayoutDetails: (data) => api.put('/user/payout-details', data),
  getOwnerEarnings: () => api.get('/payments/owner/earnings'),
  getAdminStats: () => api.get('/admin/financials/stats'),
  getAdminTransactions: () => api.get('/admin/financials/transactions'),
}


/* ── Notifications ──────────────────────────────────────── */
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
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
  getMyReviews: () => api.get('/reviews/my'),
  getEligibility: (bookingId) => api.get(`/reviews/eligible/${bookingId}`),
  edit: (id, data) => api.patch(`/reviews/${id}`, data),
  delete: (id, reason) => api.delete(`/reviews/${id}`, { data: { reason } }),
  getAllAdmin: () => api.get('/admin/reviews'),
}


/* ── Trust & Safety ─────────────────────────────────────── */
export const safetyAPI = {
  report: (data) => api.post('/safety/report', data),
  getMyReports: () => api.get('/safety/my-reports'),
  getReportById: (id) => api.get(`/safety/reports/${id}`),
  dispute: (data) => api.post('/safety/dispute', data),
  getMyDisputes: () => api.get('/safety/my-disputes'),
  getDisputeById: (id) => api.get(`/safety/disputes/${id}`),
  sendDisputeMessage: (id, message) => api.post(`/safety/disputes/${id}/messages`, { message }),
  triggerSOS: (data) => api.post('/safety/sos', data),
  updateEmergencyContacts: (data) => api.put('/users/emergency-contacts', data),
}

/* ── Admin Safety ───────────────────────────────────────── */
export const adminSafetyAPI = {
  suspendUser: (id, isSuspended, reason) => api.patch(`/admin/users/${id}/suspend`, { isSuspended, reason }),
  updateFraudScore: (id, fraudScore) => api.patch(`/admin/users/${id}/fraud`, { fraudScore }),
  getReports: () => api.get('/admin/safety/reports'),
  updateReportStatus: (id, status, adminNotes) => api.patch(`/admin/safety/reports/${id}/status`, { status, adminNotes }),
  getDisputes: () => api.get('/admin/safety/disputes'),
  updateDisputeStatus: (id, status, adminNotes) => api.patch(`/admin/safety/disputes/${id}/status`, { status, adminNotes }),
  getSOS: () => api.get('/admin/safety/sos'),
}

/* ── Support ────────────────────────────────────────────── */
export const supportAPI = {
  createTicket: (data) => api.post('/support/tickets', data),
  getMyTickets: () => api.get('/support/my-tickets'),
  getTicketById: (id) => api.get(`/support/tickets/${id}`),
  replyTicket: (id, message) => api.post(`/support/tickets/${id}/reply`, { message }),
}

/* ── Admin Support ──────────────────────────────────────── */
export const adminSupportAPI = {
  createTicket: (data) => api.post('/support/tickets', data),
  getTickets: () => api.get('/admin/support/tickets'),
  replyTicket: (id, message) => api.post(`/admin/support/tickets/${id}/reply`, { message }),
  updateStatus: (id, status, adminNotes) => api.patch(`/admin/support/tickets/${id}/status`, { status, adminNotes }),
}

/* ── Admin Audit Logs ───────────────────────────────────── */
export const adminAuditAPI = {
  getLogs: () => api.get('/admin/audit-logs'),
}



