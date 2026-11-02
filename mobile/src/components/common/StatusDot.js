import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/colors'

/**
 * LUPU Status Dot
 * Matches web `.status-dot--live` and `.status-dot--offline`
 */
export default function StatusDot({ status = 'Available', size = 8 }) {
  const isAvailable = status === 'Available' || status === 'live' || status === 'approved'
  const isBooked = status === 'Booked' || status === 'offline'

  const dotColor = isAvailable
    ? colors.statusLive
    : isBooked
    ? colors.statusBooked
    : colors.statusPending

  const glowColor = isAvailable
    ? colors.statusLiveGlow
    : isBooked
    ? colors.statusBookedGlow
    : colors.statusPendingGlow

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: dotColor,
          shadowColor: dotColor,
          elevation: 2,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  dot: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
})
