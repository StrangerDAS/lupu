import { create } from 'zustand'
import { vehicleAPI } from '../api/endpoints'

/**
 * Vehicle store — holds vehicle list + active filters.
 * Fetches data directly from the Express API (MongoDB).
 */
const useVehicleStore = create((set, get) => ({
  vehicles: [],
  loading: false,
  error: null,

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

  /** Fetch vehicles from the Express API */
  loadVehicles: async () => {
    set({ loading: true, error: null })
    try {
      const response = await vehicleAPI.getAll()
      set({ vehicles: response.data?.vehicles || [], loading: false })
    } catch (err) {
      console.error('Error fetching vehicles:', err)
      set({ error: 'Could not load vehicles', loading: false, vehicles: [] })
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
