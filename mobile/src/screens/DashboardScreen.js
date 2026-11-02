import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Feather,
  MaterialCommunityIcons,
  Ionicons,
  FontAwesome5,
} from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import LupuLogo from '../components/common/LupuLogo';
import { useAuth } from '../context/AuthContext';
import {
  vehicleAPI,
  bookingAPI,
  paymentAPI,
  notificationAPI,
  userAPI,
  BASE_API_URL,
} from '../services/api';

/**
 * Optimizes thumbnail image URLs for mobile fleet display
 */
function resolveVehicleThumbnailUri(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.includes('res.cloudinary.com') && trimmed.includes('/image/upload/')) {
    const parts = trimmed.split('/image/upload/');
    const rest = (parts[1] || '').replace(/^v\d+\//, '');
    return `${parts[0]}/image/upload/f_auto,q_auto,w_200,c_fill,g_auto/${rest}`;
  }
  if (trimmed.startsWith('/')) {
    const host = BASE_API_URL ? BASE_API_URL.replace(/\/api\/?$/, '') : '';
    return `${host}${trimmed}`;
  }
  return trimmed;
}

/* ── Owner Tabs ── */
const OWNER_TABS = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'vehicles', label: 'My Vehicles', icon: 'package' },
  { key: 'bookings', label: 'Booking Requests', icon: 'calendar' },
  { key: 'earnings', label: 'Earnings', icon: 'dollar-sign' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
];

/* ── Renter Tabs ── */
const RENTER_TABS = [
  { key: 'overview', label: 'Overview', icon: 'trending-up' },
  { key: 'current', label: 'Current Booking', icon: 'clock' },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { key: 'completed', label: 'Completed', icon: 'check-circle' },
  { key: 'cancelled', label: 'Cancelled', icon: 'x-circle' },
  { key: 'payments', label: 'Payments', icon: 'dollar-sign' },
  { key: 'kyc', label: 'KYC Verification', icon: 'shield' },
];

const getEntityId = (entity) => {
  if (!entity) return null;
  if (typeof entity === 'string') return entity;
  if (entity._id) return entity._id.toString();
  if (entity.id) return entity.id.toString();
  return entity.toString ? entity.toString() : null;
};

const normalizeBooking = (b) => {
  if (!b) return null;
  const id = b._id || b.id;
  const status = (b.status || b.bookingStatus || 'pending').toLowerCase().trim();
  const paymentStatus = (b.paymentStatus || 'pending').toLowerCase().trim();
  const startTime = b.startTime || b.startDate || null;
  const endTime = b.endTime || b.endDate || null;
  const totalAmount = Number(b.totalAmount || b.pricing?.totalPrice || b.price || 0);
  const renterName = b.renterName || b.renterId?.name || b.userName || b.renterEmail || 'Verified Rider';
  const renterPhone = b.renterPhone || b.renterId?.phone || '';
  const renterEmail = b.renterEmail || b.renterId?.email || '';
  const vehicleName = b.vehicleName || b.vehicleId?.name || 'Rental Vehicle';
  const ownerId = getEntityId(b.ownerId);
  const renterId = getEntityId(b.renterId) || getEntityId(b.userId);

  return {
    ...b,
    _id: id,
    id,
    status,
    bookingStatus: status,
    paymentStatus,
    startTime,
    startDate: startTime,
    endTime,
    endDate: endTime,
    totalAmount,
    renterName,
    userName: renterName,
    renterPhone,
    renterEmail,
    vehicleName,
    ownerId,
    renterId,
  };
};

