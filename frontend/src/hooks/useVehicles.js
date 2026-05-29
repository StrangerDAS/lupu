import { useState, useEffect, useCallback } from 'react'
import useVehicleStore from '../store/vehicleStore'
import { getVehicleById } from '../firebase/firestoreService'
import { MOCK_VEHICLES } from '../utils/mockData'

/**
 * useVehicles — subscribes to Firestore vehicles and exposes filter state.
 * Falls back to mock data if Firestore returns empty.
 */
export function useVehicles() {
  const store = useVehicleStore()
  const { subscribeVehicles, unsubscribeVehicles, getFiltered, filters, setFilter, clearFilters, loading } = store

  useEffect(() => {
    const unsub = subscribeVehicles()
    return () => {
      if (unsub) unsub()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    vehicles: getFiltered(),
    loading,
    filters,
    setFilter,
    clearFilters,
  }
}

/**
 * useVehicle — fetches a single vehicle by ID from Firestore.
 * Falls back to store cache, then mock data.
 */
export function useVehicle(id) {
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Try to find from store first (avoid redundant fetch)
  const cached = useVehicleStore((s) => s.vehicles.find((v) => v._id === id))

  const fetch = useCallback(async () => {
    if (cached) { setVehicle(cached); setLoading(false); return }
    setLoading(true)
    try {
      const data = await getVehicleById(id)
      if (data) {
        setVehicle(data)
      } else {
        // Fallback to mock data
        const mock = MOCK_VEHICLES.find((v) => v._id === id)
        setVehicle(mock || MOCK_VEHICLES[0])
      }
    } catch (err) {
      console.error('Error fetching vehicle:', err)
      const mock = MOCK_VEHICLES.find((v) => v._id === id)
      setVehicle(mock || MOCK_VEHICLES[0])
      setError('Could not load vehicle')
    } finally {
      setLoading(false)
    }
  }, [id, cached])

  useEffect(() => { fetch() }, [fetch])

  return { vehicle, loading, error }
}
