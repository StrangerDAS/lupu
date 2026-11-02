import React from 'react'
import { StyleSheet, Text, Pressable, ActivityIndicator, View } from 'react-native'
import { colors } from '../../theme/colors'
import { radius, spacing } from '../../theme/spacing'
import { typography } from '../../theme/typography'

/**
 * Reusable LUPU Button
 * Variants:
 *  - 'primary'   : Brand Orange (#FF5C00), bold white text, subtle orange shadow
 *  - 'secondary' : Surface-2 (#2A2A2A), white border, white text
 *  - 'ghost'     : Transparent, light highlight on press
 *  - 'danger'    : Red accent
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) {
  const isPrimary = variant === 'primary'
  const isSecondary = variant === 'secondary'
  const isGhost = variant === 'ghost'
  const isDanger = variant === 'danger'

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        isGhost && styles.ghost,
        isDanger && styles.danger,
        size === 'sm' && styles.sizeSm,
        size === 'lg' && styles.sizeLg,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isGhost || isSecondary ? colors.textPrimary : '#FFFFFF'}
        />
      ) : (
        <View style={styles.content}>
          {Icon ? <View style={styles.iconContainer}>{Icon}</View> : null}
          <Text
            style={[
              styles.text,
              isPrimary && styles.textPrimary,
              isSecondary && styles.textSecondary,
              isGhost && styles.textGhost,
              isDanger && styles.textDanger,
              size === 'sm' && styles.textSizeSm,
              size === 'lg' && styles.textSizeLg,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.brand,
    elevation: 3, // Android native shadow
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  secondary: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
  sizeSm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  sizeLg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  text: {
    fontFamily: typography.fontFamily,
    fontSize: typography.bodyLarge,
    fontWeight: typography.semiBold,
    letterSpacing: 0.2,
  },
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: colors.textPrimary,
  },
  textGhost: {
    color: colors.textSecondary,
  },
  textDanger: {
    color: '#FFFFFF',
  },
  textSizeSm: {
    fontSize: typography.body,
  },
  textSizeLg: {
    fontSize: typography.h3,
  },
})
