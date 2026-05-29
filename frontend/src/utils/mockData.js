/**
 * mockData.js — development fallback data.
 * All fake ratings, fake reviews, fake testimonials, and fake bookings have been removed.
 * Only structural data (for empty-state testing) remains.
 * Real data comes exclusively from Firestore.
 */

// No mock vehicles — real listings come from Firestore.
// Explore page shows "No listings available" if Firestore is empty.
export const MOCK_VEHICLES = []

// No mock bookings — real bookings come from Firestore.
export const MOCK_BOOKINGS = []
export const MOCK_CUSTOMER_BOOKINGS = []
export const MOCK_OWNER_BOOKINGS = []
export const MOCK_OWNER_VEHICLES = []

// No mock reviews — real reviews come from Firestore.
export const MOCK_REVIEWS = []

// No fake testimonials — testimonial section removed from homepage.
export const MOCK_TESTIMONIALS = []

// No fake admin stats — admin panel reads from Firestore.
export const MOCK_ADMIN_STATS = {
  users: 0,
  vehicles: 0,
  bookings: 0,
  pendingListings: 0,
}

// No fake admin vehicles
export const MOCK_ADMIN_VEHICLES = []

// No fake users
export const MOCK_USERS = []

// No fake accessories
export const MOCK_ACCESSORIES = []
