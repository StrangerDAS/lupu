import React, { useState } from 'react'
import { StyleSheet, View, Text, TextInput } from 'react-native'
import { colors } from '../../theme/colors'
import { radius, spacing } from '../../theme/spacing'
import { typography } from '../../theme/typography'

/**
 * Reusable LUPU Input Field
 * Matches web `.input-field` (bg-surface-2 #2A2A2A, rounded-xl 12px, border white/10, focus brand border)
 */
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon: Icon,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  helperText,
  style,
  inputStyle,
}) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        {Icon ? <View style={styles.iconContainer}>{Icon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, inputStyle]}
        />
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.body,
    fontWeight: typography.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
  },
  inputFocused: {
    borderColor: colors.brand,
  },
  inputError: {
    borderColor: colors.danger,
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: spacing.xs,
  },
})
