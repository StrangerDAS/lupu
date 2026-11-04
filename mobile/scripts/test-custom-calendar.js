/**
 * Automated Test Suite for LUPU Android Custom Calendar & Booking System
 *
 * Validates:
 * 1. Monday through Sunday 7-column calendar grid alignment
 * 2. Future booking support and past date disabling
 * 3. Pickup and return date/time validation & auto-adjustment
 * 4. Weekday and display date/time formatting
 * 5. Availability conflict detection (overlap scenarios)
 * 6. Hourly and daily pricing rule preservation
 * 7. Boundary conditions and safety checks
 */

import {
  WEEKDAYS,
  MONTH_NAMES,
  TIME_SLOTS,
  formatLocalDateString,
  parseLocalDateTime,
  getWeekdayName,
  getShortWeekdayName,
  formatDisplayDate,
  formatDisplayTime,
  generateMonthGrid,
  isPastDate,
  ensureValidReturn,
  checkBookingConflict,
  calculateRentalPricing,
} from '../src/utils/dateUtils.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

console.log('=== LUPU Android — Custom Date & Calendar System Test Suite ===\n');

// ── Test Suite 1: Monday through Sunday Calendar Alignment ──
console.log('--- Test Suite 1: Monday-Sunday Calendar Alignment ---');
assert(WEEKDAYS[0] === 'Mon', 'First column is Monday (Mon)');
assert(WEEKDAYS[6] === 'Sun', 'Last column is Sunday (Sun)');

// Test November 2026: Nov 1, 2026 is Sunday
// In Monday-first grid: Sun is index 6. So startOffset should be 6 blanks!
const novGrid = generateMonthGrid(2026, 10); // Month is 0-indexed: 10 = Nov
assert(novGrid[0] === null, 'First cell is blank padding before Sunday');
assert(novGrid[5] === null, 'Cell index 5 is blank padding before Sunday');
assert(novGrid[6] !== null && novGrid[6].day === 1, 'Nov 1, 2026 starts at column 6 (Sunday)');
assert(novGrid.filter(c => c !== null).length === 30, 'November 2026 has exactly 30 days');

// Test December 2026: Dec 1, 2026 is Tuesday (column 1)
const decGrid = generateMonthGrid(2026, 11);
assert(decGrid[0] === null, 'Monday is blank padding before Tuesday');
assert(decGrid[1] !== null && decGrid[1].day === 1, 'Dec 1, 2026 starts at column 1 (Tuesday)');
assert(decGrid.filter(c => c !== null).length === 31, 'December 2026 has exactly 31 days');

// Test February 2028 (Leap year): Feb 1, 2028 is Tuesday (column 1)
const leapFebGrid = generateMonthGrid(2028, 1);
assert(leapFebGrid.filter(c => c !== null).length === 29, 'Leap year February 2028 has 29 days');

// ── Test Suite 2: Future Booking & Past Date Rules ──
console.log('\n--- Test Suite 2: Future Booking & Past Date Rules ---');
const todayStr = formatLocalDateString(new Date());
assert(!isPastDate(todayStr), "Today's date is NOT marked as past (enabled for booking)");

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 1);
const pastDateStr = formatLocalDateString(pastDate);
assert(isPastDate(pastDateStr), 'Yesterday is strictly marked as past date (disabled)');

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 30);
const futureDateStr = formatLocalDateString(futureDate);
assert(!isPastDate(futureDateStr), 'Future date (30 days ahead) is enabled');

// Booking horizon: Check dates 6 months and 1 year into the future
const farFutureGrid = generateMonthGrid(2027, 5); // June 2027
assert(farFutureGrid.filter(c => c !== null).length === 30, 'Allows arbitrary future horizon (June 2027 gridded correctly)');

// ── Test Suite 3: Weekday and Date/Time Display ──
console.log('\n--- Test Suite 3: Weekday and Date/Time Display ---');
const nov3 = new Date(2026, 10, 3, 10, 0); // Tuesday Nov 3, 2026
assert(getWeekdayName(nov3) === 'Tuesday', 'Extracts full weekday name "Tuesday"');
assert(getShortWeekdayName(nov3) === 'Tue', 'Extracts short weekday name "Tue"');
assert(formatDisplayDate(nov3) === 'Tue, 3 Nov 2026', 'Formats display date as "Tue, 3 Nov 2026"');
assert(formatDisplayTime('10:00') === '10:00 AM', 'Formats "10:00" as "10:00 AM"');
assert(formatDisplayTime('14:30') === '2:30 PM', 'Formats "14:30" as "2:30 PM"');
assert(formatDisplayTime('00:00') === '12:00 AM', 'Formats "00:00" as "12:00 AM"');
assert(formatDisplayTime('12:00') === '12:00 PM', 'Formats "12:00" as "12:00 PM"');

// ── Test Suite 4: Pickup & Return Validation & Auto-Adjustment ──
console.log('\n--- Test Suite 4: Pickup & Return Validation & Auto-Adjustment ---');
// Case A: Valid return after pickup
const validRes = ensureValidReturn('2026-11-03', '10:00', '2026-11-03', '14:00');
assert(validRes.returnDateStr === '2026-11-03' && validRes.returnTimeStr === '14:00', 'Preserves valid return after pickup');

