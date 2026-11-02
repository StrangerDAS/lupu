import React from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { colors } from '../../theme/colors'
import { radius, spacing } from '../../theme/spacing'
import { typography } from '../../theme/typography'

/**
 * Reusable LUPU Badge / Pill
 * Matches web `.badge`
 */
export default function Badge({
  label,
  variant = 'default',
  icon: Icon,
  style,
  textStyle,
}) {
  const isLive = variant === 'live' || variant === 'Available'
  const isBooked = variant === 'booked' || variant === 'Booked'
  const isPending = variant === 'pending'
  const isBrand = variant === 'brand'

  return (
    <View
      style={[
        styles.badge,
        isLive && styles.live,
        isBooked && styles.booked,
        isPending && styles.pending,
        isBrand && styles.brand,
        style,
      ]}
    >
      {Icon ? <View style={styles.iconContainer}>{Icon}</View> : null}
      <Text
        style={[
          styles.text,
          isLive && styles.textLive,
          isBooked && styles.textBooked,
          isPending && styles.textPending,
          isBrand && styles.textBrand,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  live: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  booked: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  pending: {
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
  },
  brand: {
    backgroundColor: 'rgba(255, 92, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.3)',
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontSize: typography.caption,
    fontWeight: typography.medium,
    color: colors.textPrimary,
  },
  textLive: {
    color: colors.statusLive,
  },
  textBooked: {
    color: colors.statusBooked,
  },
  textPending: {
    color: colors.statusPending,
  },
  textBrand: {
    color: colors.brand,
  },
})
