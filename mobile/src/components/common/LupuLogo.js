import React from 'react'
import { StyleSheet, View, Text, Image } from 'react-native'
import { colors } from '../../theme/colors'
import { radius, spacing } from '../../theme/spacing'
import { typography } from '../../theme/typography'

/**
 * Official LUPU Logo Component
 * Uses the exact LUPU brand icon asset from the website + wordmark:
 *  - Real brand image icon (orange tile with white geometric bike glyph)
 *  - "lupu." wordmark with brand orange period
 */
export default function LupuLogo({ size = 36, showWordmark = true }) {
  return (
    <View style={styles.container}>
      {/* Official Brand Icon Tile */}
      <Image
        source={require('../../../assets/icon.png')}
        style={[
          styles.logoImage,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.28), // 10px-12px rounded-xl
          },
        ]}
        resizeMode="contain"
      />

      {/* Wordmark: lupu. */}
      {showWordmark ? (
        <Text style={styles.wordmark}>
          lupu<Text style={styles.dot}>.</Text>
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    backgroundColor: colors.brand,
    overflow: 'hidden',
  },
  wordmark: {
    fontFamily: typography.fontFamily,
    fontSize: typography.h2,
    fontWeight: typography.extraBold,
    color: colors.textPrimary,
    letterSpacing: -0.6,
    marginLeft: spacing.sm + 2,
  },
  dot: {
    color: colors.brand,
  },
})
