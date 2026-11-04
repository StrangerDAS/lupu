import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  Modal,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import {
  getVehicleImages,
  optimizeMobileImageUrl,
  DEFAULT_BIKE_IMG,
  DEFAULT_SCOOTY_IMG,
} from '../../utils/galleryUtils';

export { getVehicleImages, optimizeMobileImageUrl, DEFAULT_BIKE_IMG, DEFAULT_SCOOTY_IMG };

/**
 * Swipeable Vehicle Photo Gallery
 * Renders a compact carousel in the booking bottom sheet and opens a full-screen viewer on tap.
 */
export default function VehicleGallery({
  vehicle,
  activeIndex = 0,
  onIndexChange,
  style,
}) {
  const insets = useSafeAreaInsets();
  const screenDimensions = Dimensions.get('window');
  const screenWidth = screenDimensions.width;
  const screenHeight = screenDimensions.height;

  // Extract all images
  const images = getVehicleImages(vehicle);
  const totalCount = images.length;

  // Container width from onLayout
  const [containerWidth, setContainerWidth] = useState(
    screenWidth - spacing.lg * 2
  );

  // Gallery state
  const [currentIndex, setCurrentIndex] = useState(activeIndex);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [brokenImages, setBrokenImages] = useState({});

  const carouselRef = useRef(null);
  const fullScreenListRef = useRef(null);
  const lastTapRef = useRef({});

  // Reset index when vehicle changes
  const vehicleId = vehicle?._id || vehicle?.id;
  useEffect(() => {
    setCurrentIndex(0);
    onIndexChange?.(0);
  }, [vehicleId]);

  // Keep in sync with parent activeIndex if changed externally
  useEffect(() => {
    if (activeIndex !== currentIndex && activeIndex >= 0 && activeIndex < totalCount) {
      setCurrentIndex(activeIndex);
      carouselRef.current?.scrollToIndex({ index: activeIndex, animated: false });
    }
  }, [activeIndex]);

  const handleIndexChange = useCallback(
    (index) => {
      if (index >= 0 && index < totalCount) {
        setCurrentIndex(index);
        onIndexChange?.(index);
      }
    },
    [totalCount, onIndexChange]
  );

  const handleNext = () => {
    if (currentIndex < totalCount - 1) {
      const nextIdx = currentIndex + 1;
      handleIndexChange(nextIdx);
      carouselRef.current?.scrollToIndex({ index: nextIdx, animated: true });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      handleIndexChange(prevIdx);
      carouselRef.current?.scrollToIndex({ index: prevIdx, animated: true });
    }
  };

  const handleOpenFullScreen = () => {
    setIsFullScreen(true);
  };

  const handleCloseFullScreen = () => {
    setIsFullScreen(false);
    // Ensure bottom sheet carousel returns to the same image position
    setTimeout(() => {
      if (carouselRef.current && currentIndex >= 0 && currentIndex < totalCount) {
        carouselRef.current.scrollToIndex({ index: currentIndex, animated: false });
      }
    }, 80);
  };

  const markBroken = (index) => {
    setBrokenImages((prev) => ({ ...prev, [index]: true }));
  };

  const resolveImageUri = (item, index, fullScreen = false) => {
    if (brokenImages[index]) {
      const isScooty = (vehicle?.type || '').toLowerCase().includes('scoot');
      return isScooty ? DEFAULT_SCOOTY_IMG : DEFAULT_BIKE_IMG;
    }
    return optimizeMobileImageUrl(item, fullScreen) || item;
  };

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
    >
      {/* ── 1. Main Sheet Carousel ───────────────────────────── */}
      <View style={[styles.carouselContainer, { width: containerWidth }]}>
        <FlatList
          ref={carouselRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={Platform.OS === 'android'}
          keyExtractor={(item, index) => `sheet-img-${index}`}
          getItemLayout={(_, index) => ({
            length: containerWidth,
            offset: containerWidth * index,
            index,
          })}
          onMomentumScrollEnd={(e) => {
            if (containerWidth > 0) {
              const idx = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
              if (idx !== currentIndex && idx >= 0 && idx < totalCount) {
                handleIndexChange(idx);
              }
            }
          }}
          renderItem={({ item, index }) => {
            const uri = resolveImageUri(item, index, false);
            return (
              <Pressable
                onPress={handleOpenFullScreen}
                activeOpacity={0.92}
                style={[styles.slideItem, { width: containerWidth }]}
              >
                <Image
                  source={{ uri }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                  onError={() => markBroken(index)}
                />
              </Pressable>
            );
          }}
        />

        {/* Top-Left Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>AVAILABLE</Text>
          </View>
          <View style={styles.ownerBadge}>
            <Feather name="check-circle" size={12} color="#10B981" />
            <Text style={styles.ownerBadgeText}>Verified Owner</Text>
          </View>
        </View>

        {/* Top-Right Expand Hint */}
        <Pressable
          onPress={handleOpenFullScreen}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.expandButton}
        >
          <Feather name="maximize-2" size={14} color="#FFFFFF" />
        </Pressable>

        {/* Left / Right Chevron Controls (when multiple photos) */}
        {totalCount > 1 && (
          <>
            {currentIndex > 0 && (
              <Pressable
                onPress={handlePrev}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.arrowButton, styles.leftArrow]}
              >
                <Feather name="chevron-left" size={18} color="#FFFFFF" />
              </Pressable>
            )}
            {currentIndex < totalCount - 1 && (
              <Pressable
                onPress={handleNext}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={[styles.arrowButton, styles.rightArrow]}
              >
                <Feather name="chevron-right" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </>
        )}

        {/* Bottom Bar: Indicators & Counter */}
        <View style={styles.bottomBar}>
          {/* Dot Indicators */}
          {totalCount > 1 ? (
            <View style={styles.dotsContainer}>
              {images.map((_, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <Pressable
                    key={`dot-${idx}`}
                    onPress={() => {
                      handleIndexChange(idx);
                      carouselRef.current?.scrollToIndex({ index: idx, animated: true });
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <View
                      style={[
                        styles.dot,
                        isActive ? styles.dotActive : styles.dotInactive,
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {/* Photo Counter Pill (e.g. 1 / 5) */}
          <View style={styles.counterPill}>
            <Feather name="image" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.counterText}>
              {currentIndex + 1} / {totalCount}
            </Text>
          </View>
        </View>
      </View>

      {/* ── 2. Full-Screen Image Viewer Modal ─────────────────── */}
      <Modal
        visible={isFullScreen}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseFullScreen}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.fullScreenRoot}>
          {/* Top Header Bar */}
          <View
            style={[
              styles.fullScreenHeader,
              { paddingTop: Math.max(insets.top, 16) },
            ]}
          >
            <Pressable
              onPress={handleCloseFullScreen}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.fullScreenCloseBtn}
            >
              <Feather name="x" size={22} color="#FFFFFF" />
            </Pressable>

            <View style={styles.fullScreenHeaderTitleContainer}>
              <Text style={styles.fullScreenTitle} numberOfLines={1}>
                {vehicle?.brand || 'LUPU'} {vehicle?.name || 'Ride'}
              </Text>
              <Text style={styles.fullScreenSubtitle}>
                Photo {currentIndex + 1} of {totalCount}
              </Text>
            </View>

            <View style={styles.fullScreenHeaderRight}>
              <View style={styles.fullScreenCounterPill}>
                <Text style={styles.fullScreenCounterText}>
                  {currentIndex + 1}/{totalCount}
                </Text>
              </View>
            </View>
          </View>

          {/* Main Full-Screen Gallery List */}
          <View style={styles.fullScreenGalleryArea}>
            <FlatList
              ref={fullScreenListRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={currentIndex}
              getItemLayout={(_, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              keyExtractor={(item, index) => `fs-img-${index}`}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                if (idx !== currentIndex && idx >= 0 && idx < totalCount) {
                  handleIndexChange(idx);
                }
              }}
              renderItem={({ item, index }) => {
                const uri = resolveImageUri(item, index, true);
                const zoomScrollRef = React.createRef();

                // Double tap handling
                const handleDoubleTap = () => {
                  const now = Date.now();
                  const last = lastTapRef.current[index] || 0;
                  if (now - last < 300) {
                    zoomScrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
                  }
                  lastTapRef.current[index] = now;
                };

                return (
                  <View style={[styles.fullScreenSlide, { width: screenWidth }]}>
                    <ScrollView
                      ref={zoomScrollRef}
                      maximumZoomScale={3.5}
                      minimumZoomScale={1}
                      centerContent
                      showsHorizontalScrollIndicator={false}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.zoomScrollContent}
                    >
                      <Pressable onPress={handleDoubleTap}>
                        <Image
                          source={{ uri }}
                          style={{
                            width: screenWidth,
                            height: screenHeight * 0.65,
                          }}
                          resizeMode="contain"
                          onError={() => markBroken(index)}
                        />
                      </Pressable>
                    </ScrollView>
                  </View>
                );
              }}
            />

            {/* Left / Right Full Screen Navigation Arrows */}
            {totalCount > 1 && (
              <>
                {currentIndex > 0 && (
                  <Pressable
                    onPress={() => {
                      const next = currentIndex - 1;
                      handleIndexChange(next);
                      fullScreenListRef.current?.scrollToIndex({ index: next, animated: true });
                    }}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    style={[styles.fullScreenNavArrow, styles.fullScreenNavLeft]}
                  >
                    <Feather name="chevron-left" size={24} color="#FFFFFF" />
                  </Pressable>
                )}
                {currentIndex < totalCount - 1 && (
                  <Pressable
                    onPress={() => {
                      const next = currentIndex + 1;
                      handleIndexChange(next);
                      fullScreenListRef.current?.scrollToIndex({ index: next, animated: true });
                    }}
                    hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                    style={[styles.fullScreenNavArrow, styles.fullScreenNavRight]}
                  >
                    <Feather name="chevron-right" size={24} color="#FFFFFF" />
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Bottom Thumbnails Strip */}
          <View
            style={[
              styles.fullScreenFooter,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {totalCount > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbStripContent}
              >
                {images.map((img, idx) => {
                  const isSelected = idx === currentIndex;
                  const thumbUri = resolveImageUri(img, idx, false);
                  return (
                    <Pressable
                      key={`thumb-${idx}`}
                      onPress={() => {
                        handleIndexChange(idx);
                        fullScreenListRef.current?.scrollToIndex({
                          index: idx,
                          animated: true,
                        });
                      }}
                      style={[
                        styles.thumbItem,
                        isSelected && styles.thumbItemSelected,
                      ]}
                    >
                      <Image
                        source={{ uri: thumbUri }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                        onError={() => markBroken(idx)}
                      />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.singlePhotoHint}>
                Pinch to zoom • Tap × to close
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  carouselContainer: {
    height: 200,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    position: 'relative',
  },
  slideItem: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },

  /* Badges */
  badgeRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    zIndex: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 28, 28, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  ownerBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '600',
  },

  /* Expand Button */
  expandButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  /* Arrow Controls */
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  leftArrow: {
    left: spacing.sm,
  },
  rightArrow: {
    right: spacing.sm,
  },

  /* Bottom Bar */
  bottomBar: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 16,
    backgroundColor: colors.brand,
  },
  dotInactive: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  counterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  /* ── Full-Screen Styles ── */
  fullScreenRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 20,
  },
  fullScreenCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenHeaderTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  fullScreenTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fullScreenSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  fullScreenHeaderRight: {
    width: 38,
    alignItems: 'flex-end',
  },
  fullScreenCounterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
  },
  fullScreenCounterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  fullScreenGalleryArea: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  fullScreenSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenNavArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  fullScreenNavLeft: {
    left: spacing.md,
  },
  fullScreenNavRight: {
    right: spacing.md,
  },
  fullScreenFooter: {
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  thumbStripContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  thumbItem: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  thumbItemSelected: {
    borderColor: colors.brand,
    opacity: 1,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  singlePhotoHint: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
