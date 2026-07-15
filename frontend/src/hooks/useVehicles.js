import { useState, useEffect, useCallback } from 'react'
import useVehicleStore from '../store/vehicleStore'
import { vehicleAPI } from '../api/endpoints'

/**
 * useVehicles — loads vehicles from API and exposes filter state.
 */
export function useVehicles() {
  const store = useVehicleStore()
  const { loadVehicles, getFiltered, filters, setFilter, clearFilters, loading } = store

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  return {
    vehicles: getFiltered(),
    loading,
    filters,
    setFilter,
    clearFilters,
  }
}

/**
 * useVehicle — fetches a single vehicle by ID from the Express API.
 * Falls back to store cache if available.
 */
export function useVehicle(id) {
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Try to find from store first (avoid redundant fetch)
  const cached = useVehicleStore((s) => s.vehicles.find((v) => v._id === id))

  const fetchVehicle = useCallback(async () => {
    if (!id) return
    if (cached) { setVehicle(cached); setLoading(false); return }
    setLoading(true)
    try {
      const response = await vehicleAPI.getById(id)
      if (response.data) {
        setVehicle(response.data)
      } else {
        setVehicle(null)
      }
    } catch (err) {
      console.error('Error fetching vehicle:', err)
      setVehicle(null)
      setError('Could not load vehicle')
    } finally {
      setLoading(false)
    }
  }, [id, cached])

  useEffect(() => { fetchVehicle() }, [fetchVehicle])

  return { vehicle, loading, error }
}
