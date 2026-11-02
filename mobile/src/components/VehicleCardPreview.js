import React from 'react';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import { MaterialCommunityIcons, Feather, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import StatusDot from './common/StatusDot';
import { BASE_API_URL } from '../services/api';

const DEFAULT_BIKE_IMG = 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80';
const DEFAULT_SCOOTY_IMG = 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80';

/**
 * Optimizes image URLs for mobile rendering:
 * 1. Cloudinary URLs get f_auto, q_auto, and a 600px width cap to conserve mobile bandwidth.
 * 2. Relative URLs (/uploads/...) are resolved against the active backend API host.
 */
function optimizeMobileImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/image/upload/')) {
    const parts = trimmed.split('/image/upload/');
    const rest = (parts[1] || '').replace(/^v\d+\//, '');
    return `${parts[0]}/image/upload/f_auto,q_auto,w_600,c_fill,g_auto/${rest}`;
  }
  if (trimmed.startsWith('/')) {
    const host = BASE_API_URL ? BASE_API_URL.replace(/\/api\/?$/, '') : '';
    return `${host}${trimmed}`;
  }
  return trimmed;
}

/**
 * LUPU Vehicle Card (Mobile Native)
 * Faithfully mirrors frontend/src/components/VehicleCard.jsx
 * Fully compatible with MongoDB backend response format.
 */
export default function VehicleCardPreview({ vehicle, onPress }) {
  if (!vehicle) return null;

  const displayName = vehicle.brand && !vehicle.name?.toLowerCase().includes(vehicle.brand.toLowerCase())
    ? `${vehicle.brand} ${vehicle.name}`
    : (vehicle.name || 'Vehicle');

  const type = (vehicle.type || 'bike').toLowerCase();
  const pricePerHour = vehicle.pricePerHour ?? vehicle.pricing?.hourly ?? 0;
  const pricePerDay = vehicle.pricePerDay ?? vehicle.pricing?.daily ?? 0;
  const location = typeof vehicle.location === 'string' ? vehicle.location : (vehicle.location?.address || 'Dibrugarh, Assam');
  const rating = Number(vehicle.rating || 0);
  const totalReviews = Number(vehicle.totalReviews || 0);

  // Status mapping
  const isAvailable = vehicle.isAvailable !== false && vehicle.currentStatus !== 'Booked';
  const currentStatus = isAvailable ? 'Available' : 'Booked';

  // Photo resolution: images array, photos array, imageUrl string, or default placeholder
  const rawImage = vehicle.images?.[0] || vehicle.photos?.[0] || vehicle.imageUrl;
  const resolvedImage = optimizeMobileImageUrl(rawImage);
  const imageSource = resolvedImage
    ? { uri: resolvedImage }
    : { uri: type === 'bike' ? DEFAULT_BIKE_IMG : DEFAULT_SCOOTY_IMG };

  const ownerVerified = vehicle.ownerVerified !== false;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* ── Image Header (16:9 Aspect Ratio) ── */}
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Type Badge (Top-Left) */}
        <View style={styles.typeBadge}>
          <MaterialCommunityIcons
            name={type === 'bike' ? 'motorbike' : 'moped'}
            size={13}
            color={colors.brand}
            style={styles.typeIcon}
          />
          <Text style={styles.typeText}>{type === 'scooty' ? 'Scooty' : 'Bike'}</Text>
        </View>

        {/* Status Pill with Glowing Dot (Top-Right) */}
        <View style={styles.statusPill}>
          <StatusDot status={currentStatus} size={7} />
          <Text
            style={[
              styles.statusText,
              { color: isAvailable ? colors.statusLive : colors.statusBooked },
            ]}
          >
            {currentStatus.toUpperCase()}
          </Text>
        </View>

        {/* Verified Owner Badge (Bottom-Left) */}
        {ownerVerified ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={11} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Verified Owner</Text>
          </View>
        ) : null}
      </View>

      {/* ── Card Content ── */}
      <View style={styles.content}>
        {/* Title + Star Rating */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {displayName}
          </Text>
          {rating > 0 ? (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color={colors.brand} />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({totalReviews})</Text>
            </View>
          ) : (
            <Text style={styles.noReviews}>New</Text>
          )}
        </View>

        {/* Location */}
        {location ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={11} color={colors.textMuted} />
            <Text style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Pricing & Availability CTA */}
        <View style={styles.footerRow}>
          <View>
            <View style={styles.priceRow}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <Text style={styles.hourlyPrice}>{pricePerHour}</Text>
              <Text style={styles.perHour}>/hr</Text>
            </View>
            {pricePerDay > 0 ? (
              <Text style={styles.dailyPrice}>₹{pricePerDay}/day</Text>
            ) : null}
          </View>

          {/* Action Button */}
          <View
            style={[
              styles.actionPill,
              isAvailable ? styles.actionPillAvailable : styles.actionPillBooked,
            ]}
          >
            <Text
              style={[
                styles.actionPillText,
                isAvailable ? styles.actionTextAvailable : styles.actionTextBooked,
              ]}
            >
              {isAvailable ? 'Available' : 'Booked'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#121212',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  typeIcon: {
    marginRight: 4,
  },
  typeText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  statusPill: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    marginLeft: 3,
  },
  content: {
    padding: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginLeft: 3,
  },
  reviewCount: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginLeft: 2,
  },
  noReviews: {
    color: colors.brand,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rupeeSymbol: {
    color: colors.brand,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  hourlyPrice: {
    color: colors.brand,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  perHour: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginLeft: 2,
  },
  dailyPrice: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  actionPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionPillAvailable: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  actionPillBooked: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  actionPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  actionTextAvailable: {
    color: colors.statusLive,
  },
  actionTextBooked: {
    color: colors.danger,
  },
});
