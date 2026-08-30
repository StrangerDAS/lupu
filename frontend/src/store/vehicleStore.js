import { create } from 'zustand'
import { vehicleAPI, itemAPI } from '../api/endpoints'

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
    availabilityStatus: '', // 'Available', 'Booked', ''
    dateStart: '',
    dateEnd: '',
    sortBy: 'relevance',    // 'relevance' | 'price_asc' | 'price_desc' | 'rating'
  },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () =>
    set({ filters: { type: '', category: '', minPrice: '', maxPrice: '', search: '', availabilityStatus: '', dateStart: '', dateEnd: '', sortBy: 'relevance' } }),

  setVehicles: (vehicles) => set({ vehicles }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  /** Fetch vehicles from the Express API */
  loadVehicles: async () => {
    set({ loading: true, error: null })
    try {
      const response = await itemAPI.getAll()
      set({ vehicles: response.data?.items || [], loading: false })
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
    const list = vehicles.filter((v) => {
      // Normalize category property
      const cat = v.category || 'vehicle'
      // Hide offline vehicles from explore unless showOffline is true
      if (!showOffline) {
        if (cat === 'accessory') {
          if (v.availability === false) return false
        } else {
          const isApproved = v.status === 'approved' || v.verificationStatus === 'approved'
          const isLive = v.isLive !== false
          if (!isApproved || !isLive) return false
        }
      }
      if (filters.category && cat !== filters.category) return false
      if (filters.type && v.type !== filters.type) return false
      const price = v.pricePerHour || v.pricePerDay || 0
      if (filters.minPrice && price < Number(filters.minPrice)) return false
      if (filters.maxPrice && price > Number(filters.maxPrice)) return false
      
      if (filters.search) {
        const q = filters.search.toLowerCase().trim()
        const matchName = (v.name || '').toLowerCase().includes(q)
        const matchBrand = (v.brand || '').toLowerCase().includes(q)
        const matchModel = (v.model || '').toLowerCase().includes(q)
        const matchLocation = (v.location || '').toLowerCase().includes(q)
        const matchType = (v.type || '').toLowerCase().includes(q)
        if (!matchName && !matchBrand && !matchModel && !matchLocation && !matchType) {
          return false
        }
      }

      if (filters.availabilityStatus && v.currentStatus !== filters.availabilityStatus) return false
      
      if (filters.dateStart && filters.dateEnd && v.disabledDates) {
        const start = new Date(filters.dateStart)
        const end = new Date(filters.dateEnd)
        const hasOverlap = v.disabledDates.some(range => {
          const rStart = new Date(range.start)
          const rEnd = new Date(range.end)
          return start < rEnd && end > rStart
        })
        if (hasOverlap) return false
      }
      
      return true
    })

    // Apply Sorting
    if (filters.sortBy === 'price_asc') {
      list.sort((a, b) => (a.pricePerHour || a.pricePerDay || 0) - (b.pricePerHour || b.pricePerDay || 0))
    } else if (filters.sortBy === 'price_desc') {
      list.sort((a, b) => (b.pricePerHour || b.pricePerDay || 0) - (a.pricePerHour || a.pricePerDay || 0))
    } else if (filters.sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    }

    return list
  },
}))

export default useVehicleStore
