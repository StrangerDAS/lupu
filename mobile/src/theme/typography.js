import { Platform } from 'react-native';

/**
 * LUPU Typography System
 * Mirrors the Inter/system-ui hierarchy used on the LUPU website
 */
export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'sans-serif',
  }),

  // Font Sizes
  hero: 34,
  h1: 28,
  h2: 22,
  h3: 18,
  bodyLarge: 16,
  body: 14,
  caption: 12,
  micro: 10,

  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    hero: 34,
  },

  // Weights
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',

  weights: {
    regular: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
    extraBold: '800',
  },
};

export default typography;
