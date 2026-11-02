import React from 'react'
import { StyleSheet, View, Text, ScrollView } from 'react-native'
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons'
import { colors } from '../theme/colors'
import { spacing, radius } from '../theme/spacing'
import { typography } from '../theme/typography'
import Card from '../components/common/Card'

const STEPS = [
  {
    number: '01',
    title: 'Browse & Choose',
    desc: 'Explore bikes and scooties available near you in Dibrugarh. Filter by price, type, or availability.',
    icon: 'motorbike',
  },
  {
    number: '02',
    title: 'Book Instantly',
    desc: 'Select your dates, upload your driving licence, and confirm your booking in minutes.',
    icon: 'clock-outline',
  },
  {
    number: '03',
    title: 'Ride & Return',
    desc: 'Pick up the vehicle, enjoy your ride, and return it at the agreed time. Simple as that.',
    icon: 'map-marker-check',
  },
]

const FEATURES = [
  {
    title: 'Verified Vehicles',
    desc: 'Every vehicle is reviewed and approved by our team before being listed.',
    icon: 'shield-check',
  },
  {
    title: 'Trusted Owners',
    desc: 'Vehicle owners are verified locals with ratings from real users.',
    icon: 'star-circle',
  },
  {
    title: 'Fair Pricing',
    desc: 'Transparent pricing with zero hidden fees. Pay exactly what you see.',
    icon: 'currency-inr',
  },
  {
    title: 'All Vehicle Types',
    desc: 'From high-mileage scooties to performance motorcycles.',
    icon: 'moped',
  },
]

import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function HowItWorksScreen({ bottomNavHeight }) {
  const insets = useSafeAreaInsets();
  const effectiveBottomPadding =
    (bottomNavHeight || 56 + Math.max(insets.bottom, 0)) + spacing.xl;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: effectiveBottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>How LUPU Works</Text>
        <Text style={styles.subtitle}>
          Rent bikes and scooters in Dibrugarh in 3 easy steps
        </Text>
      </View>

      {/* ── 3 Steps ── */}
      {STEPS.map((step) => (
        <Card key={step.number} style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{step.number}</Text>
            </View>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons
                name={step.icon}
                size={22}
                color={colors.brand}
              />
            </View>
          </View>
          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepDesc}>{step.desc}</Text>
        </Card>
      ))}

      {/* ── Trust Features ── */}
      <View style={styles.featuresSection}>
        <Text style={styles.featuresHeading}>Why Choose LUPU?</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map((feat) => (
            <Card key={feat.title} style={styles.featureCard}>
              <View style={styles.featIconContainer}>
                <MaterialCommunityIcons
                  name={feat.icon}
                  size={20}
                  color={colors.brand}
                />
              </View>
              <Text style={styles.featTitle}>{feat.title}</Text>
              <Text style={styles.featDesc}>{feat.desc}</Text>
            </Card>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  numberBadge: {
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.25)',
  },
  numberText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.brand,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: typography.h3,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepDesc: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  featuresSection: {
    marginTop: spacing.xl,
  },
  featuresHeading: {
    fontSize: typography.h2,
    fontWeight: typography.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  featuresGrid: {
    gap: spacing.md,
  },
  featureCard: {
    padding: spacing.lg,
  },
  featIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semiBold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  featDesc: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 18,
  },
})
