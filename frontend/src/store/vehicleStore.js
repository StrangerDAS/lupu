import { create } from 'zustand'
import { MOCK_VEHICLES } from '../utils/mockData'
import { subscribeToAllVehicles } from '../firebase/firestoreService'

/**
 * Vehicle store — holds vehicle list + active filters.
 * Uses Firestore real-time subscription with mock data fallback.
 */
const useVehicleStore = create((set, get) => ({
  vehicles: [],
  loading: false,
  error: null,
  _unsubscribe: null,

  // Active filter state
  filters: {
    type: '',        // 'bike' | 'scooty' | ''
    category: '',    // 'vehicle' | 'accessory' | ''
    minPrice: '',
    maxPrice: '',
    search: '',
  },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () =>
    set({ filters: { type: '', category: '', minPrice: '', maxPrice: '', search: '' } }),

  setVehicles: (vehicles) => set({ vehicles }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  /** Subscribe to Firestore vehicles (real-time). Falls back to mock data. */
  subscribeVehicles: () => {
    set({ loading: true, error: null })

    // Clean up previous subscription
    const prev = get()._unsubscribe
    if (prev) prev()

    const unsubscribe = subscribeToAllVehicles((vehicles) => {
      if (vehicles.length > 0) {
        set({ vehicles, loading: false })
      } else {
        // Fallback to mock data if Firestore is empty
        set({ vehicles: MOCK_VEHICLES, loading: false })
      }
    })

    set({ _unsubscribe: unsubscribe })
    return unsubscribe
  },

  /** Legacy: Load vehicles from API (falls back to mock) */
  fetchVehicles: async (apiCall) => {
    set({ loading: true, error: null })
    try {
      const data = await apiCall()
      set({ vehicles: data, loading: false })
    } catch {
      set({ vehicles: MOCK_VEHICLES, loading: false })
    }
  },

  /** Cleanup subscription */
  unsubscribeVehicles: () => {
    const unsub = get()._unsubscribe
    if (unsub) {
      unsub()
      set({ _unsubscribe: null })
    }
  },

  /** Computed: filtered vehicles based on current filters.
   *  By default hides offline vehicles (for Explore page).
   */
  getFiltered: (showOffline = false) => {
    const { vehicles, filters } = get()
    return vehicles.filter((v) => {
      // Hide offline vehicles from explore unless showOffline is true
      if (!showOffline) {
        const isAvailable = (v.status === 'approved') && (v.isLive !== false)
        if (!isAvailable) return false
      }
      if (filters.category && v.category !== filters.category) return false
      if (filters.type && v.type !== filters.type) return false
      const price = v.pricePerHour || v.pricePerDay || 0
      if (filters.minPrice && price < Number(filters.minPrice)) return false
      if (filters.maxPrice && price > Number(filters.maxPrice)) return false
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (
          !v.name.toLowerCase().includes(q) &&
          !(v.location || '').toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  },
}))

export default useVehicleStore