// Case B: Return is on or before pickup -> automatically advances return
const invalidRes = ensureValidReturn('2026-11-03', '14:00', '2026-11-03', '10:00');
assert(
  invalidRes.returnDateStr === '2026-11-03' && invalidRes.returnTimeStr === '16:00',
  'Auto-adjusts return to pickup + 2 hours when return was before pickup'
);

// Case C: Pickup moved past existing return date
const movedRes = ensureValidReturn('2026-11-05', '10:00', '2026-11-03', '12:00');
assert(
  movedRes.returnDateStr === '2026-11-05' && movedRes.returnTimeStr === '12:00',
  'Changing pickup does not leave invalid return date (advances return date to pickup + 2 hours)'
);

// ── Test Suite 5: Availability Conflict Detection (Overlaps) ──
console.log('\n--- Test Suite 5: Availability Conflict Detection ---');
const existingBookings = [
  {
    startTime: '2026-11-04T08:00:00.000Z',
    endTime: '2026-11-04T16:00:00.000Z',
  },
  {
    startTime: '2026-11-10T09:00:00.000Z',
    endTime: '2026-11-12T18:00:00.000Z',
  },
];

// No conflict: Before existing booking
const noOverlapBefore = checkBookingConflict(
  '2026-11-04T04:00:00.000Z',
  '2026-11-04T08:00:00.000Z',
  existingBookings
);
assert(!noOverlapBefore.hasConflict, 'No conflict when request ends before existing booking starts');

// No conflict: After existing booking
const noOverlapAfter = checkBookingConflict(
  '2026-11-04T16:00:00.000Z',
  '2026-11-04T20:00:00.000Z',
  existingBookings
);
assert(!noOverlapAfter.hasConflict, 'No conflict when request starts after existing booking ends');

// Conflict 1: Overlapping start
const overlapStart = checkBookingConflict(
  '2026-11-04T06:00:00.000Z',
  '2026-11-04T10:00:00.000Z',
  existingBookings
);
assert(overlapStart.hasConflict, 'Detects conflict when requested slot overlaps start of existing booking');

// Conflict 2: Overlapping end
const overlapEnd = checkBookingConflict(
  '2026-11-04T14:00:00.000Z',
  '2026-11-04T18:00:00.000Z',
  existingBookings
);
assert(overlapEnd.hasConflict, 'Detects conflict when requested slot overlaps end of existing booking');

// Conflict 3: Completely inside existing booking
const overlapInside = checkBookingConflict(
  '2026-11-04T10:00:00.000Z',
  '2026-11-04T12:00:00.000Z',
  existingBookings
);
assert(overlapInside.hasConflict, 'Detects conflict when requested slot is completely inside existing booking');

// Conflict 4: Enclosing existing booking
const overlapEnclose = checkBookingConflict(
  '2026-11-04T06:00:00.000Z',
  '2026-11-04T18:00:00.000Z',
  existingBookings
);
assert(overlapEnclose.hasConflict, 'Detects conflict when requested slot encloses existing booking');

// ── Test Suite 6: Pricing Rule Preservation ──
console.log('\n--- Test Suite 6: Hourly & Daily Pricing Rules ---');
const testVehicle = {
  pricePerHour: 50,
  pricePerDay: 350,
  securityDeposit: 500,
};

// 1. Short duration: 2 hours
const p2h = calculateRentalPricing(
  new Date('2026-11-03T10:00:00'),
  new Date('2026-11-03T12:00:00'),
  testVehicle
);
assert(p2h.durationHours === 2, 'Calculates 2 hours duration');
assert(p2h.totalPrice === 100, 'Calculates hourly rate: 2h * ₹50 = ₹100');
assert(!p2h.isDailyRate, 'Duration < 24h uses hourly rate');

// 2. Full day: 24 hours
const p24h = calculateRentalPricing(
  new Date('2026-11-03T10:00:00'),
  new Date('2026-11-04T10:00:00'),
  testVehicle
);
assert(p24h.durationHours === 24, 'Calculates 24 hours duration');
assert(p24h.durationDays === 1, 'Calculates 1 day');
assert(p24h.totalPrice === 350, 'Preserves daily rate for 24h: 1 day * ₹350 = ₹350 (saves vs 24*50=₹1200)');
assert(p24h.isDailyRate, 'Duration >= 24h uses daily rate');

// 3. Multi-day: 48 hours (2 days)
const p48h = calculateRentalPricing(
  new Date('2026-11-03T10:00:00'),
  new Date('2026-11-05T10:00:00'),
  testVehicle
);
assert(p48h.durationDays === 2, 'Calculates 2 days');
assert(p48h.totalPrice === 700, 'Calculates multi-day rate: 2 days * ₹350 = ₹700');

// 4. Vehicle without daily rate
const hourlyOnlyVehicle = {
  pricePerHour: 40,
  pricePerDay: null,
};
const pHourly24 = calculateRentalPricing(
  new Date('2026-11-03T10:00:00'),
  new Date('2026-11-04T10:00:00'),
  hourlyOnlyVehicle
);
assert(pHourly24.totalPrice === 24 * 40, 'Falls back cleanly to hourly rate when pricePerDay is null');

console.log(`\n=== Verification Summary: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
