import { Platform } from 'react-native';
import { auth } from './firebase';

// Verified production backend endpoint on Render
export const PRODUCTION_API_URL = 'https://lupu-backend.onrender.com/api';

// Android emulator connects to host machine via 10.0.2.2 (or localhost with adb reverse)
export const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:5001/api',
  ios: 'http://localhost:5001/api',
  default: 'http://localhost:5001/api',
});

/**
 * Determine API Base URL:
 * 1. If EXPO_PUBLIC_API_URL is explicitly provided, use it.
 * 2. In development builds (__DEV__ === true), default to local emulator DEV_API_URL.
 * 3. In production/release builds (__DEV__ === false), strictly default to PRODUCTION_API_URL.
 */
function resolveBaseApiUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicitUrl) {
    if (typeof __DEV__ !== 'undefined' && !__DEV__ && (!explicitUrl.startsWith('https://') || explicitUrl.includes('10.0.2.2') || explicitUrl.includes('localhost'))) {
      throw new Error(`[Security Error] Production release build must use a secure HTTPS endpoint. Invalid explicit URL: "${explicitUrl}"`);
    }
    return explicitUrl;
  }

  // Development builds default to local emulator API
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return DEV_API_URL;
  }

  // Production release builds must strictly target verified HTTPS backend
  if (!PRODUCTION_API_URL.startsWith('https://')) {
    throw new Error(`[Security Error] PRODUCTION_API_URL must start with https://. Found: "${PRODUCTION_API_URL}"`);
  }

  return PRODUCTION_API_URL;
}

export const BASE_API_URL = resolveBaseApiUrl();

// Hard build-time / runtime assertion for release builds: never allow cleartext/local fallback in production
if (typeof __DEV__ !== 'undefined' && !__DEV__) {
  if (!BASE_API_URL || !BASE_API_URL.startsWith('https://') || BASE_API_URL.includes('10.0.2.2') || BASE_API_URL.includes('localhost')) {
    throw new Error(`[FATAL] Insecure API endpoint configured for production release: "${BASE_API_URL}". Silent fallback to local emulator is blocked.`);
  }
}

/**
 * Helper to get fresh Firebase ID token without logging or hardcoding
 */
export const getFreshIdToken = async (forceRefresh = false) => {
  try {
    if (auth?.currentUser) {
      return await auth.currentUser.getIdToken(forceRefresh);
    }
  } catch (err) {
    console.error('[API] Error getting Firebase ID token:', err.message);
  }
  return null;
};

/**
 * Universal request wrapper with authorization & graceful error handling
 */
