import React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../theme/colors'
import { radius, spacing } from '../../theme/spacing'

/**
 * Reusable LUPU Card
 * Matches web `.card` (bg-surface #1C1C1C, rounded-2xl 16px, border white/8)
 */
export default function Card({ children, style, surface = 1 }) {
  const bgColor = surface === 2 ? colors.surface2 : colors.surface

  return (
    <View style={[styles.card, { backgroundColor: bgColor }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
})
