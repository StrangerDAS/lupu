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
  getAll: () => api.get('/bookings'),         // admin
  getById: (id) => api.get(`/bookings/${id}`),
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
  approveVehicle: (id) => api.patch(`/admin/vehicles/${id}/approve`),
  rejectVehicle: (id) => api.patch(`/admin/vehicles/${id}/reject`),
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
  createOrder: (data) => api.post('/payments/create-order', data),
}

