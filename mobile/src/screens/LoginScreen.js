import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, AntDesign } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, radius } from '../theme/spacing';
import { typography } from '../theme/typography';
import LupuLogo from '../components/common/LupuLogo';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

/**
 * LUPU Mobile Login & Signup Screen
 * Faithfully mirrors frontend/src/pages/Login.jsx & Signup.jsx
 * Fully integrated with Firebase Auth & LUPU backend API.
 */
export default function LoginScreen({ onBack, onLoginSuccess }) {
  const { login, register, resetPassword, signInWithGoogle, loading, error, clearError } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('user'); // 'user' (Renter) | 'owner'

  const handleToggleMode = () => {
    clearError();
    setIsSignup(!isSignup);
  };

  const handleSubmit = async () => {
    clearError();
    const trimmedEmail = email.trim();

    if (isSignup && !name.trim()) {
      return Alert.alert('Validation Error', 'Please enter your full name.');
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return Alert.alert('Validation Error', 'Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      return Alert.alert('Validation Error', 'Password must be at least 6 characters.');
    }

    if (isSignup) {
      const res = await register(trimmedEmail, password, name.trim(), role);
      if (res.success) {
        Alert.alert(
          'Account Created',
          `Welcome to LUPU, ${name.trim()}! Your account has been registered.`,
          [{ text: 'Continue', onPress: () => onLoginSuccess?.(res.user) }]
        );
      } else {
        Alert.alert('Signup Error', res.error || 'Unable to create account.');
      }
    } else {
      const res = await login(trimmedEmail, password);
      if (res.success) {
        Alert.alert(
          'Logged In',
          `Welcome back, ${res.user?.name || trimmedEmail}!`,
          [{ text: 'Continue', onPress: () => onLoginSuccess?.(res.user) }]
        );
      } else {
        Alert.alert('Login Error', res.error || 'Unable to log in.');
      }
    }
  };

  const handleForgotPassword = () => {
    clearError();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return Alert.alert(
        'Reset Password',
        'Please enter your email address in the field above, then tap "Forgot password?".'
      );
    }

    Alert.alert(
      'Reset Password',
      `Send password reset link to ${trimmedEmail}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            const res = await resetPassword(trimmedEmail);
            if (res.success) {
              Alert.alert('Check Your Email', res.message);
            } else {
              Alert.alert('Reset Failed', res.error);
            }
          },
        },
      ]
    );
  };

  const handleGoogleLogin = async () => {
    clearError();
    const res = await signInWithGoogle();
    if (res?.success) {
      Alert.alert(
        'Logged In',
        `Welcome, ${res.user?.name || res.user?.email || 'User'}!`,
        [{ text: 'Continue', onPress: () => onLoginSuccess?.(res.user) }]
      );
    } else if (res?.cancelled) {
      // User dismissed or cancelled the Google prompt cleanly; no alert required
    } else if (res?.error) {
      Alert.alert('Google Sign-In Error', res.error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header bar with Back and Logo */}
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <LupuLogo size={32} showWordmark={true} />
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title & Subtitle */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>
            {isSignup ? 'Create an Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.subtitle}>
            {isSignup
              ? 'Join LUPU to rent or host vehicles in Dibrugarh'
              : 'Log in to your LUPU account'}
          </Text>
        </View>

        {/* Segmented Auth Mode Switcher */}
        <View style={styles.authModeTabs}>
          <Pressable
            onPress={() => {
              if (isSignup) {
                clearError();
                setIsSignup(false);
              }
            }}
            style={[styles.authTab, !isSignup && styles.authTabActive]}
          >
            <Text
              style={[
                styles.authTabText,
                !isSignup && styles.authTabTextActive,
              ]}
            >
              Log In
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!isSignup) {
                clearError();
                setIsSignup(true);
              }
            }}
            style={[styles.authTab, isSignup && styles.authTabActive]}
          >
            <Text
              style={[
                styles.authTabText,
                isSignup && styles.authTabTextActive,
              ]}
            >
              Register
            </Text>
          </Pressable>
        </View>

        {/* Global Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Card Form */}
        <Card style={styles.formCard}>
          {isSignup ? (
            <>
              {/* Full Name */}
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) clearError();
                }}
                icon={<Feather name="user" size={18} color={colors.textMuted} />}
              />

              {/* Account Type Selection */}
              <View style={styles.roleContainer}>
                <Text style={styles.roleLabel}>I want to</Text>
                <View style={styles.roleButtons}>
                  <Pressable
                    onPress={() => setRole('user')}
                    style={[
                      styles.roleButton,
                      role === 'user' && styles.roleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === 'user' && styles.roleButtonTextActive,
                      ]}
                    >
                      Rent Vehicles
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRole('owner')}
                    style={[
                      styles.roleButton,
                      role === 'owner' && styles.roleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === 'owner' && styles.roleButtonTextActive,
                      ]}
                    >
                      Host & Earn
                    </Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}

          {/* Email Input */}
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (error) clearError();
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            icon={<Feather name="mail" size={18} color={colors.textMuted} />}
          />

          {/* Password Input with show/hide toggle */}
          <View style={{ marginBottom: spacing.lg }}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.passwordLabel}>Password</Text>
              {!isSignup ? (
                <Pressable onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.passwordWrapper}>
              <Feather
                name="lock"
                size={18}
                color={colors.textMuted}
                style={styles.passwordIcon}
              />
              <Input
                placeholder="••••••••"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) clearError();
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={{ flex: 1, marginBottom: 0 }}
                inputStyle={{ paddingLeft: 0 }}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {/* Submit Button */}
          <Button
            title={
              loading ? (
                'Please wait...'
              ) : isSignup ? (
                'Create Account'
              ) : (
                'Log in'
              )
            }
            variant="primary"
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitButton}
          />

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <Button
            title="Continue with Google"
            variant="outline"
            onPress={handleGoogleLogin}
            loading={loading}
            disabled={loading}
            icon={<AntDesign name="google" size={18} color="#EA4335" />}
            style={styles.googleButton}
          />

          {/* Bottom Switch between Login & Signup */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isSignup
                ? 'Already have an account? '
                : "Don't have an account? "}
            </Text>
            <Pressable onPress={handleToggleMode}>
              <Text style={styles.footerLink}>
                {isSignup ? 'Log in' : 'Sign up'}
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
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
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  titleSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  formCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
  },
  authModeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  authTabActive: {
    backgroundColor: colors.brand || colors.primary,
  },
  authTabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  authTabTextActive: {
    color: '#FFFFFF',
    fontWeight: typography.weights.bold,
  },
  roleContainer: {
    marginBottom: spacing.lg,
  },
  roleLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
  },
  roleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
  },
  roleButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  roleButtonTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  passwordLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  forgotPasswordText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  passwordIcon: {
    marginRight: spacing.sm,
  },
  eyeButton: {
    padding: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    paddingHorizontal: spacing.md,
    fontWeight: typography.weights.bold,
  },
  googleButton: {
    marginBottom: spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  footerLink: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
