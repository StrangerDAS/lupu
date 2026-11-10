import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import LupuLogo from '../components/common/LupuLogo';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import VehicleCardPreview from '../components/VehicleCardPreview';
import BottomNavigationBar, { getBottomNavHeight } from '../components/common/BottomNavigationBar';
import LoginScreen from './LoginScreen';
import HowItWorksScreen from './HowItWorksScreen';
import DashboardScreen from './DashboardScreen';
import { useAuth } from '../context/AuthContext';
import { vehicleAPI, notificationAPI, bookingAPI } from '../services/api';
import VehicleGallery from '../components/common/VehicleGallery';
import CustomDatePicker from '../components/common/CustomDatePicker';
import {
  formatLocalDateString,
  parseLocalDateTime,
  calculateRentalPricing,
  checkBookingConflict,
} from '../utils/dateUtils';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: null },
  { id: 'bike', label: 'Bikes', icon: 'motorbike' },
  { id: 'scooty', label: 'Scooters', icon: 'moped' },
];

export default function HomeScreen() {
  const { user, isAuthenticated, logout, authReady } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomNavHeight = getBottomNavHeight(insets, width < 360);

  const [currentTab, setCurrentTab] = useState('explore'); // 'explore' | 'how-it-works' | 'login'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Live vehicles state
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Vehicle Detail & Booking modal state
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showVehicleDetailModal, setShowVehicleDetailModal] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [pickupDateStr, setPickupDateStr] = useState('');
  const [pickupTimeStr, setPickupTimeStr] = useState('10:00');
  const [returnDateStr, setReturnDateStr] = useState('');
  const [returnTimeStr, setReturnTimeStr] = useState('12:00');
  const [vehicleBookings, setVehicleBookings] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash'); // 'cash' | 'online'
  const [agreementAccepted, setAgreementAccepted] = useState(true);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Initialize pickup/return dates and fetch vehicle calendar availability
  useEffect(() => {
    if (selectedVehicle) {
      const now = new Date();
      const currentH = now.getHours();
      let pDate;
      let pTime;
      let rDate;
      let rTime;

      if (currentH >= 20) {
        // Late evening: default to tomorrow 09:00 AM to 01:00 PM
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        pDate = formatLocalDateString(tomorrow);
        pTime = '09:00';
        rDate = pDate;
        rTime = '13:00';
      } else {
        const nextH = Math.min(20, Math.max(8, currentH + 1));
        pDate = formatLocalDateString(now);
        pTime = `${String(nextH).padStart(2, '0')}:00`;
        const retH = Math.min(22, nextH + 2);
        rDate = pDate;
        rTime = `${String(retH).padStart(2, '0')}:00`;
      }

      setPickupDateStr(pDate);
      setPickupTimeStr(pTime);
      setReturnDateStr(rDate);
      setReturnTimeStr(rTime);

      const vId = selectedVehicle._id || selectedVehicle.id;
      if (vId) {
        vehicleAPI.getCalendar(vId)
          .then((res) => {
            if (res.ok && Array.isArray(res.data?.bookings)) {
              setVehicleBookings(res.data.bookings);
            } else if (Array.isArray(selectedVehicle.disabledDates)) {
              setVehicleBookings(selectedVehicle.disabledDates);
            }
          })
          .catch(() => {
            if (Array.isArray(selectedVehicle.disabledDates)) {
              setVehicleBookings(selectedVehicle.disabledDates);
            }
          });
      }
    }
  }, [selectedVehicle?._id || selectedVehicle?.id]);

  // Derived date objects and calculated pricing
  const pickupDt = useMemo(
    () => parseLocalDateTime(pickupDateStr, pickupTimeStr),
    [pickupDateStr, pickupTimeStr]
  );
  const returnDt = useMemo(
    () => parseLocalDateTime(returnDateStr, returnTimeStr),
    [returnDateStr, returnTimeStr]
  );
  const rentalPricing = useMemo(
    () => calculateRentalPricing(pickupDt, returnDt, selectedVehicle),
    [pickupDt, returnDt, selectedVehicle]
  );
  const conflictInfo = useMemo(
    () => checkBookingConflict(pickupDt, returnDt, vehicleBookings),
    [pickupDt, returnDt, vehicleBookings]
  );

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationAPI.getAll();
      if (res.ok && Array.isArray(res.data?.notifications)) {
        setNotifications(res.data.notifications);
        const unread = res.data.notifications.filter((n) => !n.isRead && !n.read).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      // Non-blocking
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Ensure tab resets to explore if user signs out
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentTab('explore');
    }
  }, [isAuthenticated]);

  const handleOpenNotifications = () => {
    if (!isAuthenticated || !user) {
      Alert.alert(
        'Notifications',
        'Log in to view your booking alerts, rental status updates, and vehicle activity.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => setCurrentTab('login') },
        ]
      );
      return;
    }
    setShowNotificationsModal(true);
    fetchNotifications();
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
    setUnreadCount(0);
    try {
      for (const n of notifications) {
        if (!n.isRead && !n.read && (n._id || n.id)) {
          await notificationAPI.markRead(n._id || n.id);
        }
      }
    } catch (e) {
      // Non-blocking
    }
  };

  // Fetch real vehicles from API
  const fetchLiveVehicles = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await vehicleAPI.getAll();
      if (res.ok && Array.isArray(res.data?.vehicles)) {
        setVehicles(res.data.vehicles);
      } else {
        setFetchError(res.error || 'Failed to fetch vehicles');
      }
    } catch (e) {
      setFetchError(e.message || 'Network error fetching vehicles');
    } finally {
      setLoadingVehicles(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveVehicles();
  }, [fetchLiveVehicles]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLiveVehicles();
  };

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const vType = (v.type || '').toLowerCase();
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'bike' && (vType === 'bike' || vType === 'motorcycle')) ||
      (selectedCategory === 'scooty' && (vType === 'scooty' || vType === 'scooter'));

    const query = searchQuery.trim().toLowerCase();
    const vName = (v.name || '').toLowerCase();
    const vBrand = (v.brand || '').toLowerCase();
    const vLocation = (typeof v.location === 'string' ? v.location : v.location?.address || '').toLowerCase();

    const matchesSearch =
      !query ||
      vName.includes(query) ||
      vBrand.includes(query) ||
      vLocation.includes(query);

    return matchesCategory && matchesSearch;
  });

  const handleAccountOptions = () => {
    if (!user) {
      setCurrentTab('login');
      return;
    }
    setShowProfileModal(true);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of LUPU?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setShowProfileModal(false);
          await logout();
        },
      },
    ]);
  };

  const handleCreateBooking = async () => {
    if (!isAuthenticated || !user) {
      Alert.alert(
        'Login Required',
        'Please log in to book this vehicle.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log In',
            onPress: () => {
              setShowVehicleDetailModal(false);
              setCurrentTab('login');
            },
          },
        ]
      );
      return;
    }

    if (!selectedVehicle) return;

    if (!agreementAccepted) {
      Alert.alert('Agreement Required', 'You must agree to the LUPU Rental Terms to proceed.');
      return;
    }

    // Owner cannot book own vehicle
    const ownerId = selectedVehicle.ownerId?._id || selectedVehicle.ownerId;
    if (user._id && ownerId && user._id.toString() === ownerId.toString()) {
      Alert.alert(
        'Owner Restriction',
        'You cannot book your own vehicle listing. To test bookings, switch to a separate customer/renter account.'
      );
      return;
    }

    if (conflictInfo.hasConflict) {
      Alert.alert(
        'Vehicle Unavailable',
        'This vehicle is already booked for the selected schedule. Please adjust your pickup or return date/time.'
      );
      return;
    }

    if (rentalPricing.durationHours <= 0 || returnDt <= pickupDt) {
      Alert.alert('Invalid Schedule', 'Return date and time must be after pickup.');
      return;
    }

    // ── Mandatory Identity & Face Verification Server & Client Guard ──
    const isUserVerified =
      user.isVerified === true ||
      user.verificationStatus === 'verified' ||
      user.kycStatus === 'verified';

    if (!isUserVerified) {
      Alert.alert(
        'Identity Verification Required 🛡️',
        'LUPU requires all renters to complete identity document and live face verification before booking any vehicle.\n\nPlease verify your account in your Dashboard to proceed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify Identity Now',
            onPress: () => {
              setShowVehicleDetailModal(false);
              setCurrentTab('dashboard');
            },
          },
        ]
      );
      return;
    }

    // ── Driving License Requirement Check for Motor Vehicles ──
    const requiresDL = selectedVehicle.requiresDrivingLicense !== false;
    const hasValidDL =
      user.drivingLicenseVerified === true ||
      (user.documentType === 'driving_license' && (user.isVerified || user.documentStatus === 'verified'));

    if (requiresDL && !hasValidDL) {
      Alert.alert(
        'Driving License Required 🏍️',
        'This vehicle legally requires a valid Driving License on Indian public roads. Your profile is verified with Student ID or Aadhaar, but has no verified Driving License.\n\nPlease upload your Driving License in the verification portal.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload Driving License',
            onPress: () => {
              setShowVehicleDetailModal(false);
              setCurrentTab('dashboard');
            },
          },
        ]
      );
      return;
    }

    setSubmittingBooking(true);
    try {
      const startTime = pickupDt.toISOString();
      const endTime = returnDt.toISOString();

      const bookingPayload = {
        vehicleId: selectedVehicle._id || selectedVehicle.id,
        startTime,
        endTime,
        duration: rentalPricing.durationHours,
        paymentMethod: selectedPaymentMethod,
        pickupLocation: typeof selectedVehicle.location === 'string'
          ? selectedVehicle.location
          : (selectedVehicle.location?.address || 'Dibrugarh University Campus'),
        returnLocation: typeof selectedVehicle.location === 'string'
          ? selectedVehicle.location
          : (selectedVehicle.location?.address || 'Dibrugarh University Campus'),
        agreementAccepted: true,
        agreementVersion: '1.0',
        agreementAcceptedAt: new Date().toISOString(),
      };

      const res = await bookingAPI.create(bookingPayload);
      if (res.ok) {
        Alert.alert(
          'Booking Requested! 🎉',
          `Your booking request for ${selectedVehicle.name || 'this vehicle'} (${rentalPricing.durationLabel}) has been submitted to the owner for approval.`,
          [
            {
              text: 'View in Dashboard',
              onPress: () => {
                setShowVehicleDetailModal(false);
                setCurrentTab('dashboard');
              },
            },
            {
              text: 'Explore More',
              onPress: () => setShowVehicleDetailModal(false),
            },
          ]
        );
      } else {
        Alert.alert('Booking Error', res.error || 'Failed to submit booking request.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'An error occurred while creating booking.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  // If on login tab, render LoginScreen
  if (currentTab === 'login') {
    return (
      <LoginScreen
        onBack={() => setCurrentTab('explore')}
        onLoginSuccess={() => {
          setCurrentTab('explore');
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Top Navbar (Matches Website Navbar.jsx) ── */}
      <View style={styles.header}>
        {/* Official LUPU Brand Logo */}
        <LupuLogo size={36} showWordmark={true} />

        {/* Top Header Actions */}
        <View style={styles.headerActions}>
          {/* Emergency SOS Button */}
          <Pressable
            onPress={() =>
              Alert.alert(
                'LUPU Emergency SOS',
                'Emergency SOS gives instant access to campus security, local police, and 24/7 LUPU road assistance.'
              )
            }
            style={styles.sosButton}
          >
            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
            <Text style={styles.sosText}>SOS</Text>
          </Pressable>

          {/* Top Notification Bell Button */}
          <Pressable
            onPress={handleOpenNotifications}
            style={styles.notificationHeaderBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="bell" size={17} color={colors.textPrimary} />
            {unreadCount > 0 && <View style={styles.unreadBadgeDot} />}
          </Pressable>

          {/* User Account / Log In Button */}
          {isAuthenticated && user ? (
            <Pressable onPress={handleAccountOptions} style={styles.profileBadge}>
              <Feather name="user" size={15} color={colors.brand} />
              <Text style={styles.profileName} numberOfLines={1}>
                {(user.name || user.email || 'User').split(' ')[0]}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setCurrentTab('login')}
              style={styles.loginNavButton}
            >
              <Text style={styles.loginNavText}>Log in</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Main Screen View ── */}
      {currentTab === 'explore' ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomNavHeight + spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        >
          {/* Hero Banner Pill */}
          <View style={styles.heroPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.heroPillText}>Now live in Dibrugarh, Assam</Text>
          </View>

          {/* Heading */}
          <Text style={styles.mainTitle}>Explore Rentals</Text>
          <Text style={styles.subtitle}>
            {loadingVehicles
              ? 'Loading available vehicles...'
              : `${filteredVehicles.length} vehicles available for rent near you`}
          </Text>

          {/* Search Bar */}
          <Input
            placeholder="Search by vehicle name, area..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Feather name="search" size={18} color={colors.textMuted} />}
            style={styles.searchBar}
          />

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipActive,
                  ]}
                >
                  {cat.icon ? (
                    <MaterialCommunityIcons
                      name={cat.icon}
                      size={16}
                      color={isSelected ? '#FFFFFF' : colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.categoryText,
                      isSelected && styles.categoryTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Loading Indicator */}
          {loadingVehicles ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.stateText}>Finding rides near you...</Text>
            </View>
          ) : null}

          {/* Error / Offline State */}
          {!loadingVehicles && fetchError && vehicles.length === 0 ? (
            <View style={styles.stateContainer}>
              <Feather name="wifi-off" size={32} color={colors.danger} />
              <Text style={styles.stateTitle}>Unable to connect to LUPU</Text>
              <Text style={styles.stateText}>{fetchError}</Text>
              <Button
                title="Retry Connection"
                variant="outline"
                onPress={fetchLiveVehicles}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : null}

          {/* Empty State */}
          {!loadingVehicles && !fetchError && filteredVehicles.length === 0 ? (
            <View style={styles.stateContainer}>
              <MaterialCommunityIcons
                name="motorbike-off"
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.stateTitle}>No vehicles found</Text>
              <Text style={styles.stateText}>
                No vehicles match your current search or category filter.
              </Text>
              <Button
                title="Reset Filters"
                variant="outline"
                onPress={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : null}

          {/* Live Vehicle List */}
          {!loadingVehicles &&
            filteredVehicles.map((vehicle) => (
              <VehicleCardPreview
                key={vehicle._id || vehicle.id}
                vehicle={vehicle}
                onPress={() => {
                  setSelectedVehicle(vehicle);
                  setGalleryIndex(0);
                  setShowVehicleDetailModal(true);
                }}
              />
            ))}
        </ScrollView>
      ) : currentTab === 'dashboard' ? (
        <DashboardScreen
          onExplorePress={() => setCurrentTab('explore')}
          onLoginPress={() => setCurrentTab('login')}
          bottomNavHeight={bottomNavHeight}
        />
      ) : (
        <HowItWorksScreen bottomNavHeight={bottomNavHeight} />
      )}

      {/* ── Universal Responsive Bottom Navigation Bar ── */}
      <BottomNavigationBar
        currentTab={currentTab}
        onTabPress={(tab) => setCurrentTab(tab)}
        isAuthenticated={isAuthenticated}
        user={user}
        onAccountPress={handleAccountOptions}
      />

      {/* ── Notifications Slide-up Modal ── */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.notifModalOverlay}>
          <View style={styles.notifModalContent}>
            <View style={styles.notifModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="bell" size={20} color={colors.brand} />
                <Text style={styles.notifModalTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifCounterBadge}>
                    <Text style={styles.notifCounterText}>{unreadCount} new</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={() => setShowNotificationsModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.notifCloseBtn}
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {notifications.length > 0 && unreadCount > 0 && (
              <Pressable onPress={handleMarkAllNotificationsRead} style={styles.markReadRow}>
                <Text style={styles.markReadText}>Mark all as read</Text>
              </Pressable>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {notifications.length === 0 ? (
                <View style={styles.emptyNotifs}>
                  <MaterialCommunityIcons name="bell-sleep-outline" size={44} color={colors.textMuted} />
                  <Text style={styles.emptyNotifsTitle}>No notifications yet</Text>
                  <Text style={styles.emptyNotifsSub}>
                    We'll alert you about bookings, verifications, and payments here.
                  </Text>
                </View>
              ) : (
                notifications.map((item, idx) => {
                  const isUnread = !item.isRead && !item.read;
                  return (
                    <View
                      key={item._id || item.id || idx}
                      style={[styles.notifItem, isUnread && styles.notifItemUnread]}
                    >
                      <View style={styles.notifIconCircle}>
                        <Feather
                          name={
                            item.type === 'booking'
                              ? 'calendar'
                              : item.type === 'payment'
                              ? 'dollar-sign'
                              : 'info'
                          }
                          size={16}
                          color={colors.brand}
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <Text style={styles.notifTitle}>{item.title || 'Notification'}</Text>
                        <Text style={styles.notifMessage}>
                          {item.message || item.content || 'No details'}
                        </Text>
                        <Text style={styles.notifTime}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                        </Text>
                      </View>
                      {isUnread && <View style={styles.notifDot} />}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Account Profile Slide-up Modal ── */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <Pressable
          style={styles.profileModalOverlay}
          onPress={() => setShowProfileModal(false)}
        >
          <Pressable
            style={styles.profileModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.profileModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="shield" size={18} color={colors.brand} />
                <Text style={styles.profileModalTitle}>Account Profile</Text>
              </View>
              <Pressable
                onPress={() => setShowProfileModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.notifCloseBtn}
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Profile Hero Card */}
            <View style={styles.profileHeroCard}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarInitial}>
                  {(user?.name || user?.email || 'U')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.profileHeroName} numberOfLines={1}>
                  {user?.name || 'LUPU Member'}
                </Text>
                <Text style={styles.profileHeroEmail} numberOfLines={1}>
                  {user?.email || 'No email registered'}
                </Text>
                <View style={styles.profileBadgeRow}>
                  <View style={styles.roleTag}>
                    <Feather
                      name={user?.role === 'owner' ? 'briefcase' : 'compass'}
                      size={11}
                      color={colors.brand}
                    />
                    <Text style={styles.roleTagText}>
                      {user?.role === 'owner' ? 'Vehicle Owner' : 'Verified Renter'}
                    </Text>
                  </View>
                  <View style={styles.statusActiveTag}>
                    <View style={styles.statusDotGreen} />
                    <Text style={styles.statusActiveText}>
                      {user?.status === 'active' || !user?.status ? 'Active' : user.status}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Quick Summary Grid */}
            <View style={styles.profileGrid}>
              <View style={styles.profileGridItem}>
                <Text style={styles.profileGridLabel}>ROLE</Text>
                <Text style={styles.profileGridValue}>
                  {user?.role === 'owner' ? 'Owner' : 'Renter'}
                </Text>
              </View>
              <View style={styles.profileGridDivider} />
              <View style={styles.profileGridItem}>
                <Text style={styles.profileGridLabel}>LOCATION</Text>
                <Text style={styles.profileGridValue}>Dibrugarh</Text>
              </View>
              <View style={styles.profileGridDivider} />
              <View style={styles.profileGridItem}>
                <Text style={styles.profileGridLabel}>VERIFIED</Text>
                <Text style={[styles.profileGridValue, { color: '#10B981' }]}>
                  Firebase ✓
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.profileActionsContainer}>
              {currentTab !== 'dashboard' ? (
                <Pressable
                  style={styles.profilePrimaryActionBtn}
                  onPress={() => {
                    setShowProfileModal(false);
                    setCurrentTab('dashboard');
                  }}
                >
                  <Feather name="layout" size={17} color="#FFFFFF" />
                  <Text style={styles.profilePrimaryActionText}>Open Dashboard</Text>
                  <Feather name="arrow-right" size={15} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
                </Pressable>
              ) : (
                <Pressable
                  style={styles.profilePrimaryActionBtn}
                  onPress={() => {
                    setShowProfileModal(false);
                    setCurrentTab('explore');
                  }}
                >
                  <Feather name="compass" size={17} color="#FFFFFF" />
                  <Text style={styles.profilePrimaryActionText}>Browse Rentals</Text>
                  <Feather name="arrow-right" size={15} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
                </Pressable>
              )}

              <Pressable
                style={styles.profileSecondaryActionBtn}
                onPress={() => {
                  setShowProfileModal(false);
                  setCurrentTab('how-it-works');
                }}
              >
                <Feather name="help-circle" size={16} color={colors.textSecondary} />
                <Text style={styles.profileSecondaryActionText}>How LUPU Works</Text>
              </Pressable>

              <Pressable
                style={styles.profileLogoutActionBtn}
                onPress={handleLogout}
              >
                <Feather name="log-out" size={16} color={colors.sosRed} />
                <Text style={styles.profileLogoutActionText}>Log Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Vehicle Details & Booking Slide-up Sheet ── */}
      <Modal
        visible={showVehicleDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVehicleDetailModal(false)}
      >
        <Pressable
          style={styles.detailModalOverlay}
          onPress={() => setShowVehicleDetailModal(false)}
        >
          <Pressable
            style={[
              styles.detailModalContent,
              {
                paddingBottom: Math.max(insets?.bottom || 0, Platform.OS === 'android' ? 56 : 24),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {selectedVehicle && (
              <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ paddingBottom: spacing.md }}
              >
                {/* Header */}
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={styles.detailBrand}>
                      {selectedVehicle.brand || 'LUPU Ride'} {selectedVehicle.model ? `• ${selectedVehicle.model}` : ''}
                    </Text>
                    <Text style={styles.detailName}>{selectedVehicle.name || 'Rental Vehicle'}</Text>
                  </View>
                  <Pressable
                    onPress={() => setShowVehicleDetailModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.notifCloseBtn}
                  >
                    <Feather name="x" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>

                {/* Swipeable Vehicle Photo Gallery with Badges & Full-Screen Viewer */}
                <VehicleGallery
                  vehicle={selectedVehicle}
                  activeIndex={galleryIndex}
                  onIndexChange={setGalleryIndex}
                />

                {/* Key Specs Row */}
                <View style={styles.detailSpecsRow}>
                  <View style={styles.detailSpecCard}>
                    <Feather name="map-pin" size={14} color={colors.brand} />
                    <Text style={styles.detailSpecLabel}>Location</Text>
                    <Text style={styles.detailSpecValue} numberOfLines={1}>
                      {typeof selectedVehicle.location === 'string'
                        ? selectedVehicle.location
                        : selectedVehicle.location?.address || 'Dibrugarh'}
                    </Text>
                  </View>
                  <View style={styles.detailSpecCard}>
                    <MaterialCommunityIcons
                      name={selectedVehicle.type === 'scooty' ? 'moped' : 'motorbike'}
                      size={16}
                      color={colors.brand}
                    />
                    <Text style={styles.detailSpecLabel}>Category</Text>
                    <Text style={styles.detailSpecValue}>
                      {selectedVehicle.type === 'scooty' ? 'Scooter' : 'Motorcycle'}
                    </Text>
                  </View>
                  <View style={styles.detailSpecCard}>
                    <Feather name="shield" size={14} color="#10B981" />
                    <Text style={styles.detailSpecLabel}>Deposit</Text>
                    <Text style={[styles.detailSpecValue, { color: '#10B981' }]}>
                      ₹{selectedVehicle.securityDeposit || 0}
                    </Text>
                  </View>
                </View>

                {/* Registration & Host Info */}
                <View style={styles.detailInfoBox}>
                  <View style={styles.detailInfoItem}>
                    <Text style={styles.detailInfoTitle}>Registration No.</Text>
                    <Text style={styles.detailInfoSubtitle}>
                      {selectedVehicle.registrationNumber || 'AS06-REG-VERIFIED'}
                    </Text>
                  </View>
                  <View style={styles.detailInfoDivider} />
                  <View style={styles.detailInfoItem}>
                    <Text style={styles.detailInfoTitle}>Host / Partner</Text>
                    <Text style={styles.detailInfoSubtitle}>
                      {selectedVehicle.ownerName || selectedVehicle.ownerId?.name || 'Verified LUPU Partner'}
                    </Text>
                  </View>
                </View>

                {/* Custom Interactive Calendar & Time Selector */}
                <CustomDatePicker
                  pickupDateStr={pickupDateStr}
                  pickupTimeStr={pickupTimeStr}
                  returnDateStr={returnDateStr}
                  returnTimeStr={returnTimeStr}
                  existingBookings={vehicleBookings}
                  onChange={({ pickupDateStr: pD, pickupTimeStr: pT, returnDateStr: rD, returnTimeStr: rT }) => {
                    setPickupDateStr(pD);
                    setPickupTimeStr(pT);
                    setReturnDateStr(rD);
                    setReturnTimeStr(rT);
                  }}
                />

                {/* Price Breakdown */}
                <View style={styles.priceBreakdownCard}>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>
                      Rate ({rentalPricing.isDailyRate ? '₹/day' : '₹/hr'})
                    </Text>
                    <Text style={styles.priceBreakdownValue}>
                      {rentalPricing.rateLabel}
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>Duration</Text>
                    <Text style={[styles.priceBreakdownValue, { color: colors.brand, fontWeight: '700' }]}>
                      {rentalPricing.durationLabel}
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownLabel}>Security Deposit</Text>
                    <Text style={[styles.priceBreakdownValue, { color: '#10B981' }]}>
                      ₹{selectedVehicle.securityDeposit || 0} (Waived with Student ID)
                    </Text>
                  </View>
                  <View style={styles.priceBreakdownDivider} />
                  <View style={styles.priceBreakdownRow}>
                    <Text style={styles.priceBreakdownTotalLabel}>Estimated Total</Text>
                    <Text style={styles.priceBreakdownTotalValue}>
                      ₹{rentalPricing.totalPrice}
                    </Text>
                  </View>
                </View>

                {/* Mandatory Payment Method Selection */}
                <Text style={styles.detailSectionTitle}>Select Payment Method (Mandatory)</Text>
                <View style={styles.paymentMethodRow}>
                  <Pressable
                    onPress={() => setSelectedPaymentMethod('cash')}
                    style={[
                      styles.paymentMethodCard,
                      selectedPaymentMethod === 'cash' && styles.paymentMethodCardSelected,
                    ]}
                  >
                    <View style={styles.paymentMethodCardHeader}>
                      <MaterialCommunityIcons
                        name="cash-multiple"
                        size={20}
                        color={selectedPaymentMethod === 'cash' ? colors.brand : colors.textSecondary}
                      />
                      <View style={[styles.radioCircle, selectedPaymentMethod === 'cash' && styles.radioCircleActive]}>
                        {selectedPaymentMethod === 'cash' && <View style={styles.radioInnerCircle} />}
                      </View>
                    </View>
                    <Text style={[styles.paymentMethodTitle, selectedPaymentMethod === 'cash' && styles.paymentMethodTitleActive]}>
                      Direct Cash
                    </Text>
                    <Text style={styles.paymentMethodSubtitle}>
                      Pay physical cash upon pickup. Owner confirms in app.
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedPaymentMethod('online')}
                    style={[
                      styles.paymentMethodCard,
                      selectedPaymentMethod === 'online' && styles.paymentMethodCardSelected,
                    ]}
                  >
                    <View style={styles.paymentMethodCardHeader}>
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={20}
                        color={selectedPaymentMethod === 'online' ? colors.brand : colors.textSecondary}
                      />
                      <View style={[styles.radioCircle, selectedPaymentMethod === 'online' && styles.radioCircleActive]}>
                        {selectedPaymentMethod === 'online' && <View style={styles.radioInnerCircle} />}
                      </View>
                    </View>
                    <Text style={[styles.paymentMethodTitle, selectedPaymentMethod === 'online' && styles.paymentMethodTitleActive]}>
                      Pay Online
                    </Text>
                    <Text style={styles.paymentMethodSubtitle}>
                      Pay via UPI/Card after owner accepts your booking.
                    </Text>
                  </Pressable>
                </View>

                {/* Rental Agreement Checkbox */}
                <Pressable
                  onPress={() => setAgreementAccepted(!agreementAccepted)}
                  style={styles.agreementRow}
                >
                  <View
                    style={[
                      styles.agreementCheckbox,
                      agreementAccepted && styles.agreementCheckboxActive,
                    ]}
                  >
                    {agreementAccepted && <Feather name="check" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.agreementText}>
                    I agree to the{' '}
                    <Text style={{ color: colors.brand, fontWeight: '700' }}>
                      LUPU Self-Drive Rental Agreement & Terms
                    </Text>
                  </Text>
                </Pressable>

              </ScrollView>

              {/* Book Now Button — fixed footer outside ScrollView */}
              <View style={{ paddingTop: spacing.xs, paddingBottom: Platform.OS === 'android' ? 24 : 6 }}>
                <Pressable
                  onPress={handleCreateBooking}
                  disabled={submittingBooking || conflictInfo.hasConflict || rentalPricing.totalPrice <= 0}
                  style={[
                    styles.bookNowBtn,
                    { marginTop: spacing.xs },
                    (submittingBooking || conflictInfo.hasConflict || rentalPricing.totalPrice <= 0) && {
                      opacity: 0.6,
                      backgroundColor: conflictInfo.hasConflict ? '#2A2A2A' : colors.brand,
                    },
                  ]}
                >
                  {submittingBooking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather
                        name={conflictInfo.hasConflict ? 'alert-circle' : 'zap'}
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.bookNowBtnText}>
                        {conflictInfo.hasConflict
                          ? 'Vehicle Booked for Selected Time'
                          : `Request Ride • ₹${rentalPricing.totalPrice}`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sosRed,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    gap: 4,
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  loginNavButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  loginNavText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 120,
    gap: 5,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 92, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginRight: spacing.sm,
  },
  heroPillText: {
    color: colors.brand,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  searchBar: {
    marginBottom: spacing.md,
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  stateTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.sm,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bottomNavText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  bottomNavTextActive: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  notificationHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.brand,
    borderWidth: 1.5,
    borderColor: colors.surfaceLight,
  },
  notifModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  notifModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: '75%',
  },
  notifModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  notifModalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  notifCounterBadge: {
    backgroundColor: 'rgba(255, 92, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.3)',
  },
  notifCounterText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
  },
  notifCloseBtn: {
    padding: 6,
  },
  markReadRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
  },
  markReadText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyNotifs: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNotifsTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  emptyNotifsSub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.lg,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifItemUnread: {
    borderColor: 'rgba(255, 92, 0, 0.4)',
    backgroundColor: 'rgba(255, 92, 0, 0.05)',
  },
  notifIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  notifMessage: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  notifTime: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  notifDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.brand,
    marginTop: 4,
  },

  /* ── Profile Modal Styles ── */
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  profileModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3F4D',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileModalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  profileAvatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 92, 0, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: '800',
  },
  profileHeroName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  profileHeroEmail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.25)',
  },
  roleTagText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
  },
  statusActiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusActiveText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  profileGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  profileGridItem: {
    flex: 1,
    alignItems: 'center',
  },
  profileGridDivider: {
    width: 1,
    backgroundColor: colors.border,
    height: 24,
    alignSelf: 'center',
  },
  profileGridLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  profileGridValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  profileActionsContainer: {
    gap: 10,
  },
  profilePrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: 10,
  },
  profilePrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  profileSecondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: 10,
  },
  profileSecondaryActionText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  profileLogoutActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: 8,
    marginTop: 4,
  },
  profileLogoutActionText: {
    color: colors.sosRed,
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Vehicle Detail Modal Styles ── */
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: '#121214',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '90%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  detailBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailImageContainer: {
    position: 'relative',
    height: 190,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    marginBottom: spacing.md,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailBadgeRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  detailLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  detailLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  detailLiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailOwnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  detailOwnerBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  detailSpecsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailSpecCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  detailSpecLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  detailSpecValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailInfoBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailInfoItem: {
    flex: 1,
  },
  detailInfoTitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  detailInfoSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailInfoDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  durationSelectorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  durationChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  durationChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  priceBreakdownCard: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  priceBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  priceBreakdownLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceBreakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  priceBreakdownDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  priceBreakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  priceBreakdownTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: 2,
  },
  agreementCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  agreementCheckboxActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  agreementText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: spacing.sm,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookNowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentMethodCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  paymentMethodCardSelected: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(255, 107, 0, 0.08)',
  },
  paymentMethodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.brand,
  },
  radioInnerCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  paymentMethodTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  paymentMethodTitleActive: {
    color: colors.brand,
  },
  paymentMethodSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 14,
  },
});
