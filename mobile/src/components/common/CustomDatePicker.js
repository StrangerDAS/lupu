import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import {
  WEEKDAYS,
  MONTH_NAMES,
  TIME_SLOTS,
  formatLocalDateString,
  parseLocalDateTime,
  getWeekdayName,
  formatDisplayDate,
  formatDisplayTime,
  generateMonthGrid,
  isPastDate,
  ensureValidReturn,
  checkBookingConflict,
} from '../../utils/dateUtils';

/**
 * Custom Date, Calendar, and Time Selection Component for LUPU Android
 */
export default function CustomDatePicker({
  pickupDateStr,
  pickupTimeStr,
  returnDateStr,
  returnTimeStr,
  existingBookings = [],
  onChange,
}) {
  const [activeTab, setActiveTab] = useState('pickup'); // 'pickup' | 'return'

  // View state for the calendar month navigation
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);

  // Sync calendar month with the active selection date
  useEffect(() => {
    const targetDateStr = activeTab === 'pickup' ? pickupDateStr : returnDateStr;
    if (targetDateStr) {
      const [y, m] = targetDateStr.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [activeTab]);

  // Prev / Next month navigation
  const isAtCurrentMonth = viewYear === currentYear && viewMonth === currentMonth;

  const handlePrevMonth = () => {
    if (isAtCurrentMonth) return;
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Calendar cells
  const monthGrid = useMemo(
    () => generateMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // Active selected date
  const selectedDateStr = activeTab === 'pickup' ? pickupDateStr : returnDateStr;
  const selectedTimeStr = activeTab === 'pickup' ? pickupTimeStr : returnTimeStr;

  // Handling Date Selection
  const handleSelectDate = (dateStr) => {
    if (activeTab === 'pickup') {
      // If changing pickup, auto-adjust return if needed
      const { returnDateStr: adjustedReturnDate, returnTimeStr: adjustedReturnTime } =
        ensureValidReturn(dateStr, pickupTimeStr, returnDateStr, returnTimeStr);

      onChange?.({
        pickupDateStr: dateStr,
        pickupTimeStr,
        returnDateStr: adjustedReturnDate,
        returnTimeStr: adjustedReturnTime,
      });
    } else {
      // Selecting return date
      const { returnDateStr: adjustedReturnDate, returnTimeStr: adjustedReturnTime } =
        ensureValidReturn(pickupDateStr, pickupTimeStr, dateStr, returnTimeStr);

      onChange?.({
        pickupDateStr,
        pickupTimeStr,
        returnDateStr: adjustedReturnDate,
        returnTimeStr: adjustedReturnTime,
      });
    }
  };

  // Handling Time Selection
  const handleSelectTime = (timeStr) => {
    if (activeTab === 'pickup') {
      const { returnDateStr: adjustedReturnDate, returnTimeStr: adjustedReturnTime } =
        ensureValidReturn(pickupDateStr, timeStr, returnDateStr, returnTimeStr);

      onChange?.({
        pickupDateStr,
        pickupTimeStr: timeStr,
        returnDateStr: adjustedReturnDate,
        returnTimeStr: adjustedReturnTime,
      });
    } else {
      const { returnDateStr: adjustedReturnDate, returnTimeStr: adjustedReturnTime } =
        ensureValidReturn(pickupDateStr, pickupTimeStr, returnDateStr, timeStr);

      onChange?.({
        pickupDateStr,
        pickupTimeStr,
        returnDateStr: adjustedReturnDate,
        returnTimeStr: adjustedReturnTime,
      });
    }
  };

  // Check overlap for current selection
  const pickupDt = parseLocalDateTime(pickupDateStr, pickupTimeStr);
  const returnDt = parseLocalDateTime(returnDateStr, returnTimeStr);
  const conflict = useMemo(
    () => checkBookingConflict(pickupDt, returnDt, existingBookings),
    [pickupDt, returnDt, existingBookings]
  );

  return (
    <View style={styles.container}>
      {/* ── 1. Pickup & Return Tab Cards ─────────────────────── */}
      <View style={styles.tabCardsRow}>
        {/* Pickup Card */}
        <Pressable
          onPress={() => setActiveTab('pickup')}
          style={[
            styles.tabCard,
            activeTab === 'pickup' && styles.tabCardActive,
          ]}
        >
          <View style={styles.tabCardHeader}>
            <Feather
              name="calendar"
              size={13}
              color={activeTab === 'pickup' ? colors.brand : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabCardLabel,
                activeTab === 'pickup' && styles.tabCardLabelActive,
              ]}
            >
              PICKUP
            </Text>
          </View>
          <Text style={styles.tabCardDate} numberOfLines={1}>
            {formatDisplayDate(pickupDt)}
          </Text>
          <View style={styles.tabCardTimeRow}>
            <Feather name="clock" size={11} color={colors.textSecondary} />
            <Text style={styles.tabCardTime}>
              {formatDisplayTime(pickupTimeStr)}
            </Text>
          </View>
        </Pressable>

        {/* Direction Arrow */}
        <View style={styles.tabArrowContainer}>
          <Feather name="arrow-right" size={16} color={colors.textMuted} />
        </View>

        {/* Return Card */}
        <Pressable
          onPress={() => setActiveTab('return')}
          style={[
            styles.tabCard,
            activeTab === 'return' && styles.tabCardActive,
          ]}
        >
          <View style={styles.tabCardHeader}>
            <Feather
              name="calendar"
              size={13}
              color={activeTab === 'return' ? colors.brand : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabCardLabel,
                activeTab === 'return' && styles.tabCardLabelActive,
              ]}
            >
              RETURN
            </Text>
          </View>
          <Text style={styles.tabCardDate} numberOfLines={1}>
            {formatDisplayDate(returnDt)}
          </Text>
          <View style={styles.tabCardTimeRow}>
            <Feather name="clock" size={11} color={colors.textSecondary} />
            <Text style={styles.tabCardTime}>
              {formatDisplayTime(returnTimeStr)}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* ── Active Selection Banner ──────────────────────────── */}
      <View style={styles.activeSelectionBanner}>
        <View style={styles.selectionDot} />
        <Text style={styles.activeSelectionText}>
          Selecting {activeTab === 'pickup' ? 'Pickup' : 'Return'} Date:
        </Text>
        <Text style={styles.activeSelectionDate}>
          {getWeekdayName(parseLocalDateTime(selectedDateStr, selectedTimeStr))},{' '}
          {selectedDateStr}
        </Text>
      </View>

      {/* ── 2. Interactive Calendar ──────────────────────────── */}
      <View style={styles.calendarCard}>
        {/* Month Navigation Header */}
        <View style={styles.calendarHeader}>
          <Pressable
            onPress={handlePrevMonth}
            disabled={isAtCurrentMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.monthNavBtn,
              isAtCurrentMonth && styles.monthNavBtnDisabled,
            ]}
          >
            <Feather
              name="chevron-left"
              size={18}
              color={isAtCurrentMonth ? 'rgba(255, 255, 255, 0.2)' : '#FFFFFF'}
            />
          </Pressable>

          <Text style={styles.monthTitle}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>

          <Pressable
            onPress={handleNextMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.monthNavBtn}
          >
            <Feather name="chevron-right" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Weekday Header Row (Mon through Sun) */}
        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map((day, idx) => (
            <View key={day} style={styles.weekdayCell}>
              <Text
                style={[
                  styles.weekdayText,
                  (idx === 5 || idx === 6) && styles.weekendText,
                ]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Days Grid */}
        <View style={styles.gridContainer}>
          {monthGrid.map((cell, idx) => {
            if (!cell) {
              return <View key={`blank-${idx}`} style={styles.dayCell} />;
            }

            const { day, dateString, dateObj } = cell;

            // Date validation rules
            const isPast = isPastDate(dateString);
            const isBeforePickup = activeTab === 'return' && dateString < pickupDateStr;
            const isDisabled = isPast || isBeforePickup;

            const isPickup = dateString === pickupDateStr;
            const isReturn = dateString === returnDateStr;
            const isCurrentSelected = dateString === selectedDateStr;
            const isInRange = dateString > pickupDateStr && dateString < returnDateStr;

            // Check if day has existing bookings
            const dayStart = new Date(dateObj);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dateObj);
            dayEnd.setHours(23, 59, 59, 999);
            const dayHasBooking = existingBookings.some((b) => {
              const bStart = new Date(b.startTime || b.start);
              const bEnd = new Date(b.endTime || b.end);
              return dayStart < bEnd && dayEnd > bStart;
            });

            return (
              <Pressable
                key={dateString}
                disabled={isDisabled}
                onPress={() => handleSelectDate(dateString)}
                style={[
                  styles.dayCell,
                  isInRange && styles.dayCellInRange,
                  isCurrentSelected && styles.dayCellSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isDisabled && styles.dayTextDisabled,
                    isInRange && styles.dayTextInRange,
                    isCurrentSelected && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>

                {/* Conflict / booked indicator dot */}
                {dayHasBooking && !isCurrentSelected && !isDisabled && (
                  <View style={styles.bookedIndicatorDot} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── 3. Time Slot Picker ──────────────────────────────── */}
      <View style={styles.timeSection}>
        <View style={styles.timeSectionHeader}>
          <Feather name="clock" size={14} color={colors.brand} />
          <Text style={styles.timeSectionTitle}>
            Select {activeTab === 'pickup' ? 'Pickup' : 'Return'} Time
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeSlotsContent}
        >
          {TIME_SLOTS.map((timeStr) => {
            const isSelected = selectedTimeStr === timeStr;

            // Disable past times if date is today
            const todayStr = formatLocalDateString(new Date());
            const isToday = selectedDateStr === todayStr;
            const [slotH] = timeStr.split(':').map(Number);
            const currentHour = now.getHours();

            let timeDisabled = false;
            if (isToday && slotH <= currentHour) {
              timeDisabled = true;
            }

            // Disable return times on same day if <= pickup time
            if (activeTab === 'return' && returnDateStr === pickupDateStr) {
              const [pickH] = pickupTimeStr.split(':').map(Number);
              if (slotH <= pickH) {
                timeDisabled = true;
              }
            }

            return (
              <Pressable
                key={timeStr}
                disabled={timeDisabled}
                onPress={() => handleSelectTime(timeStr)}
                style={[
                  styles.timeChip,
                  isSelected && styles.timeChipSelected,
                  timeDisabled && styles.timeChipDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    isSelected && styles.timeChipTextSelected,
                    timeDisabled && styles.timeChipTextDisabled,
                  ]}
                >
                  {formatDisplayTime(timeStr)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 4. Booking Conflict Warning Banner ────────────────── */}
      {conflict.hasConflict && (
        <View style={styles.conflictBanner}>
          <Feather name="alert-circle" size={16} color="#EF4444" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: spacing.xs }}>
            <Text style={styles.conflictTitle}>Vehicle Unavailable</Text>
            <Text style={styles.conflictSubtitle}>
              This vehicle is already booked during your selected time. Conflicting booking:
            </Text>
            <Text style={styles.conflictTimeRange}>
              {conflict.formattedConflict}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },

  /* Tab Cards Row */
  tabCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tabCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tabCardActive: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(255, 92, 0, 0.08)',
  },
  tabCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  tabCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  tabCardLabelActive: {
    color: colors.brand,
  },
  tabCardDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  tabCardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabCardTime: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabArrowContainer: {
    paddingHorizontal: 2,
  },

  /* Active Selection Banner */
  activeSelectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  selectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginRight: 6,
  },
  activeSelectionText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginRight: 4,
  },
  activeSelectionDate: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
  },

  /* Calendar Card */
  calendarCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavBtnDisabled: {
    opacity: 0.3,
  },

  /* Weekdays Row */
  weekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  weekendText: {
    color: colors.brandLight,
  },

  /* Grid */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
    borderRadius: radius.md,
    position: 'relative',
  },
  dayCellInRange: {
    backgroundColor: 'rgba(255, 92, 0, 0.15)',
    borderRadius: 0,
  },
  dayCellSelected: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayTextDisabled: {
    color: 'rgba(255, 255, 255, 0.20)',
  },
  dayTextInRange: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  bookedIndicatorDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
  },

  /* Time Section */
  timeSection: {
    marginBottom: spacing.sm,
  },
  timeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  timeSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeSlotsContent: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  timeChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  timeChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  timeChipDisabled: {
    opacity: 0.25,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeChipTextDisabled: {
    color: colors.textMuted,
  },

  /* Conflict Warning Banner */
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  conflictTitle: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  conflictSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  conflictTimeRange: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
