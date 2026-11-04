/**
 * Date and Availability Utilities for LUPU Android
 *
 * Implements pure date math, formatting, conflict detection, and duration/pricing rules.
 */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Returns 'YYYY-MM-DD' in local device time
 */
export function formatLocalDateString(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses 'YYYY-MM-DD' and 'HH:mm' into a local Date object
 */
export function parseLocalDateTime(dateStr, timeStr = '10:00') {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '10:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
}

/**
 * Returns formatted weekday name (e.g. "Tuesday")
 */
export function getWeekdayName(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[d.getDay()];
}

/**
 * Returns formatted short weekday name (e.g. "Tue")
 */
export function getShortWeekdayName(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[d.getDay()];
}

/**
 * Returns display date with weekday: e.g. "Tue, 3 Nov 2026"
 */
export function formatDisplayDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const shortDay = getShortWeekdayName(d);
  const day = d.getDate();
  const shortMonth = MONTH_NAMES[d.getMonth()].slice(0, 3);
  const year = d.getFullYear();
  return `${shortDay}, ${day} ${shortMonth} ${year}`;
}

/**
 * Formats time from "HH:mm" to "10:00 AM"
 */
export function formatDisplayTime(timeStr) {
  if (!timeStr) return '10:00 AM';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMinutes = String(m).padStart(2, '0');
  return `${displayHour}:${displayMinutes} ${period}`;
}

/**
 * Generates Monday-Sunday aligned calendar grid for year & month (0-indexed).
 * Mon = column 0, Sun = column 6.
 */
export function generateMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  // (day + 6) % 7 converts Sunday(0)->6, Monday(1)->0, Tuesday(2)->1
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  // Leading empty padding
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    cells.push({
      day: d,
      dateString: formatLocalDateString(dateObj),
      dateObj,
    });
  }
  return cells;
}

/**
 * Checks if a date string is in the past compared to today's local date
 */
export function isPastDate(dateString) {
  if (!dateString) return false;
  const todayStr = formatLocalDateString(new Date());
  return dateString < todayStr;
}

/**
 * Validates and auto-adjusts return date/time if on or before pickup
 */
export function ensureValidReturn(pickupDateStr, pickupTimeStr, returnDateStr, returnTimeStr) {
  const pickup = parseLocalDateTime(pickupDateStr, pickupTimeStr);
  let returnDt = parseLocalDateTime(returnDateStr, returnTimeStr);

  if (returnDt <= pickup) {
    // If return is <= pickup, advance return by 2 hours or next day if late
    const adjusted = new Date(pickup.getTime() + 2 * 60 * 60 * 1000);
    return {
      returnDateStr: formatLocalDateString(adjusted),
      returnTimeStr: `${String(adjusted.getHours()).padStart(2, '0')}:${String(adjusted.getMinutes()).padStart(2, '0')}`,
    };
  }

  return { returnDateStr, returnTimeStr };
}

/**
 * Checks overlap between requested date range and existing vehicle bookings
 */
export function checkBookingConflict(startDateTime, endDateTime, existingBookings = []) {
  if (!startDateTime || !endDateTime || !Array.isArray(existingBookings) || existingBookings.length === 0) {
    return { hasConflict: false, conflictingBooking: null };
  }

  const reqStart = new Date(startDateTime);
  const reqEnd = new Date(endDateTime);

  for (const b of existingBookings) {
    const bStart = new Date(b.startTime || b.start);
    const bEnd = new Date(b.endTime || b.end);

    // Overlap condition: reqStart < bEnd && reqEnd > bStart
    if (reqStart < bEnd && reqEnd > bStart) {
      return {
        hasConflict: true,
        conflictingBooking: b,
        formattedConflict: `${formatDisplayDate(bStart)} ${formatDisplayTime(`${String(bStart.getHours()).padStart(2, '0')}:${String(bStart.getMinutes()).padStart(2, '0')}`)} to ${formatDisplayDate(bEnd)} ${formatDisplayTime(`${String(bEnd.getHours()).padStart(2, '0')}:${String(bEnd.getMinutes()).padStart(2, '0')}`)}`,
      };
    }
  }

  return { hasConflict: false, conflictingBooking: null };
}

/**
 * Calculates rental duration in hours, display label, and total price preserving hourly and daily rules
 */
export function calculateRentalPricing(startDateTime, endDateTime, vehicle) {
  if (!startDateTime || !endDateTime || !vehicle) {
    return {
      durationHours: 2,
      durationDays: 0,
      durationLabel: '2 Hrs',
      rateLabel: `₹${vehicle?.pricePerHour || 49}/hr`,
      totalPrice: 2 * (vehicle?.pricePerHour || 49),
      isDailyRate: false,
    };
  }

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const diffMs = end.getTime() - start.getTime();

  if (diffMs <= 0) {
    return {
      durationHours: 0,
      durationDays: 0,
      durationLabel: '0 Hrs',
      rateLabel: `₹${vehicle.pricePerHour || 49}/hr`,
      totalPrice: 0,
      isDailyRate: false,
    };
  }

  const durationHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  const pricePerHour = vehicle.pricePerHour || 49;
  const pricePerDay = vehicle.pricePerDay || null;

  if (durationHours >= 24 && pricePerDay) {
    const durationDays = Math.ceil(durationHours / 24);
    const totalPrice = durationDays * pricePerDay;
    return {
      durationHours,
      durationDays,
      durationLabel: `${durationDays} Day${durationDays > 1 ? 's' : ''} (${durationHours} hrs)`,
      rateLabel: `₹${pricePerDay}/day`,
      totalPrice,
      isDailyRate: true,
    };
  }

  const totalPrice = durationHours * pricePerHour;
  return {
    durationHours,
    durationDays: 0,
    durationLabel: `${durationHours} Hr${durationHours > 1 ? 's' : ''}`,
    rateLabel: `₹${pricePerHour}/hr`,
    totalPrice,
    isDailyRate: false,
  };
}

/**
 * Available time slots from 07:00 to 22:00 in 1-hour intervals
 */
export const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
];
