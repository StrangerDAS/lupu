import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiFilter, FiSearch, FiX } from 'react-icons/fi'
import { RiMotorbikeLine } from 'react-icons/ri'
import { FiShoppingBag } from 'react-icons/fi'
import PageWrapper from '../components/PageWrapper'
import VehicleCard from '../components/VehicleCard'
import AccessoryCard from '../components/AccessoryCard'
import { VehicleCardSkeleton } from '../components/Skeletons'
import { useVehicles } from '../hooks/useVehicles'

const CATEGORIES = [
  { value: '', label: 'All', icon: null },
  { value: 'vehicle', label: 'Vehicles', icon: RiMotorbikeLine },
  { value: 'accessory', label: 'Accessories', icon: FiShoppingBag },
]

const PRICE_RANGES = [
  { label: 'Any price', min: '', max: '' },
  { label: 'Under ₹50', min: '0', max: '50' },
  { label: '₹50 – ₹100', min: '50', max: '100' },
  { label: '₹100 – ₹200', min: '100', max: '200' },
  { label: '₹200+', min: '200', max: '999' },
]

export default function Explore() {
  const { vehicles, loading, filters, setFilter, clearFilters } = useVehicles()
  const [filterOpen, setFilterOpen] = useState(false)

  const hasFilters = filters.type || filters.minPrice || filters.search || filters.category || filters.availabilityStatus || (filters.dateStart && filters.dateEnd)

  const activePriceLabel = PRICE_RANGES.find(
    (r) => r.min === filters.minPrice && r.max === filters.maxPrice
  )?.label || 'Any price'

  const setPriceRange = (range) => {
    setFilter('minPrice', range.min)
    setFilter('maxPrice', range.max)
  }

  const itemCount = vehicles.length
  const label = filters.category === 'accessory' ? 'accessories' : filters.category === 'vehicle' ? 'vehicles' : 'items'

  return (
    <PageWrapper>
      <div className="container-main py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="section-title">Explore</h1>
          <p className="text-white/40 mt-2">
            {loading ? '…' : `${itemCount} ${label} available in Dibrugarh`}
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setFilter('category', cat.value); setFilter('type', '') }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                filters.category === cat.value
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'bg-surface-2 text-white/60 hover:bg-surface-3'
              }`}
            >
              {cat.icon && <cat.icon size={16} />}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search + filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              id="item-search"
              type="text"
              placeholder="Search by name or area…"
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="input-field pl-11"
            />
          </div>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`btn-secondary flex items-center gap-2 shrink-0 ${hasFilters ? 'border-brand text-brand' : ''}`}
          >
            <FiFilter />
            Filters
            {hasFilters && (
              <span className="w-5 h-5 bg-brand text-white text-xs rounded-full flex items-center justify-center leading-none">
                {[filters.type, filters.minPrice, filters.category, filters.availabilityStatus, filters.dateStart].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 mb-8 flex flex-wrap gap-6"
          >
            {/* Type filter (only for vehicles) */}
            {filters.category !== 'accessory' && (
              <div>
                <p className="label">Vehicle type</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: '', label: 'All types' },
                    { value: 'bike', label: 'Bike' },
                    { value: 'scooty', label: 'Scooty' },
                  ].map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setFilter('type', t.value)}
                      className={`badge px-3 py-1.5 text-sm cursor-pointer transition ${
                        filters.type === t.value
                          ? 'bg-brand text-white'
                          : 'bg-surface-2 text-white/60 hover:bg-surface-3'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price filter */}
            <div>
              <p className="label">Price range</p>
              <div className="flex gap-2 flex-wrap">
                {PRICE_RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setPriceRange(r)}
                    className={`badge px-3 py-1.5 text-sm cursor-pointer transition ${
                      activePriceLabel === r.label
                        ? 'bg-brand text-white'
                        : 'bg-surface-2 text-white/60 hover:bg-surface-3'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability filter */}
            {filters.category !== 'accessory' && (
              <div className="w-full">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div>
                    <p className="label">Availability Status</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: '', label: 'Any Status' },
                        { value: 'Available', label: 'Available Now' },
                        { value: 'Booked', label: 'Currently Booked' },
                      ].map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setFilter('availabilityStatus', t.value)}
                          className={`badge px-3 py-1.5 text-sm cursor-pointer transition ${
                            filters.availabilityStatus === t.value
                              ? 'bg-brand text-white'
                              : 'bg-surface-2 text-white/60 hover:bg-surface-3'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="label">Available On Dates</p>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="date" 
                        value={filters.dateStart} 
                        onChange={(e) => setFilter('dateStart', e.target.value)} 
                        className="input-field text-sm px-3 py-1.5 max-w-[140px]" 
                      />
                      <span className="text-white/40">to</span>
                      <input 
                        type="date" 
                        value={filters.dateEnd} 
                        onChange={(e) => setFilter('dateEnd', e.target.value)} 
                        className="input-field text-sm px-3 py-1.5 max-w-[140px]" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasFilters && (
              <button
                onClick={() => { clearFilters(); setFilterOpen(false) }}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white ml-auto self-end"
              >
                <FiX /> Clear all
              </button>
            )}
          </motion.div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <VehicleCardSkeleton key={i} />)}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-white/40 text-lg">No items match your filters.</p>
            <button onClick={clearFilters} className="btn-ghost mt-3 text-sm text-brand">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {vehicles.map((item, i) =>
              item.category === 'accessory' ? (
                <AccessoryCard key={item._id} item={item} index={i} />
              ) : (
                <VehicleCard key={item._id} vehicle={item} index={i} />
              )
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  )
}
