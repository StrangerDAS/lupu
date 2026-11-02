import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import LupuLogo from '../components/common/LupuLogo';

/**
 * Initial session check loading screen.
 * Displayed while Firebase determines if a valid persisted session exists,
 * preventing any brief flash of the Explore screen.
 */
export default function LoadingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <LupuLogo size={48} showWordmark={true} />
        <View style={styles.indicatorContainer}>
          <ActivityIndicator size="small" color={colors.brand} />
          <Text style={styles.statusText}>Connecting to LUPU...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  statusText: {
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySm,
    color: colors.textMuted,
  },
});