export const request = async (endpoint, options = {}) => {
  const url = `${BASE_API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach token if user is signed in
  const token = await getFreshIdToken(false);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 20000);

  try {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (fetchErr) {
      // In development mode only, if 10.0.2.2 failed, fallback to host machine LAN IP
      if (typeof __DEV__ !== 'undefined' && __DEV__ && url.includes('10.0.2.2') && !options._triedLan) {
        const lanUrl = endpoint.startsWith('/') ? `http://192.168.1.51:5001/api${endpoint}` : `http://192.168.1.51:5001/api/${endpoint}`;
        try {
          response = await fetch(lanUrl, {
            ...options,
            headers,
            signal: controller.signal,
          });
        } catch (lanErr) {
          throw fetchErr;
        }
      } else {
        throw fetchErr;
      }
    }
    clearTimeout(timeoutId);

    // If 401 Unauthorized and we had a user, try force refreshing token once
    if (response.status === 401 && auth?.currentUser && !options._retried) {
      const freshToken = await getFreshIdToken(true);
      if (freshToken) {
        headers['Authorization'] = `Bearer ${freshToken}`;
        response = await fetch(url, {
          ...options,
          headers,
          _retried: true,
        });
      }
    }

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { text };
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Request failed with status ${response.status}`;
      return {
        ok: false,
        status: response.status,
        error: message,
        data,
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    const errorMsg = isTimeout 
      ? 'Request timed out. Please check your internet connection.' 
      : (err.message || 'Network request failed');

    return {
      ok: false,
      status: 0,
      error: errorMsg,
      isOffline: true,
      data: null,
    };
  }
};

/* ── Specific API Modules ───────────────────────────── */

export const authAPI = {
  /**
   * Syncs authenticated Firebase user with MongoDB user profile
   */
  syncLogin: async ({ name, role = 'user' } = {}) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, role }),
    });
  },

  /**
   * Validates session and gets full MongoDB user profile
   */
  getMe: async () => {
    return request('/auth/me', {
      method: 'GET',
    });
  },

  /**
   * Updates profile data
   */
  updateProfile: async (profileData) => {
    return request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },
};

export const vehicleAPI = {
  /**
   * Fetches public live & verified vehicles
   */
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/vehicles${query ? `?${query}` : ''}`;
    return request(endpoint, {
      method: 'GET',
    });
  },

  /**
   * Fetches single vehicle details by ID
   */
  getById: async (id) => {
    return request(`/vehicles/${id}`, {
      method: 'GET',
    });
  },

  /**
   * Fetches vehicles belonging to authenticated owner
   */
  getMyVehicles: async () => {
    return request('/vehicles/my', {
      method: 'GET',
    });
  },

  /**
   * List a new vehicle
   */
  create: async (vehicleData) => {
    return request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  },

  /**
   * Toggle vehicle live/offline
   */
  toggleStatus: async (id) => {
    return request(`/vehicles/${id}/toggle-status`, {
      method: 'PATCH',
    });
  },

  /**
   * Delete vehicle
   */
  delete: async (id) => {
    return request(`/vehicles/${id}`, {
      method: 'DELETE',
    });
  },
};

export const bookingAPI = {
  /**
   * Create a new booking request
   */
  create: async (bookingData) => {
    return request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  /**
   * Customer's bookings (active, upcoming, completed, cancelled)
   */
  getMyBookings: async () => {
    return request('/bookings/my', {
      method: 'GET',
    });
  },

  /**
   * Owner's received booking requests
   */
  getOwnerBookings: async () => {
    return request('/bookings', {
      method: 'GET',
    });
  },

  /**
   * Owner accepts or rejects booking
   */
  updateStatus: async (id, status, reason = '') => {
    return request(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  },

  /**
   * Customer cancels booking
   */
  cancel: async (id, reason = '') => {
    return request(`/bookings/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },
};

export const paymentAPI = {
  /**
   * Owner earnings stats
   */
  getOwnerEarnings: async () => {
    return request('/payments/owner/earnings', {
      method: 'GET',
    });
  },

  /**
   * Payment transaction history
   */
  getHistory: async () => {
    return request('/payments/history', {
      method: 'GET',
    });
  },

  /**
   * Vehicle owner records offline / cash payment receipt
   */
  recordOffline: async ({ bookingId, amount, paymentPurpose = 'rental', notes = '' }) => {
    return request('/payments/record-offline', {
      method: 'POST',
      body: JSON.stringify({
        bookingId,
        amount,
        paymentPurpose,
        notes,
      }),
    });
  },

  /**
   * Renter initiates online payment order (gated: booking must be accepted & online)
   */
  createOnlineOrder: async ({ bookingId }) => {
    return request('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
  },

  /**
   * Renter verifies and confirms online payment
   */
  verifyOnlinePayment: async ({ bookingId, orderId, paymentId, notes = '' }) => {
    return request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        bookingId,
        orderId,
        paymentId,
        notes,
      }),
    });
  },
};

export const notificationAPI = {
  /**
   * Get user notifications
   */
  getAll: async () => {
    return request('/notifications', {
      method: 'GET',
    });
  },

  /**
   * Mark notification as read
   */
  markRead: async (id) => {
    return request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },
};

export const userAPI = {
  /**
   * Update KYC verification
   */
  submitKyc: async ({ kycType = 'college_id', documentNumber = '' } = {}) => {
    return request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        kycStatus: 'verified',
        kycType,
        kycDocumentNumber: documentNumber,
        isVerified: true,
      }),
    });
  },
};
