import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * Calculates dynamic height for the bottom navigation bar including safe-area insets.
 * Useful for child screens (ScrollView contentContainerStyle) to ensure the bottom-most
 * content is never obscured by the navigation bar across any device or navigation mode.
 */
export function getBottomNavHeight(insets, isCompact = false) {
  const bottomInset = Math.max(insets?.bottom || 0, 0);
  const itemHeight = isCompact ? 44 : 48;
  const topPadding = isCompact ? 4 : 6;
  const bottomPadding = bottomInset > 0 ? bottomInset + (isCompact ? 2 : 4) : spacing.sm;
  return itemHeight + topPadding + bottomPadding;
}

export default function BottomNavigationBar({
  currentTab,
  onTabPress,
  isAuthenticated,
  user,
  onAccountPress,
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive device categorization
  const isCompact = width < 360;
  const iconSize = isCompact ? 20 : 22;
  const fontSize = isCompact ? 10 : 11;

  // Safe area bottom inset: respects Android 3-button nav, gesture bar, or edge-to-edge
  const bottomInset = Math.max(insets.bottom, 0);
  const bottomPadding = bottomInset > 0 ? bottomInset + (isCompact ? 2 : 4) : spacing.sm;
  const horizontalPadding = Math.max(insets.left, insets.right, spacing.xs);

  const tabs = [
    {
      key: 'explore',
      label: 'Explore',
      IconComponent: Feather,
      iconName: 'compass',
      onPress: () => onTabPress('explore'),
    },
    {
      key: 'dashboard',
      label: 'Dashboard',
      IconComponent: MaterialCommunityIcons,
      iconName: 'view-dashboard-outline',
      onPress: () => onTabPress('dashboard'),
    },
    {
      key: 'how-it-works',
      label: 'How it works',
      IconComponent: Feather,
      iconName: 'zap',
      onPress: () => onTabPress('how-it-works'),
    },
    {
      key: 'login',
      label: isAuthenticated && user ? 'Account' : 'Log in',
      IconComponent: Feather,
      iconName: 'user',
      onPress: () => {
        if (isAuthenticated && user) {
          onAccountPress ? onAccountPress() : onTabPress('dashboard');
        } else {
          onTabPress('login');
        }
      },
    },
  ];

  return (
    <View
      style={[
        styles.bottomNav,
        {
          paddingTop: isCompact ? 4 : 6,
          paddingBottom: bottomPadding,
          paddingLeft: horizontalPadding,
          paddingRight: horizontalPadding,
        },
      ]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isActive =
          currentTab === tab.key || (tab.key === 'login' && currentTab === 'login');
        const activeColor = colors.brand;
        const inactiveColor = colors.textMuted;
        const itemColor = isActive ? activeColor : inactiveColor;

        return (
          <Pressable
            key={tab.key}
            onPress={tab.onPress}
            style={[
              styles.bottomNavItem,
              { minHeight: isCompact ? 44 : 48 },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <tab.IconComponent
              name={tab.iconName}
              size={iconSize}
              color={itemColor}
            />
            <Text
              style={[
                styles.bottomNavText,
                {
                  fontSize,
                  color: itemColor,
                  fontWeight: isActive
                    ? typography.weights.bold
                    : typography.weights.medium,
                },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 3,
  },
  bottomNavText: {
    textAlign: 'center',
  },
});