export default function DashboardScreen({ onExplorePress, onLoginPress, bottomNavHeight }) {
  const insets = useSafeAreaInsets();
  const effectiveBottomPadding =
    (bottomNavHeight || 56 + Math.max(insets.bottom, 0)) + spacing.xl;
  const { user, isAuthenticated, refreshUser } = useAuth();

  // Mode: 'renter' or 'owner' (defaults based on user role)
  const [mode, setMode] = useState(user?.role === 'owner' ? 'owner' : 'renter');
  const [activeTab, setActiveTab] = useState('overview');

  // Loading & Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Owner data
  const [ownerVehicles, setOwnerVehicles] = useState([]);
  const [ownerBookings, setOwnerBookings] = useState([]);
  const [ownerEarnings, setOwnerEarnings] = useState({ totalEarnings: 0, pendingEarnings: 0 });

  // Renter data
  const [renterBookings, setRenterBookings] = useState([]);
  const [renterPayments, setRenterPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Modals
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);

  // Cash Confirmation Modal State & Action Processing Lock
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashBooking, setCashBooking] = useState(null);
  const [cashNotes, setCashNotes] = useState('');
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState(null);

  // Details Modal States & Online Payment Loading
  const [selectedRenterBooking, setSelectedRenterBooking] = useState(null);
  const [selectedOwnerBooking, setSelectedOwnerBooking] = useState(null);
  const [payingOnlineId, setPayingOnlineId] = useState(null);

  // Add Vehicle Form State
  const [newVehicle, setNewVehicle] = useState({
    name: '',
    brand: '',
    model: '',
    registrationNumber: '',
    type: 'bike',
    pricePerHour: '49',
    pricePerDay: '500',
    location: 'Dibrugarh University',
    ownerPhone: '',
    photos: [],
  });
  const [photoInputText, setPhotoInputText] = useState('');
  const [submittingVehicle, setSubmittingVehicle] = useState(false);

  const handleAddPhoto = () => {
    const url = photoInputText.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP or HTTPS image URL.');
      return;
    }
    if (newVehicle.photos.includes(url)) {
      Alert.alert('Duplicate Photo', 'This photo has already been added.');
      return;
    }
    setNewVehicle((prev) => ({
      ...prev,
      photos: [...prev.photos, url],
    }));
    setPhotoInputText('');
  };

  const handleRemovePhoto = (index) => {
    setNewVehicle((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleOpenAddVehicle = () => {
    setNewVehicle((prev) => ({
      ...prev,
      ownerPhone: prev.ownerPhone || (user?.phone ? user.phone.replace(/^\+91/, '') : ''),
    }));
    setShowAddVehicleModal(true);
  };

  // KYC Form State
  const [kycType, setKycType] = useState('college_id'); // 'college_id' | 'aadhaar'
  const [kycDocNumber, setKycDocNumber] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  /* ── Fetch Live Dashboard Data ── */
  const fetchDashboardData = useCallback(async () => {
    try {
      const currentUserId = getEntityId(user?._id || user?.id);

      if (mode === 'owner') {
        const [vRes, bRes, eRes] = await Promise.all([
          vehicleAPI.getMyVehicles().catch(() => ({ ok: false, data: { vehicles: [] } })),
          bookingAPI.getOwnerBookings().catch(() => ({ ok: false, data: { bookings: [] } })),
          paymentAPI.getOwnerEarnings().catch(() => ({ ok: false, data: { totalEarnings: 0, pendingEarnings: 0 } })),
        ]);

        if (vRes.ok && Array.isArray(vRes.data?.vehicles)) {
          setOwnerVehicles(vRes.data.vehicles);
        }
        if (bRes.ok && Array.isArray(bRes.data?.bookings)) {
          const normalized = bRes.data.bookings.map(normalizeBooking).filter(Boolean);
          // Only show bookings where current authenticated user is the vehicle owner
          const ownerOnly = normalized.filter((b) => {
            const bOwnerId = getEntityId(b.ownerId);
            return Boolean(bOwnerId && currentUserId && bOwnerId === currentUserId);
          });
          setOwnerBookings(ownerOnly);
        }
        if (eRes.ok && eRes.data) {
          setOwnerEarnings(eRes.data);
        }
      } else {
        const [bRes, pRes, nRes] = await Promise.all([
          bookingAPI.getMyBookings().catch(() => ({ ok: false, data: { bookings: [] } })),
          paymentAPI.getHistory().catch(() => ({ ok: false, data: { payments: [] } })),
          notificationAPI.getAll().catch(() => ({ ok: false, data: { notifications: [] } })),
        ]);

        if (bRes.ok && Array.isArray(bRes.data?.bookings)) {
          const normalized = bRes.data.bookings.map(normalizeBooking).filter(Boolean);
          // Renter sees their own bookings
          const renterOnly = normalized.filter((b) => {
            const bRenterId = getEntityId(b.renterId);
            return !bRenterId || !currentUserId || bRenterId === currentUserId;
          });
          setRenterBookings(renterOnly);
        }
        if (pRes.ok && Array.isArray(pRes.data?.payments)) {
          setRenterPayments(pRes.data.payments);
        }
        if (nRes.ok && Array.isArray(nRes.data?.notifications)) {
          setNotifications(nRes.data.notifications);
        }
      }
    } catch (e) {
      console.warn('[Dashboard] Data fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, user]);

  useEffect(() => {
    setLoading(true);
    setActiveTab('overview');
    fetchDashboardData();
  }, [mode, fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  /* ── Owner Stats Computation ── */
  const totalVehiclesCount = ownerVehicles.length;
  const liveVehiclesCount = ownerVehicles.filter((v) => v.isLive !== false && (v.status === 'approved' || v.verificationStatus === 'approved')).length;
  const pendingVerifyCount = ownerVehicles.filter((v) => v.status === 'pending_verification' || v.verificationStatus === 'pending_verification' || v.verificationStatus === 'submitted').length;
  const rentedCount = ownerBookings.filter((b) => b.status === 'active' || b.status === 'ongoing').length;
  const offlineCount = ownerVehicles.filter((v) => v.isLive === false).length;
  const totalRequestsCount = ownerBookings.length;
  const pendingRequestsCount = ownerBookings.filter((b) => b.status === 'pending' || b.status === 'requested').length;
  const totalEarningsAmt = ownerEarnings.totalEarnings || 0;
  const pendingEarningsAmt = ownerEarnings.pendingEarnings || 0;

  /* ── Renter Stats Computation ── */
  const activeRentalsCount = renterBookings.filter((b) => b.status === 'active' || b.status === 'ongoing').length;
  const upcomingRentalsCount = renterBookings.filter((b) => b.status === 'accepted' || b.status === 'pending' || b.status === 'requested' || b.status === 'confirmed').length;
  const completedRentalsCount = renterBookings.filter((b) => b.status === 'completed').length;
  const cancelledRentalsCount = renterBookings.filter((b) => b.status === 'cancelled' || b.status === 'rejected').length;
  const savedVehiclesCount = 0;
  const totalSpentAmt = renterBookings
    .filter((b) => b.status === 'completed' || b.status === 'active' || b.status === 'ongoing')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  /* ── Actions ── */
  const handleToggleVehicleStatus = async (vehicleId, currentLive, verificationStatus) => {
    if (verificationStatus && verificationStatus !== 'approved') {
      Alert.alert(
        'Verification In Progress',
        `This vehicle is currently marked as "${verificationStatus === 'draft' ? 'Draft' : 'Pending Verification'}". Once approved by the LUPU admin team, you can toggle it LIVE for public rentals.`
      );
      return;
    }
    try {
      const res = await vehicleAPI.toggleStatus(vehicleId);
      if (res.ok) {
        Alert.alert('Status Updated', `Vehicle is now ${currentLive ? 'OFFLINE' : 'LIVE'}`);
        fetchDashboardData();
      } else {
        Alert.alert('Update Failed', res.error || 'Could not change vehicle status');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleBookingAction = async (bookingId, action) => {
    if (processingBookingId) return;
    setProcessingBookingId(bookingId);
    const targetStatus = action === 'accept' ? 'accepted' : 'rejected';
    try {
      const res = await bookingAPI.updateStatus(bookingId, targetStatus);
      if (res.ok) {
        Alert.alert('Success', `Booking request has been ${targetStatus}.`);
        fetchDashboardData();
      } else {
        Alert.alert('Action Failed', res.error || `Could not ${action} booking.`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handlePayOnline = async (booking) => {
    const bookingId = booking._id || booking.id;
    try {
      setPayingOnlineId(bookingId);
      const orderRes = await paymentAPI.createOnlineOrder({ bookingId });
      if (!orderRes.ok) {
        Alert.alert('Payment Error', orderRes.error || 'Failed to initiate payment.');
        return;
      }

      const verifyRes = await paymentAPI.verifyOnlinePayment({
        bookingId,
        orderId: orderRes.data?.orderId,
        paymentId: `PAY_MOB_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        notes: 'Mobile App Online Checkout Verification',
      });

      if (verifyRes.ok) {
        Alert.alert('Payment Confirmed! 🎉', 'Your online payment was received and verified. Have a safe ride!');
        fetchDashboardData();
        if (selectedRenterBooking && (selectedRenterBooking._id === bookingId || selectedRenterBooking.id === bookingId)) {
          setSelectedRenterBooking((prev) => ({ ...prev, paymentStatus: 'paid' }));
        }
      } else {
        Alert.alert('Verification Failed', verifyRes.error || 'Could not verify payment.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Payment initiation failed.');
    } finally {
      setPayingOnlineId(null);
    }
  };

  const openCashConfirmation = (booking) => {
    setCashBooking(booking);
    setCashNotes('');
    setShowCashModal(true);
  };

  const handleConfirmCashPayment = async () => {
    if (!cashBooking || confirmingCash) return;
    setConfirmingCash(true);
    try {
      const res = await paymentAPI.recordOffline({
        bookingId: cashBooking._id,
        amount: cashBooking.totalAmount,
        paymentPurpose: 'rental',
        notes: cashNotes.trim(),
      });

      if (res.ok) {
        const refId = res.data?.payment?.referenceId || 'LUPU-PAY';
        const amount = res.data?.payment?.amount || cashBooking.totalAmount;
        Alert.alert(
          'Cash Payment Confirmed! 🎉',
          `₹${amount} recorded successfully.\nReference ID: ${refId}\nThe renter has been notified.`
        );
        setShowCashModal(false);
        setCashBooking(null);
        setCashNotes('');
        fetchDashboardData();
      } else {
        Alert.alert('Payment Confirmation Failed', res.error || 'Could not record cash payment.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setConfirmingCash(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          const res = await bookingAPI.cancel(bookingId, 'User requested cancellation');
          if (res.ok) {
            Alert.alert('Cancelled', 'Your booking was cancelled.');
            fetchDashboardData();
          } else {
            Alert.alert('Error', res.error || 'Failed to cancel booking');
          }
        },
      },
    ]);
  };

  const handleCreateVehicle = async (submitMode = 'submit') => {
    const vName = (newVehicle.name || '').trim();
    const vBrand = (newVehicle.brand || '').trim();
    const vModel = (newVehicle.model || '').trim() || vName || 'Standard';
    const vReg = (newVehicle.registrationNumber || '').trim().toUpperCase();
    const vLocation = (newVehicle.location || '').trim() || 'Dibrugarh University';
    const vPriceHour = Number(newVehicle.pricePerHour) || 49;
    const vPriceDay = Number(newVehicle.pricePerDay) || (vPriceHour * 10);
    const rawPhone = (newVehicle.ownerPhone || user?.phone || '').trim();

    if (!vName || !vBrand) {
      Alert.alert('Missing Details', 'Please enter at least the vehicle name and manufacturer / brand.');
      return;
    }

    if (vPriceHour <= 0) {
      Alert.alert('Invalid Price', 'Price per hour must be greater than zero.');
      return;
    }

    if (submitMode === 'submit') {
      if (!vReg) {
        Alert.alert('Registration Number Required', 'Please enter your vehicle registration number (e.g. AS-06-AB-1234).');
        return;
      }

      const phoneDigits = rawPhone.replace(/[\s\-\(\)\+]/g, '').slice(-10);
      if (!phoneDigits || phoneDigits.length !== 10 || !/^[6-9]\d{9}$/.test(phoneDigits)) {
        Alert.alert(
          'Valid Mobile Number Required',
          'Please enter a valid 10-digit Indian phone number (e.g. 9876543210) for owner verification and contact.'
        );
        return;
      }

      setSubmittingVehicle(true);
      try {
        const defaultPhotos = newVehicle.type === 'scooty'
          ? [
              'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=800&auto=format&fit=crop&q=80',
            ]
          : [
              'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=800&auto=format&fit=crop&q=80',
            ];

        let userPhotos = Array.isArray(newVehicle.photos) ? [...newVehicle.photos] : [];
        if (photoInputText.trim() && /^https?:\/\//i.test(photoInputText.trim())) {
          userPhotos.push(photoInputText.trim());
        }
        let padIdx = 0;
        while (userPhotos.length < 3) {
          userPhotos.push(defaultPhotos[padIdx % defaultPhotos.length]);
          padIdx++;
        }

        const payload = {
          name: vName,
          brand: vBrand,
          model: vModel,
          registrationNumber: vReg,
          type: newVehicle.type,
          pricePerHour: vPriceHour,
          pricePerDay: vPriceDay,
          securityDeposit: 0,
          location: vLocation,
          description: `Verified ${vBrand} ${vName} available for self-drive rental in Dibrugarh.`,
          verificationStatus: 'submitted',
          ownerName: (user?.name || 'Vehicle Owner').trim(),
          ownerPhone: phoneDigits,
          photos: userPhotos,
          documents: {
            RC: 'https://lupu.in/docs/rc_pending_review.pdf',
            Insurance: 'https://lupu.in/docs/insurance_pending_review.pdf',
            PUC: 'https://lupu.in/docs/puc_pending_review.pdf',
          },
        };

        const res = await vehicleAPI.create(payload);
        if (res.ok) {
          Alert.alert(
            'Vehicle Submitted! 🎉',
            'Your vehicle has been submitted for admin verification and added to your fleet.'
          );
          setShowAddVehicleModal(false);
          setNewVehicle({
            name: '',
            brand: '',
            model: '',
            registrationNumber: '',
            type: 'bike',
            pricePerHour: '49',
            pricePerDay: '500',
            location: 'Dibrugarh University',
            ownerPhone: user?.phone ? user.phone.replace(/^\+91/, '') : '',
            photos: [],
          });
          setPhotoInputText('');
          setActiveTab('vehicles');
          fetchDashboardData();
        } else {
          Alert.alert('Submission Error', res.error || 'Failed to list vehicle.');
        }
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setSubmittingVehicle(false);
      }
    } else {
      // Save as Draft
      setSubmittingVehicle(true);
      try {
        const fallbackReg = vReg || `AS06DRAFT${Date.now().toString().slice(-4)}`;
        const defaultPhotos = newVehicle.type === 'scooty'
          ? [
              'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=800&auto=format&fit=crop&q=80',
            ]
          : [
              'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&auto=format&fit=crop&q=80',
              'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=800&auto=format&fit=crop&q=80',
            ];

        let userPhotos = Array.isArray(newVehicle.photos) ? [...newVehicle.photos] : [];
        if (photoInputText.trim() && /^https?:\/\//i.test(photoInputText.trim())) {
          userPhotos.push(photoInputText.trim());
        }
        let padIdx = 0;
        while (userPhotos.length < 3) {
          userPhotos.push(defaultPhotos[padIdx % defaultPhotos.length]);
          padIdx++;
        }

        const payload = {
          name: vName,
          brand: vBrand,
          model: vModel,
          registrationNumber: fallbackReg,
          type: newVehicle.type,
          pricePerHour: vPriceHour,
          pricePerDay: vPriceDay,
          securityDeposit: 0,
          location: vLocation,
          description: `Draft listing for ${vBrand} ${vName}.`,
          verificationStatus: 'draft',
          photos: userPhotos,
        };

        const res = await vehicleAPI.create(payload);
        if (res.ok) {
          Alert.alert(
            'Draft Saved 📝',
            'Your vehicle draft has been saved to your fleet.'
          );
          setShowAddVehicleModal(false);
          setNewVehicle({
            name: '',
            brand: '',
            model: '',
            registrationNumber: '',
            type: 'bike',
            pricePerHour: '49',
            pricePerDay: '500',
            location: 'Dibrugarh University',
            ownerPhone: user?.phone ? user.phone.replace(/^\+91/, '') : '',
            photos: [],
          });
          setPhotoInputText('');
          setActiveTab('vehicles');
          fetchDashboardData();
        } else {
          Alert.alert('Save Draft Error', res.error || 'Failed to save vehicle draft.');
        }
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setSubmittingVehicle(false);
      }
    }
  };

  const handleSubmitKyc = async () => {
    if (!kycDocNumber.trim()) {
      Alert.alert('Missing ID', 'Please enter your document ID / registration number.');
      return;
    }
    setSubmittingKyc(true);
    try {
      const res = await userAPI.submitKyc({
        kycType,
        documentNumber: kycDocNumber.trim(),
      });
      if (res.ok) {
        Alert.alert(
          'KYC Verified',
          'Your identity has been verified! You can now rent or list vehicles immediately.'
        );
        setShowKycModal(false);
        setKycDocNumber('');
        if (refreshUser) refreshUser();
      } else {
        Alert.alert('KYC Error', res.error || 'Failed to update KYC status.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingKyc(false);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.guestContainer}>
        <View style={styles.guestIconCircle}>
          <MaterialCommunityIcons name="shield-account" size={44} color={colors.brand} />
        </View>
        <Text style={styles.guestTitle}>Sign in to your Dashboard</Text>
        <Text style={styles.guestSubtitle}>
          View your active rentals, list your vehicle, check owner earnings, and complete KYC verification.
        </Text>
        <Button
          title="Log In / Sign Up"
          onPress={onLoginPress}
          style={styles.guestLoginBtn}
        />
        <Pressable onPress={onExplorePress} style={styles.guestExploreBtn}>
          <Text style={styles.guestExploreText}>Explore available vehicles first</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      {/* ── Mode Switcher Bar (Renter vs Owner) ── */}
      <View style={styles.modeBar}>
        <View style={styles.modeBarInfo}>
          <Text style={styles.modeBarLabel}>DASHBOARD MODE</Text>
          <Text style={styles.modeBarSub}>
            {mode === 'owner' ? 'Managing listings & bookings' : 'Managing your rentals & rides'}
          </Text>
        </View>

        {/* Mode Switcher Pill */}
        <View style={styles.modeSwitchWrapper}>
          <Pressable
            onPress={() => {
              setMode('renter');
              setActiveTab('overview');
            }}
            style={[styles.modeSwitchBtn, mode === 'renter' && styles.modeSwitchActive]}
          >
            <MaterialCommunityIcons
              name="motorbike"
              size={15}
              color={mode === 'renter' ? '#FFFFFF' : colors.textMuted}
            />
            <Text style={[styles.modeSwitchText, mode === 'renter' && styles.modeSwitchTextActive]}>
              Renter
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode('owner');
              setActiveTab('overview');
            }}
            style={[styles.modeSwitchBtn, mode === 'owner' && styles.modeSwitchActive]}
          >
            <MaterialCommunityIcons
              name="storefront-outline"
              size={15}
              color={mode === 'owner' ? '#FFFFFF' : colors.textMuted}
            />
            <Text style={[styles.modeSwitchText, mode === 'owner' && styles.modeSwitchTextActive]}>
              Owner
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: effectiveBottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* ── Title & Context Header ── */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={styles.dashboardTitle}>
              {mode === 'owner' ? 'Owner Dashboard' : 'Renter Dashboard'}
            </Text>
            <Text style={styles.dashboardSubtitle}>
              Welcome back, {user?.name || user?.email?.split('@')[0] || 'Rider'} 👋
            </Text>
          </View>

          {mode === 'owner' ? (
            <Pressable
              onPress={handleOpenAddVehicle}
              style={styles.listVehicleBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.listVehicleBtnText}>List Vehicle</Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Horizontal Navigation Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.tabBar}
        >
          {(mode === 'owner' ? OWNER_TABS : RENTER_TABS).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Feather
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={styles.loadingText}>Loading dashboard metrics...</Text>
          </View>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════
                OWNER DASHBOARD VIEWS
                ═══════════════════════════════════════════════ */}
            {mode === 'owner' && (
              <>
                {/* ── Overview Tab ── */}
                {activeTab === 'overview' && (
                  <>
                    {/* 2-Column Stat Grid (8 Cards matching website) */}
                    <View style={styles.statsGrid}>
                      <StatMetricCard
                        label="Total Vehicles"
                        value={totalVehiclesCount}
                        icon="cube-outline"
                        iconColor="#3B82F6"
                        iconBg="rgba(59, 130, 246, 0.15)"
                      />
                      <StatMetricCard
                        label="Live Vehicles"
                        value={liveVehiclesCount}
                        icon="check-circle-outline"
                        iconColor="#22C55E"
                        iconBg="rgba(34, 197, 94, 0.15)"
                      />
                      <StatMetricCard
                        label="Pending Verification"
                        value={pendingVerifyCount}
                        icon="clock-time-four-outline"
                        iconColor="#EAB308"
                        iconBg="rgba(234, 179, 8, 0.15)"
                      />
                      <StatMetricCard
                        label="Currently Rented"
                        value={rentedCount}
                        icon="play-circle-outline"
                        iconColor="#FF5C00"
                        iconBg="rgba(255, 92, 0, 0.15)"
                      />
                      <StatMetricCard
                        label="Offline Vehicles"
                        value={offlineCount}
                        icon="close-circle-outline"
                        iconColor="#EF4444"
                        iconBg="rgba(239, 68, 68, 0.15)"
                      />
                      <StatMetricCard
                        label="Total Requests"
                        value={totalRequestsCount}
                        icon="calendar-month-outline"
                        iconColor="#A855F7"
                        iconBg="rgba(168, 85, 247, 0.15)"
                      />
                      <StatMetricCard
                        label="Total Earnings"
                        value={`₹${totalEarningsAmt}`}
                        icon="trending-up"
                        iconColor="#22C55E"
                        iconBg="rgba(34, 197, 94, 0.15)"
                      />
                      <StatMetricCard
                        label="Pending Earnings"
                        value={`₹${pendingEarningsAmt}`}
                        icon="currency-inr"
                        iconColor="#EAB308"
                        iconBg="rgba(234, 179, 8, 0.15)"
                      />
                    </View>

                    {/* Recent Activity Header */}
                    <View style={styles.sectionHeaderRow}>
                      <MaterialCommunityIcons name="pulse" size={18} color={colors.brand} />
                      <Text style={styles.sectionTitle}>Recent Activity</Text>
                    </View>

                    {ownerBookings.length === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="clock" size={36} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No recent activity</Text>
                        <Text style={styles.emptyCardText}>
                          When customers request or rent your vehicles, you will see real-time updates here.
                        </Text>
                      </Card>
                    ) : (
                      ownerBookings.slice(0, 5).map((booking) => (
                        <Pressable
                          key={booking._id || booking.id}
                          onPress={() => setSelectedOwnerBooking(booking)}
                          style={{ width: '100%' }}
                        >
                          <Card style={styles.activityCard}>
                            <View style={styles.activityIconCircle}>
                              <MaterialCommunityIcons name="motorbike" size={20} color={colors.brand} />
                            </View>
                            <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                              <Text style={styles.activityVehicleName}>
                                {booking.vehicleName || 'Vehicle Rental'}
                              </Text>
                              <Text style={styles.activitySubtitle}>
                                {booking.userName || booking.userEmail || 'Customer'} •{' '}
                                {new Date(booking.createdAt || Date.now()).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <View
                                style={[
                                  styles.statusBadge,
                                  booking.bookingStatus === 'accepted' || booking.bookingStatus === 'ongoing'
                                    ? styles.statusBadgeGreen
                                    : booking.bookingStatus === 'rejected' || booking.bookingStatus === 'cancelled'
                                    ? styles.statusBadgeRed
                                    : styles.statusBadgeYellow,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    booking.bookingStatus === 'accepted' || booking.bookingStatus === 'ongoing'
                                      ? styles.statusTextGreen
                                      : booking.bookingStatus === 'rejected' || booking.bookingStatus === 'cancelled'
                                      ? styles.statusTextRed
                                      : styles.statusTextYellow,
                                  ]}
                                >
                                  {booking.bookingStatus || 'Pending'}
                                </Text>
                              </View>
                              <Text style={styles.activityAmount}>
                                ₹{booking.totalAmount || booking.pricing?.totalPrice || 0}
                              </Text>
                            </View>
                          </Card>
                        </Pressable>
                      ))
                    )}
                  </>
                )}

                {/* ── My Vehicles Tab ── */}
                {activeTab === 'vehicles' && (
                  <View>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>
                        Your Fleet ({ownerVehicles.length})
                      </Text>
                    </View>

                    {ownerVehicles.length === 0 ? (
                      <Card style={styles.emptyCard}>
                        <MaterialCommunityIcons name="motorbike-off" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No vehicles listed yet</Text>
                        <Text style={styles.emptyCardText}>
                          Earn up to ₹15,000/month by hosting your bike or scooter in Dibrugarh.
                        </Text>
                        <Button
                          title="+ List Your First Vehicle"
                          onPress={handleOpenAddVehicle}
                          style={{ marginTop: spacing.md }}
                        />
                      </Card>
                    ) : (
                      ownerVehicles.map((vehicle) => {
                        const isLive = vehicle.isLive !== false;
                        const vStatus = vehicle.verificationStatus || vehicle.status || 'draft';
                        const isApproved = vStatus === 'approved';
                        const isDraft = vStatus === 'draft';
                        return (
                          <Card key={vehicle._id || vehicle.id} style={styles.vehicleItemCard}>
                            <View style={styles.vehicleItemRow}>
                              <View style={styles.vehicleThumbnail}>
                                {(() => {
                                  const thumbUrl = resolveVehicleThumbnailUri(vehicle.images?.[0] || vehicle.photos?.[0]);
                                  return thumbUrl ? (
                                    <Image
                                      source={{ uri: thumbUrl }}
                                      style={styles.vehicleImage}
                                    />
                                  ) : (
                                    <MaterialCommunityIcons
                                      name="motorbike"
                                      size={28}
                                      color={colors.textMuted}
                                    />
                                  );
                                })()}
                              </View>
                              <View style={{ flex: 1, marginLeft: spacing.md }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={styles.vehicleItemTitle}>
                                    {vehicle.brand} {vehicle.name}
                                  </Text>
                                  <View
                                    style={[
                                      styles.statusBadge,
                                      isApproved
                                        ? styles.statusBadgeGreen
                                        : isDraft
                                        ? styles.statusBadgeGray
                                        : styles.statusBadgeYellow,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        isApproved
                                          ? styles.statusTextGreen
                                          : isDraft
                                          ? styles.statusTextGray
                                          : styles.statusTextYellow,
                                      ]}
                                    >
                                      {isApproved ? 'Approved' : isDraft ? 'Draft' : 'In Review'}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.vehicleItemReg}>
                                  Reg: {vehicle.registrationNumber || 'Pending'}
                                </Text>
                                <Text style={styles.vehicleItemRate}>
                                  ₹{vehicle.pricePerHour || vehicle.pricing?.hourly}/hr • ₹{vehicle.pricePerDay || vehicle.pricing?.daily || 0}/day
                                </Text>
                                <Text style={styles.vehicleItemLocation}>
                                  📍 {typeof vehicle.location === 'string' ? vehicle.location : vehicle.location?.address || 'Dibrugarh'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.vehicleItemFooter}>
                              <Pressable
                                onPress={() => handleToggleVehicleStatus(vehicle._id || vehicle.id, isLive, vStatus)}
                                style={[styles.toggleBtn, isLive && isApproved ? styles.toggleLive : styles.toggleOffline]}
                              >
                                <View style={[styles.dot, isLive && isApproved ? styles.dotLive : styles.dotOffline]} />
                                <Text style={[styles.toggleText, isLive && isApproved ? styles.toggleTextLive : styles.toggleTextOffline]}>
                                  {isLive && isApproved ? 'LIVE' : 'OFFLINE'}
                                </Text>
                              </Pressable>

                              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                <Pressable
                                  onPress={() =>
                                    Alert.alert(
                                      'Vehicle Verification Details',
                                      `Vehicle: ${vehicle.brand} ${vehicle.name}\nRegistration: ${vehicle.registrationNumber || 'N/A'}\nStatus: ${
                                        isApproved
                                          ? 'Approved & Ready for Rent'
                                          : isDraft
                                          ? 'Draft (Saved locally in fleet)'
                                          : 'Submitted & Under Admin Review'
                                      }\nRates: ₹${vehicle.pricePerHour || 49}/hr • ₹${vehicle.pricePerDay || 500}/day`
                                    )
                                  }
                                  style={styles.actionIconBtn}
                                >
                                  <Feather name="info" size={16} color={colors.textSecondary} />
                                </Pressable>
                              </View>
                            </View>
                          </Card>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ── Booking Requests Tab ── */}
                {activeTab === 'bookings' && (
                  <View>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>
                        Incoming Requests ({ownerBookings.length})
                      </Text>
                    </View>

                    {ownerBookings.length === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="calendar" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No booking requests yet</Text>
                        <Text style={styles.emptyCardText}>
                          When riders request your vehicles, pending approvals will show here.
                        </Text>
                      </Card>
                    ) : (
                      ownerBookings.map((b) => {
                        const isPending = b.status === 'pending' || b.status === 'requested';
                        const isAccepted = b.status === 'accepted';
                        const isActive = b.status === 'active' || b.status === 'ongoing' || b.status === 'confirmed';
                        const isPaid = b.paymentStatus === 'paid';
                        const isProcessing = processingBookingId === b._id;

                        return (
                          <Card key={b._id || b.id} style={styles.bookingCard}>
                            <View style={styles.bookingCardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.bookingVehicleName}>{b.vehicleName || 'Rental Request'}</Text>
                                <Text style={styles.bookingCustomer}>
                                  Customer: {b.renterName || 'Verified Rider'}
                                </Text>
                                {b.renterPhone ? (
                                  <Text style={styles.bookingPhoneText}>
                                    📞 {b.renterPhone}
                                  </Text>
                                ) : null}
                              </View>
                              <Text style={styles.bookingPrice}>₹{b.totalAmount || 0}</Text>
                            </View>

                            <View style={styles.bookingDetailsRow}>
                              <Text style={styles.bookingDateText}>
                                📅 {new Date(b.startTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → {new Date(b.endTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </Text>
                              <View
                                style={[
                                  styles.statusBadge,
                                  isPending
                                    ? styles.statusBadgeYellow
                                    : isAccepted
                                    ? styles.statusBadgeBlue
                                    : isActive
                                    ? styles.statusBadgeGreen
                                    : b.status === 'rejected'
                                    ? styles.statusBadgeRed
                                    : styles.statusBadgeGray,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    isPending
                                      ? styles.statusTextYellow
                                      : isAccepted
                                      ? styles.statusTextBlue
                                      : isActive
                                      ? styles.statusTextGreen
                                      : b.status === 'rejected'
                                      ? styles.statusTextRed
                                      : styles.statusTextMuted,
                                  ]}
                                >
                                  {isPending
                                    ? 'Pending Approval'
                                    : isAccepted
                                    ? 'Accepted'
                                    : isActive
                                    ? 'Active Trip'
                                    : b.status === 'rejected'
                                    ? 'Declined'
                                    : b.status === 'completed'
                                    ? 'Completed'
                                    : b.status}
                                </Text>
                              </View>
                            </View>

                            {/* Payment Status indicator row */}
                            <View style={[styles.bookingDetailsRow, { marginTop: 6 }]}>
                              <Text style={styles.bookingPaymentLabel}>
                                Payment: {isPaid ? 'Cash Received' : 'Cash on Handover'}
                              </Text>
                              <View
                                style={[
                                  styles.statusBadge,
                                  isPaid ? styles.statusBadgeGreen : styles.statusBadgeYellow,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    isPaid ? styles.statusTextGreen : styles.statusTextYellow,
                                  ]}
                                >
                                  {isPaid ? 'Paid' : 'Unpaid'}
                                </Text>
                              </View>
                            </View>

                            {/* Accept / Reject actions for Pending bookings */}
                            {isPending ? (
                              <View style={styles.bookingActionRow}>
                                <Pressable
                                  onPress={() => handleBookingAction(b._id, 'accept')}
                                  disabled={isProcessing}
                                  style={[styles.acceptBtn, isProcessing && { opacity: 0.6 }]}
                                >
                                  {isProcessing ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <>
                                      <Feather name="check" size={15} color="#FFFFFF" />
                                      <Text style={styles.acceptBtnText}>Accept</Text>
                                    </>
                                  )}
                                </Pressable>
                                <Pressable
                                  onPress={() => handleBookingAction(b._id, 'reject')}
                                  disabled={isProcessing}
                                  style={[styles.rejectBtn, isProcessing && { opacity: 0.6 }]}
                                >
                                  <Feather name="x" size={15} color="#FFFFFF" />
                                  <Text style={styles.rejectBtnText}>Decline</Text>
                                </Pressable>
                              </View>
                            ) : null}

                            {/* Manual Cash Payment Confirmation for Accepted / Active bookings */}
                            {(isAccepted || isActive) && !isPaid ? (
                              <View style={{ marginTop: spacing.sm }}>
                                <Pressable
                                  onPress={() => openCashConfirmation(b)}
                                  disabled={isProcessing}
                                  style={styles.cashConfirmBtn}
                                >
                                  <MaterialCommunityIcons name="cash-check" size={18} color="#FFFFFF" />
                                  <Text style={styles.cashConfirmBtnText}>
                                    Confirm Cash Received (₹{b.totalAmount || 0})
                                  </Text>
                                </Pressable>
                              </View>
                            ) : null}

                            {/* Verified Cash Badge if Paid */}
                            {isPaid ? (
                              <View style={styles.cashVerifiedRow}>
                                <MaterialCommunityIcons name="check-decagram" size={16} color="#22C55E" />
                                <Text style={styles.cashVerifiedText}>
                                  Cash payment of ₹{b.totalAmount || 0} confirmed & recorded
                                </Text>
                              </View>
                            ) : null}
                          </Card>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ── Earnings Tab ── */}
                {activeTab === 'earnings' && (
                  <View>
                    <Card style={styles.earningsSummaryCard}>
                      <Text style={styles.earningsSummaryLabel}>Total Lifetime Earnings</Text>
                      <Text style={styles.earningsSummaryAmount}>₹{totalEarningsAmt}</Text>
                      <Text style={styles.earningsSummarySub}>
                        Pending clearance: ₹{pendingEarningsAmt}
                      </Text>
                    </Card>

                    <Card style={[styles.emptyCard, { marginTop: spacing.md }]}>
                      <MaterialCommunityIcons name="bank-transfer" size={38} color={colors.brand} />
                      <Text style={styles.emptyCardTitle}>Direct Bank Payouts</Text>
                      <Text style={styles.emptyCardText}>
                        LUPU processes verified owner earnings directly to UPI or Bank Account every Monday.
                      </Text>
                    </Card>
                  </View>
                )}

                {/* ── Notifications Tab ── */}
                {activeTab === 'notifications' && (
                  <View>
                    <Card style={styles.emptyCard}>
                      <Feather name="bell" size={40} color={colors.textMuted} />
                      <Text style={styles.emptyCardTitle}>All Caught Up</Text>
                      <Text style={styles.emptyCardText}>
                        No unread owner alerts or security updates right now.
                      </Text>
                    </Card>
                  </View>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════
                RENTER DASHBOARD VIEWS
                ═══════════════════════════════════════════════ */}
            {mode === 'renter' && (
              <>
                {/* ── Overview Tab ── */}
                {activeTab === 'overview' && (
                  <>
                    {/* 2-Column Stat Grid (6 Cards matching website) */}
                    <View style={styles.statsGrid}>
                      <StatMetricCard
                        label="Active Rentals"
                        value={activeRentalsCount}
                        icon="clock-time-four-outline"
                        iconColor="#FF5C00"
                        iconBg="rgba(255, 92, 0, 0.15)"
                      />
                      <StatMetricCard
                        label="Upcoming"
                        value={upcomingRentalsCount}
                        icon="calendar-month-outline"
                        iconColor="#EAB308"
                        iconBg="rgba(234, 179, 8, 0.15)"
                      />
                      <StatMetricCard
                        label="Completed"
                        value={completedRentalsCount}
                        icon="check-circle-outline"
                        iconColor="#22C55E"
                        iconBg="rgba(34, 197, 94, 0.15)"
                      />
                      <StatMetricCard
                        label="Cancelled"
                        value={cancelledRentalsCount}
                        icon="close-circle-outline"
                        iconColor="#EF4444"
                        iconBg="rgba(239, 68, 68, 0.15)"
                      />
                      <StatMetricCard
                        label="Saved Vehicles"
                        value={savedVehiclesCount}
                        icon="heart-outline"
                        iconColor="#EC4899"
                        iconBg="rgba(236, 72, 153, 0.15)"
                      />
                      <StatMetricCard
                        label="Total Spent"
                        value={`₹${totalSpentAmt}`}
                        icon="currency-inr"
                        iconColor="#22C55E"
                        iconBg="rgba(34, 197, 94, 0.15)"
                      />
                    </View>

                    {/* KYC Document Verification Banner (Matching Website) */}
                    <Card style={styles.kycBanner}>
                      <View style={styles.kycBannerHeader}>
                        <View style={styles.kycShieldCircle}>
                          <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={styles.kycBannerTitle}>
                            Document KYC Verification Required
                          </Text>
                          <Text style={styles.kycBannerStatus}>
                            Status:{' '}
                            <Text
                              style={{
                                color:
                                  user?.isVerified || user?.kycStatus === 'verified'
                                    ? '#22C55E'
                                    : colors.brand,
                                fontWeight: '700',
                              }}
                            >
                              {user?.isVerified || user?.kycStatus === 'verified'
                                ? 'Verified'
                                : 'Pending'}
                            </Text>
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.kycBannerText}>
                        Verify your identity using either a College Student ID or Aadhaar Card to bypass file validation at checkout and list or rent vehicles immediately.
                      </Text>

                      <Pressable
                        onPress={() => setShowKycModal(true)}
                        style={styles.kycVerifyBtn}
                      >
                        <Text style={styles.kycVerifyBtnText}>
                          {user?.isVerified || user?.kycStatus === 'verified'
                            ? 'Update KYC Details'
                            : 'Verify KYC Now'}
                        </Text>
                      </Pressable>
                    </Card>

                    {/* Recent Rental Activities */}
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Recent Rental Activities</Text>
                    </View>

                    {renterBookings.length === 0 ? (
                      <Card style={styles.emptyCard}>
                        <MaterialCommunityIcons name="bike" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No recent rentals found</Text>
                        <Text style={styles.emptyCardText}>
                          Explore available vehicles near Dibrugarh University to make your first booking!
                        </Text>
                        {onExplorePress ? (
                          <Button
                            title="Explore Vehicles"
                            variant="primary"
                            onPress={onExplorePress}
                            style={{ marginTop: spacing.md }}
                          />
                        ) : null}
                      </Card>
                    ) : (
                      renterBookings.map((b) => (
                        <Pressable
                          key={b._id || b.id}
                          onPress={() => setSelectedRenterBooking(b)}
                          style={{ width: '100%' }}
                        >
                          <Card style={styles.activityCard}>
                            <View style={styles.activityIconCircle}>
                              <MaterialCommunityIcons name="motorbike" size={20} color={colors.brand} />
                            </View>
                            <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                              <Text style={styles.activityVehicleName}>
                                {b.vehicleName || 'Vehicle Rental'}
                              </Text>
                              <Text style={styles.activitySubtitle}>
                                {new Date(b.startDate || Date.now()).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <View style={[styles.statusBadge, styles.statusBadgeGreen]}>
                                <Text style={[styles.statusBadgeText, styles.statusTextGreen]}>
                                  {b.bookingStatus || 'Active'}
                                </Text>
                              </View>
                              <Text style={styles.activityAmount}>
                                ₹{b.totalAmount || b.pricing?.totalPrice || 0}
                              </Text>
                            </View>
                          </Card>
                        </Pressable>
                      ))
                    )}
                  </>
                )}

                {/* ── Current Booking Tab ── */}
                {activeTab === 'current' && (
                  <View>
                    {activeRentalsCount === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="clock" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No active rental currently</Text>
                        <Text style={styles.emptyCardText}>
                          When your booking begins, live trip info, keys, and SOS emergency buttons appear here.
                        </Text>
                      </Card>
                    ) : (
                      renterBookings
                        .filter((b) => b.status === 'active' || b.status === 'ongoing')
                        .map((b) => (
                          <Card key={b._id || b.id} style={styles.bookingCard}>
                            <Text style={styles.bookingVehicleName}>{b.vehicleName}</Text>
                            <Text style={styles.bookingCustomer}>Rental in progress • Active Trip</Text>
                            <Button
                              title="🚨 Emergency SOS"
                              variant="danger"
                              onPress={() =>
                                Alert.alert(
                                  'Emergency SOS',
                                  'Connecting to campus security and emergency roadside assistance...'
                                )
                              }
                              style={{ marginTop: spacing.md }}
                            />
                          </Card>
                        ))
                    )}
                  </View>
                )}

                {/* ── Upcoming Tab ── */}
                {activeTab === 'upcoming' && (
                  <View>
                    {upcomingRentalsCount === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="calendar" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No upcoming bookings</Text>
                        <Text style={styles.emptyCardText}>
                          Reserve a bike or scooter in advance for exams or trips around Dibrugarh.
                        </Text>
                      </Card>
                    ) : (
                      renterBookings
                        .filter((b) => b.status === 'accepted' || b.status === 'pending' || b.status === 'requested')
                        .map((b) => {
                          const isPending = b.status === 'pending' || b.status === 'requested';
                          const isPaid = b.paymentStatus === 'paid';

                          return (
                            <Pressable
                              key={b._id || b.id}
                              onPress={() => setSelectedRenterBooking(b)}
                              style={{ width: '100%' }}
                            >
                              <Card style={styles.bookingCard}>
                                <View style={styles.bookingCardHeader}>
                                  <Text style={styles.bookingVehicleName}>{b.vehicleName}</Text>
                                  <Text style={styles.bookingPrice}>₹{b.totalAmount || 0}</Text>
                                </View>
                              <Text style={styles.bookingDateText}>
                                📅 Starts {new Date(b.startTime || b.startDate || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </Text>

                              <View style={[styles.bookingDetailsRow, { marginTop: 6 }]}>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    isPending ? styles.statusBadgeYellow : styles.statusBadgeBlue,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      isPending ? styles.statusTextYellow : styles.statusTextBlue,
                                    ]}
                                  >
                                    {isPending ? 'Pending Owner Approval' : 'Accepted by Owner'}
                                  </Text>
                                </View>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    isPaid ? styles.statusBadgeGreen : styles.statusBadgeYellow,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.statusBadgeText,
                                      isPaid ? styles.statusTextGreen : styles.statusTextYellow,
                                    ]}
                                  >
                                    {isPaid ? 'Paid' : 'Payment Pending'}
                                  </Text>
                                </View>
                              </View>

                              <Text style={[styles.bookingCustomer, { marginTop: 6 }]}>
                                {isPaid
                                  ? '✅ Cash payment verified by vehicle owner'
                                  : `💵 Pay ₹${b.totalAmount || 0} in cash directly to vehicle owner upon handover`}
                              </Text>

                              <Button
                                title="Cancel Booking"
                                variant="outline"
                                onPress={() => handleCancelBooking(b._id || b.id)}
                                style={{ marginTop: spacing.sm }}
                              />
                            </Card>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                )}

                {/* ── Completed Tab ── */}
                {activeTab === 'completed' && (
                  <View>
                    {completedRentalsCount === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="check-circle" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No completed trips</Text>
                        <Text style={styles.emptyCardText}>
                          Your past rental receipts and review options will be listed here.
                        </Text>
                      </Card>
                    ) : (
                      renterBookings
                        .filter((b) => b.status === 'completed')
                        .map((b) => (
                          <Card key={b._id || b.id} style={styles.bookingCard}>
                            <Text style={styles.bookingVehicleName}>{b.vehicleName}</Text>
                            <Text style={styles.bookingCustomer}>Paid: ₹{b.totalAmount || 0} • Trip Completed</Text>
                          </Card>
                        ))
                    )}
                  </View>
                )}

                {/* ── Cancelled Tab ── */}
                {activeTab === 'cancelled' && (
                  <View>
                    {cancelledRentalsCount === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="x-circle" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No cancelled bookings</Text>
                      </Card>
                    ) : (
                      renterBookings
                        .filter((b) => b.status === 'cancelled' || b.status === 'rejected')
                        .map((b) => (
                          <Card key={b._id || b.id} style={styles.bookingCard}>
                            <Text style={styles.bookingVehicleName}>{b.vehicleName}</Text>
                            <View style={[styles.statusBadge, styles.statusBadgeRed, { alignSelf: 'flex-start', marginTop: 4 }]}>
                              <Text style={[styles.statusBadgeText, styles.statusTextRed]}>
                                {b.status === 'rejected' ? 'Declined by Owner' : 'Cancelled'}
                              </Text>
                            </View>
                          </Card>
                        ))
                    )}
                  </View>
                )}

                {/* ── Payments Tab ── */}
                {activeTab === 'payments' && (
                  <View>
                    {renterPayments.length === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="dollar-sign" size={40} color={colors.textMuted} />
                        <Text style={styles.emptyCardTitle}>No payment records</Text>
                        <Text style={styles.emptyCardText}>
                          All UPI, card, and advance rental deposits will be recorded here.
                        </Text>
                      </Card>
                    ) : (
                      renterPayments.map((p) => (
                        <Card key={p._id || p.id} style={styles.activityCard}>
                          <Text style={styles.activityVehicleName}>₹{p.amount}</Text>
                          <Text style={styles.activitySubtitle}>{p.paymentMethod || 'UPI'}</Text>
                        </Card>
                      ))
                    )}
                  </View>
                )}

                {/* ── KYC Tab ── */}
                {activeTab === 'kyc' && (
                  <View>
                    <Card style={styles.kycBanner}>
                      <Text style={styles.kycBannerTitle}>Identity Verification</Text>
                      <Text style={styles.kycBannerText}>
                        Current status:{' '}
                        <Text style={{ color: '#22C55E', fontWeight: 'bold' }}>
                          {user?.isVerified || user?.kycStatus === 'verified' ? 'Verified' : 'Pending'}
                        </Text>
                      </Text>
                      <Button
                        title="Submit / Update KYC"
                        onPress={() => setShowKycModal(true)}
                        style={{ marginTop: spacing.md }}
                      />
                    </Card>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════
          MODAL 1: LIST YOUR VEHICLE
          ═══════════════════════════════════════════════ */}
      <Modal
        visible={showAddVehicleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddVehicleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>List Your Vehicle</Text>
              <Pressable
                onPress={() => setShowAddVehicleModal(false)}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 490 }}>
              <Text style={styles.inputLabel}>Vehicle Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Pulsar 150, Activa 6G, Classic 350"
                placeholderTextColor={colors.textMuted}
                value={newVehicle.name}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, name: t })}
              />

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Brand *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Bajaj, Honda, TVS"
                    placeholderTextColor={colors.textMuted}
                    value={newVehicle.brand}
                    onChangeText={(t) => setNewVehicle({ ...newVehicle, brand: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Model / Variant</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 150 Dual Disc"
                    placeholderTextColor={colors.textMuted}
                    value={newVehicle.model}
                    onChangeText={(t) => setNewVehicle({ ...newVehicle, model: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Registration Number (e.g. AS-06-AB-1234) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="AS06AB1234"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                value={newVehicle.registrationNumber}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, registrationNumber: t.toUpperCase() })}
              />

              <Text style={styles.inputLabel}>Vehicle Type</Text>
              <View style={styles.typeSelectorRow}>
                <Pressable
                  onPress={() => setNewVehicle({ ...newVehicle, type: 'bike' })}
                  style={[styles.typeBtn, newVehicle.type === 'bike' && styles.typeBtnActive]}
                >
                  <MaterialCommunityIcons
                    name="motorbike"
                    size={18}
                    color={newVehicle.type === 'bike' ? '#FFFFFF' : colors.textMuted}
                  />
                  <Text style={[styles.typeBtnText, newVehicle.type === 'bike' && styles.typeBtnTextActive]}>
                    Motorcycle
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setNewVehicle({ ...newVehicle, type: 'scooty' })}
                  style={[styles.typeBtn, newVehicle.type === 'scooty' && styles.typeBtnActive]}
                >
                  <MaterialCommunityIcons
                    name="moped"
                    size={18}
                    color={newVehicle.type === 'scooty' ? '#FFFFFF' : colors.textMuted}
                  />
                  <Text style={[styles.typeBtnText, newVehicle.type === 'scooty' && styles.typeBtnTextActive]}>
                    Scooter
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Owner Contact Phone (10-Digit Mobile) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 9876543210"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={newVehicle.ownerPhone}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, ownerPhone: t })}
              />

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Price / Hour (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={newVehicle.pricePerHour}
                    onChangeText={(t) => setNewVehicle({ ...newVehicle, pricePerHour: t })}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Price / Day (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={newVehicle.pricePerDay}
                    onChangeText={(t) => setNewVehicle({ ...newVehicle, pricePerDay: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Pickup Location in Dibrugarh</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Dibrugarh University Gate 1"
                placeholderTextColor={colors.textMuted}
                value={newVehicle.location}
                onChangeText={(t) => setNewVehicle({ ...newVehicle, location: t })}
              />

              {/* Vehicle Photos Management */}
              <View style={styles.photoSection}>
                <View style={styles.photoHeaderRow}>
                  <Text style={styles.inputLabelWithoutMargin}>Vehicle Photos</Text>
                  <Text style={styles.photoCountBadge}>{newVehicle.photos.length} added</Text>
                </View>

                <View style={styles.photoInputRow}>
                  <TextInput
                    style={[styles.modalInput, { flex: 1 }]}
                    placeholder="Paste image or Cloudinary URL"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={photoInputText}
                    onChangeText={setPhotoInputText}
                  />
                  <Pressable
                    onPress={handleAddPhoto}
                    style={styles.addPhotoBtn}
                  >
                    <Feather name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.addPhotoBtnText}>Add</Text>
                  </Pressable>
                </View>

                {newVehicle.photos.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoThumbList}>
                    {newVehicle.photos.map((uri, idx) => (
                      <View key={idx} style={styles.photoThumbWrapper}>
                        <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                        <Pressable
                          onPress={() => handleRemovePhoto(idx)}
                          style={styles.photoRemoveBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Feather name="x" size={12} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.photoHintText}>
                    Tip: Add photo URLs for your ride. If left blank, official model photography is automatically assigned.
                  </Text>
                )}
              </View>
            </ScrollView>

            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              <Button
                title={submittingVehicle ? 'Submitting...' : 'Submit Vehicle for Verification'}
                onPress={() => handleCreateVehicle('submit')}
                loading={submittingVehicle}
              />
              <Button
                title="Save as Draft"
                variant="outline"
                onPress={() => handleCreateVehicle('draft')}
                disabled={submittingVehicle}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 2: KYC VERIFICATION
          ═══════════════════════════════════════════════ */}
      <Modal
        visible={showKycModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowKycModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Document KYC Verification</Text>
              <Pressable onPress={() => setShowKycModal(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Upload or enter your College Student ID or Aadhaar Card number for instant verification.
            </Text>

            <Text style={styles.inputLabel}>Document Type</Text>
            <View style={styles.typeSelectorRow}>
              <Pressable
                onPress={() => setKycType('college_id')}
                style={[styles.typeBtn, kycType === 'college_id' && styles.typeBtnActive]}
              >
                <FontAwesome5
                  name="id-card"
                  size={14}
                  color={kycType === 'college_id' ? '#FFFFFF' : colors.textMuted}
                />
                <Text style={[styles.typeBtnText, kycType === 'college_id' && styles.typeBtnTextActive]}>
                  Student ID
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setKycType('aadhaar')}
                style={[styles.typeBtn, kycType === 'aadhaar' && styles.typeBtnActive]}
              >
                <Feather
                  name="shield"
                  size={14}
                  color={kycType === 'aadhaar' ? '#FFFFFF' : colors.textMuted}
                />
                <Text style={[styles.typeBtnText, kycType === 'aadhaar' && styles.typeBtnTextActive]}>
                  Aadhaar Card
                </Text>
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>
              {kycType === 'college_id' ? 'College Registration / Roll No.' : '12-Digit Aadhaar Number'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={kycType === 'college_id' ? 'e.g. DU/2026/CS/042' : '•••• •••• ••••'}
              placeholderTextColor={colors.textMuted}
              value={kycDocNumber}
              onChangeText={setKycDocNumber}
            />

            <Button
              title={submittingKyc ? 'Verifying...' : 'Submit & Verify Identity'}
              onPress={handleSubmitKyc}
              loading={submittingKyc}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════
          MODAL 3: CASH PAYMENT CONFIRMATION
          ═══════════════════════════════════════════════ */}
      <Modal
        visible={showCashModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!confirmingCash) setShowCashModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="cash-register" size={22} color="#22C55E" />
                <Text style={styles.modalTitle}>Confirm Cash Received</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (!confirmingCash) setShowCashModal(false);
                }}
                disabled={confirmingCash}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Please verify that you have physically collected the cash amount from the renter before recording.
            </Text>

            {cashBooking ? (
              <Card style={styles.cashSummaryCard}>
                <View style={styles.cashSummaryRow}>
                  <Text style={styles.cashSummaryLabel}>Renter:</Text>
                  <Text style={styles.cashSummaryValue}>{cashBooking.renterName || 'Verified Rider'}</Text>
                </View>
                <View style={styles.cashSummaryRow}>
                  <Text style={styles.cashSummaryLabel}>Vehicle:</Text>
                  <Text style={styles.cashSummaryValue}>{cashBooking.vehicleName || 'Rental Vehicle'}</Text>
                </View>
                <View style={styles.cashSummaryRow}>
                  <Text style={styles.cashSummaryLabel}>Trip Duration:</Text>
                  <Text style={styles.cashSummaryValue}>
                    {new Date(cashBooking.startTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → {new Date(cashBooking.endTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={[styles.cashSummaryRow, styles.cashTotalRow]}>
                  <Text style={styles.cashTotalLabel}>Cash Amount to Collect:</Text>
                  <Text style={styles.cashTotalValue}>₹{cashBooking.totalAmount || 0}</Text>
                </View>
              </Card>
            ) : null}

            <Text style={styles.inputLabel}>Notes / Reference (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Collected at campus gate"
              placeholderTextColor={colors.textMuted}
              value={cashNotes}
              onChangeText={setCashNotes}
              editable={!confirmingCash}
            />

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title={confirmingCash ? 'Recording Payment...' : `Confirm & Record ₹${cashBooking?.totalAmount || 0} Cash`}
                onPress={handleConfirmCashPayment}
                loading={confirmingCash}
                disabled={confirmingCash}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowCashModal(false)}
                disabled={confirmingCash}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Renter Booking Details Modal ── */}
      <Modal
        visible={!!selectedRenterBooking}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRenterBooking(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedRenterBooking(null)}
        >
          <Pressable
            style={[styles.modalCard, { maxHeight: '90%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedRenterBooking && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRefText}>
                      BOOKING #{String(selectedRenterBooking._id || selectedRenterBooking.id || '').slice(-8).toUpperCase()}
                    </Text>
                    <Text style={styles.modalTitle}>
                      {selectedRenterBooking.vehicleName || 'Vehicle Rental'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedRenterBooking(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Feather name="x" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>

                {/* Status Badges Row */}
                <View style={styles.detailsBadgeRow}>
                  <View style={[styles.statusBadge, styles.statusBadgeBlue]}>
                    <Text style={[styles.statusBadgeText, styles.statusTextBlue]}>
                      {selectedRenterBooking.status === 'pending'
                        ? 'Pending Approval'
                        : selectedRenterBooking.status === 'accepted'
                        ? 'Accepted'
                        : selectedRenterBooking.status || 'Active'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      selectedRenterBooking.paymentStatus === 'paid'
                        ? styles.statusBadgeGreen
                        : styles.statusBadgeYellow,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        selectedRenterBooking.paymentStatus === 'paid'
                          ? styles.statusTextGreen
                          : styles.statusTextYellow,
                      ]}
                    >
                      {selectedRenterBooking.paymentStatus === 'paid' ? 'Paid' : 'Payment Pending'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.surface2 }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.textPrimary }]}>
                      {selectedRenterBooking.paymentMethod === 'online' ? '💳 Online' : '💵 Cash'}
                    </Text>
                  </View>
                </View>

                {/* Locations Card */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.md }]}>
                  <View style={styles.detailsInfoRow}>
                    <Feather name="map-pin" size={14} color={colors.brand} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailsSectionLabel}>Pickup Location</Text>
                      <Text style={styles.detailsSectionValue}>
                        {selectedRenterBooking.pickupLocation || 'Dibrugarh University Campus'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.detailsInfoRow, { marginTop: spacing.sm }]}>
                    <Feather name="navigation" size={14} color={colors.brand} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailsSectionLabel}>Return Location</Text>
                      <Text style={styles.detailsSectionValue}>
                        {selectedRenterBooking.returnLocation || 'Dibrugarh University Campus'}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Timing & Dates */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm }]}>
                  <View style={styles.detailsInfoRow}>
                    <Feather name="calendar" size={14} color={colors.textSecondary} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailsSectionLabel}>Rental Period</Text>
                      <Text style={styles.detailsSectionValue}>
                        {new Date(selectedRenterBooking.startTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → {new Date(selectedRenterBooking.endTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Price Breakdown */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm }]}>
                  <View style={styles.cashSummaryRow}>
                    <Text style={styles.cashSummaryLabel}>Total Amount:</Text>
                    <Text style={[styles.cashSummaryValue, { color: colors.brand, fontWeight: '800', fontSize: 16 }]}>
                      ₹{selectedRenterBooking.totalAmount || selectedRenterBooking.pricing?.totalPrice || 0}
                    </Text>
                  </View>
                  <View style={[styles.cashSummaryRow, { marginTop: 4 }]}>
                    <Text style={styles.cashSummaryLabel}>Payment Method:</Text>
                    <Text style={styles.cashSummaryValue}>
                      {selectedRenterBooking.paymentMethod === 'online' ? 'Online Gateway' : 'Direct Cash on Handover'}
                    </Text>
                  </View>
                </Card>

                {/* Owner Contact */}
                {['accepted', 'approved', 'active', 'confirmed', 'ready_for_pickup'].includes(selectedRenterBooking.status) ? (
                  <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm, borderColor: 'rgba(255,107,0,0.3)' }]}>
                    <Text style={styles.detailsSectionLabel}>Vehicle Owner Contact</Text>
                    <Text style={[styles.detailsSectionValue, { fontWeight: '700', fontSize: 14, marginTop: 2 }]}>
                      {selectedRenterBooking.ownerName || 'Verified LUPU Partner'}
                    </Text>
                    {selectedRenterBooking.ownerPhone ? (
                      <Text style={[styles.detailsSectionValue, { color: colors.brand, marginTop: 4 }]}>
                        📞 {selectedRenterBooking.ownerPhone}
                      </Text>
                    ) : null}
                  </Card>
                ) : (
                  <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm }]}>
                    <Text style={[styles.detailsSectionLabel, { color: colors.textMuted }]}>
                      Owner contact will be revealed once the request is accepted.
                    </Text>
                  </Card>
                )}

                {/* Action Buttons */}
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  {['accepted', 'approved', 'active', 'confirmed', 'ready_for_pickup'].includes(selectedRenterBooking.status) &&
                    selectedRenterBooking.paymentMethod === 'online' &&
                    selectedRenterBooking.paymentStatus !== 'paid' && (
                      <Button
                        title={
                          payingOnlineId === (selectedRenterBooking._id || selectedRenterBooking.id)
                            ? 'Processing Payment…'
                            : `Pay ₹${selectedRenterBooking.totalAmount || 0} Online Now`
                        }
                        onPress={() => handlePayOnline(selectedRenterBooking)}
                        loading={payingOnlineId === (selectedRenterBooking._id || selectedRenterBooking.id)}
                        disabled={payingOnlineId === (selectedRenterBooking._id || selectedRenterBooking.id)}
                      />
                  )}

                  {selectedRenterBooking.paymentMethod === 'cash' &&
                    selectedRenterBooking.paymentStatus !== 'paid' && (
                      <Card style={[styles.detailsSectionCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                        <Text style={{ color: '#FBBF24', fontSize: 11, lineHeight: 16 }}>
                          💵 Direct Cash Payment: Pay ₹{selectedRenterBooking.totalAmount || 0} in physical cash to the vehicle owner upon pickup handover. The owner will record receipt.
                        </Text>
                      </Card>
                  )}

                  <Button
                    title="Close"
                    variant="outline"
                    onPress={() => setSelectedRenterBooking(null)}
                  />
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Owner Booking Details Modal ── */}
      <Modal
        visible={!!selectedOwnerBooking}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedOwnerBooking(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedOwnerBooking(null)}
        >
          <Pressable
            style={[styles.modalCard, { maxHeight: '90%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedOwnerBooking && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalRefText}>
                      BOOKING #{String(selectedOwnerBooking._id || selectedOwnerBooking.id || '').slice(-8).toUpperCase()}
                    </Text>
                    <Text style={styles.modalTitle}>
                      {selectedOwnerBooking.vehicleName || 'Vehicle Rental'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedOwnerBooking(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Feather name="x" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>

                {/* Status Badges */}
                <View style={styles.detailsBadgeRow}>
                  <View style={[styles.statusBadge, styles.statusBadgeBlue]}>
                    <Text style={[styles.statusBadgeText, styles.statusTextBlue]}>
                      {selectedOwnerBooking.status === 'pending' || selectedOwnerBooking.status === 'requested'
                        ? 'Pending Approval'
                        : selectedOwnerBooking.status === 'accepted'
                        ? 'Accepted'
                        : selectedOwnerBooking.status || 'Active'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      selectedOwnerBooking.paymentStatus === 'paid'
                        ? styles.statusBadgeGreen
                        : styles.statusBadgeYellow,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        selectedOwnerBooking.paymentStatus === 'paid'
                          ? styles.statusTextGreen
                          : styles.statusTextYellow,
                      ]}
                    >
                      {selectedOwnerBooking.paymentStatus === 'paid' ? 'Paid' : 'Payment Pending'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.surface2 }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.textPrimary }]}>
                      {selectedOwnerBooking.paymentMethod === 'online' ? '💳 Online' : '💵 Cash'}
                    </Text>
                  </View>
                </View>

                {/* Renter Profile Card */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.md }]}>
                  <Text style={styles.detailsSectionLabel}>Renter Information</Text>
                  <Text style={[styles.detailsSectionValue, { fontSize: 14, fontWeight: '700', marginTop: 2 }]}>
                    {selectedOwnerBooking.renterName || selectedOwnerBooking.userName || 'Verified Rider'}
                  </Text>
                  {selectedOwnerBooking.renterPhone ? (
                    <Text style={[styles.detailsSectionValue, { color: colors.brand, marginTop: 4 }]}>
                      📞 {selectedOwnerBooking.renterPhone}
                    </Text>
                  ) : null}
                  {selectedOwnerBooking.renterEmail ? (
                    <Text style={[styles.detailsSectionValue, { color: colors.textMuted, marginTop: 2 }]}>
                      ✉️ {selectedOwnerBooking.renterEmail}
                    </Text>
                  ) : null}
                </Card>

                {/* Locations Card */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm }]}>
                  <View style={styles.detailsInfoRow}>
                    <Feather name="map-pin" size={14} color={colors.brand} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailsSectionLabel}>Pickup Location</Text>
                      <Text style={styles.detailsSectionValue}>
                        {selectedOwnerBooking.pickupLocation || 'Dibrugarh University Campus'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.detailsInfoRow, { marginTop: spacing.sm }]}>
                    <Feather name="navigation" size={14} color={colors.brand} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailsSectionLabel}>Return Location</Text>
                      <Text style={styles.detailsSectionValue}>
                        {selectedOwnerBooking.returnLocation || 'Dibrugarh University Campus'}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Timing */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm }]}>
                  <View style={styles.detailsInfoRow}>
                    <Feather name="calendar" size={14} color={colors.textSecondary} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.detailsSectionLabel}>Rental Timing</Text>
                      <Text style={styles.detailsSectionValue}>
                        {new Date(selectedOwnerBooking.startTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} → {new Date(selectedOwnerBooking.endTime || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Total Price */}
                <Card style={[styles.detailsSectionCard, { marginTop: spacing.sm }]}>
                  <View style={styles.cashSummaryRow}>
                    <Text style={styles.cashSummaryLabel}>Total Amount:</Text>
                    <Text style={[styles.cashSummaryValue, { color: colors.brand, fontWeight: '800', fontSize: 16 }]}>
                      ₹{selectedOwnerBooking.totalAmount || selectedOwnerBooking.pricing?.totalPrice || 0}
                    </Text>
                  </View>
                  <View style={[styles.cashSummaryRow, { marginTop: 4 }]}>
                    <Text style={styles.cashSummaryLabel}>Payment Mode Chosen:</Text>
                    <Text style={styles.cashSummaryValue}>
                      {selectedOwnerBooking.paymentMethod === 'online' ? 'Online Gateway' : 'Direct Cash'}
                    </Text>
                  </View>
                </Card>

                {/* Action Buttons */}
                <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                  {(selectedOwnerBooking.status === 'pending' || selectedOwnerBooking.status === 'requested') && (
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Button
                        title="Accept Request"
                        onPress={() => {
                          const bid = selectedOwnerBooking._id || selectedOwnerBooking.id;
                          setSelectedOwnerBooking(null);
                          handleBookingAction(bid, 'accept');
                        }}
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Decline"
                        variant="outline"
                        onPress={() => {
                          const bid = selectedOwnerBooking._id || selectedOwnerBooking.id;
                          setSelectedOwnerBooking(null);
                          handleBookingAction(bid, 'reject');
                        }}
                        style={{ flex: 1 }}
                      />
                    </View>
                  )}

                  {['accepted', 'approved', 'active', 'confirmed', 'ready_for_pickup'].includes(selectedOwnerBooking.status) &&
                    selectedOwnerBooking.paymentMethod !== 'online' &&
                    selectedOwnerBooking.paymentStatus !== 'paid' && (
                      <Button
                        title={`Confirm Cash Received (₹${selectedOwnerBooking.totalAmount || 0})`}
                        onPress={() => {
                          const b = selectedOwnerBooking;
                          setSelectedOwnerBooking(null);
                          openCashConfirmation(b);
                        }}
                      />
                  )}

                  {selectedOwnerBooking.paymentMethod === 'online' &&
                    selectedOwnerBooking.paymentStatus !== 'paid' && (
                      <Card style={[styles.detailsSectionCard, { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
                        <Text style={{ color: '#60A5FA', fontSize: 11, lineHeight: 16 }}>
                          💳 Renter selected Online Payment. Status will automatically update to Paid once completed.
                        </Text>
                      </Card>
                  )}

                  {selectedOwnerBooking.paymentStatus === 'paid' && (
                    <Card style={[styles.detailsSectionCard, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                      <Text style={{ color: '#34D399', fontSize: 11, fontWeight: '600' }}>
                        ✅ Payment Verified & Recorded
                      </Text>
                    </Card>
                  )}

                  <Button
                    title="Close"
                    variant="outline"
                    onPress={() => setSelectedOwnerBooking(null)}
                  />
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── Metric Card Component (Mobile 2-Column Grid) ── */
function StatMetricCard({ label, value, icon, iconColor, iconBg }) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statCardLabel} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.statIconBadge, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 60,
  },
  guestIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  guestTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  guestSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  guestLoginBtn: {
    width: '100%',
    marginBottom: spacing.md,
  },
  guestExploreBtn: {
    paddingVertical: spacing.sm,
  },
  guestExploreText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '600',
  },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeBarInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  modeBarLabel: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modeBarSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  modeSwitchWrapper: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    gap: 4,
  },
  modeSwitchActive: {
    backgroundColor: colors.brand,
  },
  modeSwitchText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  modeSwitchTextActive: {
    color: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  dashboardTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  dashboardSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  listVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    gap: 4,
  },
  listVehicleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabItemActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '48.5%',
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statCardLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    marginRight: 4,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xs,
  },
  emptyCardTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyCardText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityVehicleName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  activitySubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  activityAmount: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusBadgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statusBadgeYellow: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  statusBadgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusBadgeGray: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statusTextGreen: {
    color: '#22C55E',
  },
  statusTextYellow: {
    color: '#EAB308',
  },
  statusTextRed: {
    color: '#EF4444',
  },
  statusTextGray: {
    color: '#94A3B8',
  },
  vehicleItemReg: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  kycBanner: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: 'rgba(255, 92, 0, 0.3)',
    marginBottom: spacing.lg,
  },
  kycBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  kycShieldCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 92, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycBannerTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  kycBannerStatus: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  kycBannerText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  kycVerifyBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  kycVerifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  vehicleItemCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  vehicleItemRow: {
    flexDirection: 'row',
  },
  vehicleThumbnail: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  vehicleItemTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  vehicleItemRate: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  vehicleItemLocation: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  vehicleItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 6,
  },
  toggleLive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  toggleOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLive: {
    backgroundColor: '#22C55E',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleTextLive: {
    color: '#22C55E',
  },
  toggleTextOffline: {
    color: '#EF4444',
  },
  actionIconBtn: {
    padding: 6,
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
  },
  bookingCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingVehicleName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  bookingCustomer: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  bookingPrice: {
    color: colors.brand,
    fontSize: 15,
    fontWeight: '700',
  },
  bookingDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  bookingDateText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  bookingActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    borderRadius: radius.md,
    gap: 4,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 8,
    borderRadius: radius.md,
    gap: 4,
  },
  rejectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  earningsSummaryCard: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  earningsSummaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  earningsSummaryAmount: {
    color: '#22C55E',
    fontSize: 34,
    fontWeight: '800',
    marginVertical: spacing.xs,
  },
  earningsSummarySub: {
    color: colors.textMuted,
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  modalCloseBtn: {
    padding: 6,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  typeBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  typeBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#FFFFFF',
  },
  photoSection: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputLabelWithoutMargin: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  photoCountBadge: {
    fontSize: 11,
    color: colors.brand,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 90, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  photoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  addPhotoBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  photoThumbList: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  photoThumbWrapper: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: radius.full,
    padding: 3,
  },
  photoHintText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  statusBadgeBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  statusTextBlue: {
    color: '#3B82F6',
  },
  statusBadgeGray: {
    backgroundColor: 'rgba(107, 114, 128, 0.15)',
  },
  statusTextMuted: {
    color: colors.textMuted,
  },
  bookingPhoneText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  bookingPaymentLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  cashConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    borderRadius: radius.md,
    gap: 6,
  },
  cashConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cashVerifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  cashVerifiedText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
  },
  cashSummaryCard: {
    backgroundColor: colors.surface2,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cashSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cashSummaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  cashSummaryValue: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  cashTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  cashTotalLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  cashTotalValue: {
    color: '#22C55E',
    fontSize: 18,
    fontWeight: '800',
  },
  modalRefText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2,
  },
  detailsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  detailsSectionCard: {
    backgroundColor: colors.surface2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsSectionLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsSectionValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
    marginTop: 2,
  },
});
