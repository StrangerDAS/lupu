export const attachVehicleAvailability = (vehicle, activeBookings = []) => {
  const now = new Date()
  
  let currentStatus = 'Available'
  let bookedFrom = null
  let bookedUntil = null
  let availableAgain = null

  // Ensure activeBookings are sorted by startTime
  const sortedBookings = [...activeBookings].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))

  // Find if currently booked
  const currentBooking = sortedBookings.find(
    (b) => new Date(b.startTime) <= now && new Date(b.endTime) >= now
  )

  if (!vehicle.isLive || vehicle.verificationStatus !== 'approved' || vehicle.status === 'pending_verification') {
    currentStatus = 'Pending Approval'
  } else if (currentBooking) {
    currentStatus = 'Booked'
    bookedFrom = currentBooking.startTime
    bookedUntil = currentBooking.endTime
    availableAgain = currentBooking.endTime
  }

  // Also include the list of upcoming disabled date ranges for the calendar
  const disabledDates = sortedBookings.map(b => ({
    start: b.startTime,
    end: b.endTime
  }))

  return {
    ...vehicle,
    currentStatus,
    bookedFrom,
    bookedUntil,
    availableAgain,
    disabledDates
  }
}

export const checkOverlap = (existingBookings, start, end) => {
  const newStart = new Date(start)
  const newEnd = new Date(end)
  return existingBookings.some(b => {
    const bStart = new Date(b.startTime)
    const bEnd = new Date(b.endTime)
    return newStart < bEnd && newEnd > bStart
  })
}
