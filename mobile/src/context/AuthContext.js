import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from '../services/firebase';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { authAPI } from '../services/api';

const SESSION_STORAGE_KEY = '@lupu_user_session';

let isGoogleSigninConfigured = false;
const getGoogleWebClientId = () => {
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  }
  try {
    const googleServices = require('../../google-services.json');
    const webClient = googleServices?.client?.[0]?.oauth_client?.find((c) => c.client_type === 3);
    if (webClient?.client_id) {
      return webClient.client_id;
    }
  } catch (e) {
    // google-services.json missing or unreadable in current environment
  }
  return undefined;
};

const configureGoogleSignin = () => {
  if (isGoogleSigninConfigured) return;
  try {
    const webClientId = getGoogleWebClientId();
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
    });
    isGoogleSigninConfigured = true;
  } catch (err) {
    console.warn('[AuthContext] GoogleSignin.configure error:', err.message);
  }
};

const AuthContext = createContext({
  user: null,
  firebaseUser: null,
  authReady: false,
  loading: false,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  refreshUser: async () => {},
  clearError: () => {},
  signInWithGoogle: async () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  // 1. Initial cached session restoration for instant, flicker-free startup
  useEffect(() => {
    const restoreCachedSession = async () => {
      try {
        const cached = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.user) {
            setUser(parsed.user);
          }
        }
      } catch (e) {
        console.warn('[AuthContext] Error reading cached session:', e.message);
      }
    };
    restoreCachedSession();
  }, []);

  // 2. Firebase onAuthStateChanged listener to keep native session in sync with backend
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // Attempt sync / me call to get MongoDB user data
          const meRes = await authAPI.getMe();
          if (meRes.ok && meRes.data?.user) {
            setUser(meRes.data.user);
            await AsyncStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify({ user: meRes.data.user, timestamp: Date.now() })
            );
          } else {
            // First time or unsynced profile: call syncLogin
            const syncRes = await authAPI.syncLogin({
              name: fbUser.displayName || fbUser.email?.split('@')[0],
              role: 'user',
            });
            if (syncRes.ok && syncRes.data?.user) {
              setUser(syncRes.data.user);
              await AsyncStorage.setItem(
                SESSION_STORAGE_KEY,
                JSON.stringify({ user: syncRes.data.user, timestamp: Date.now() })
              );
            } else {
              setUser((prev) => prev || {
                email: fbUser.email,
                name: fbUser.displayName || fbUser.email?.split('@')[0],
                role: 'user',
                isRider: true,
                firebaseUid: fbUser.uid,
              });
            }
          }
        } catch (syncErr) {
          console.warn('[AuthContext] Backend sync error on auth state change:', syncErr.message);
          setUser((prev) => prev || {
            email: fbUser.email,
            name: fbUser.displayName || fbUser.email?.split('@')[0],
            role: 'user',
            isRider: true,
            firebaseUid: fbUser.uid,
          });
        }
      } else {
        setUser(null);
        await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // 3. Login with email & password
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;

      // Sync with MongoDB backend
      const syncRes = await authAPI.syncLogin({
        name: fbUser.displayName || email.split('@')[0],
      });

      let finalUser = null;
      if (syncRes.ok && syncRes.data?.user) {
        finalUser = syncRes.data.user;
      } else {
        // Fallback user object if backend temporarily unreachable
        finalUser = {
          email: fbUser.email,
          name: fbUser.displayName || email.split('@')[0],
          role: 'user',
          isRider: true,
          firebaseUid: fbUser.uid,
        };
      }

      setUser(finalUser);
      setFirebaseUser(fbUser);
      await AsyncStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ user: finalUser, timestamp: Date.now() })
      );

      setLoading(false);
      return { success: true, user: finalUser };
    } catch (err) {
      setLoading(false);
      let userFriendlyMessage = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        userFriendlyMessage = 'Invalid email or password. Please verify your credentials.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        userFriendlyMessage = 'Too many failed login attempts. Please try again later or reset your password.';
      }
      setError(userFriendlyMessage);
      return { success: false, error: userFriendlyMessage };
    }
  };

  // 4. Register new user with full name and account role
  const register = async (email, password, fullName, role = 'user') => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = userCredential.user;

      // Update Firebase profile display name
      if (fullName) {
        try {
          await updateProfile(fbUser, { displayName: fullName });
        } catch (pErr) {
          console.warn('[AuthContext] updateProfile notice:', pErr.message);
        }
      }

      // Sync and create user in MongoDB database
      const syncRes = await authAPI.syncLogin({
        name: fullName || email.split('@')[0],
        role: role === 'owner' ? 'owner' : 'user',
      });

      let finalUser = null;
      if (syncRes.ok && syncRes.data?.user) {
        finalUser = syncRes.data.user;
      } else {
        finalUser = {
          email: fbUser.email,
          name: fullName || email.split('@')[0],
          role: role === 'owner' ? 'owner' : 'user',
          isOwner: role === 'owner',
          isRider: true,
          firebaseUid: fbUser.uid,
        };
      }

      setUser(finalUser);
      setFirebaseUser(fbUser);
      await AsyncStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ user: finalUser, timestamp: Date.now() })
      );

      setLoading(false);
      return { success: true, user: finalUser };
    } catch (err) {
      setLoading(false);
      let userFriendlyMessage = err.message;
      if (err.code === 'auth/email-already-in-use') {
        userFriendlyMessage = 'An account with this email address already exists. Try logging in instead.';
      } else if (err.code === 'auth/weak-password' || err.code === 'auth/password-does-not-meet-requirements') {
        userFriendlyMessage = 'Password should be at least 6 characters and meet complexity requirements.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyMessage = 'Please enter a valid email address.';
      }
      setError(userFriendlyMessage);
      return { success: false, error: userFriendlyMessage };
    }
  };

  // 5. Password Reset
  const resetPassword = async (email) => {
    if (!email || !email.trim()) {
      setError('Please enter your email address to reset your password.');
      return { success: false, error: 'Email address required.' };
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setLoading(false);
      return { success: true, message: 'Password reset link sent to your email.' };
    } catch (err) {
      setLoading(false);
      let msg = err.message;
      if (err.code === 'auth/user-not-found') {
        msg = 'No user found with this email address.';
      }
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // 6. Sign in with Google (Native Play Services + Firebase Credential)
  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      configureGoogleSignin();

      // Check Google Play Services availability
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      } catch (playErr) {
        setLoading(false);
        const msg = 'Google Play Services is not available or outdated on this device.';
        setError(msg);
        return { success: false, error: msg };
      }

      const response = await GoogleSignin.signIn();

      // Handle user cancellation gracefully without error banner
      if (response && response.type === 'cancelled') {
        setLoading(false);
        return { success: false, cancelled: true };
      }

      // In @react-native-google-signin/google-signin v16, data is in response.data
      const idToken = response?.data?.idToken || response?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In completed but did not return an ID token. Verify webClientId or google-services.json configuration.');
      }

      // Securely sign into Firebase Authentication
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const fbUser = userCredential.user;

      // Sync and create user in MongoDB database
      const syncRes = await authAPI.syncLogin({
        name: fbUser.displayName || fbUser.email?.split('@')[0],
        role: 'user',
      });

      let finalUser = null;
      if (syncRes.ok && syncRes.data?.user) {
        finalUser = syncRes.data.user;
      } else {
        finalUser = {
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email?.split('@')[0],
          role: 'user',
          isRider: true,
          firebaseUid: fbUser.uid,
        };
      }

      setUser(finalUser);
      setFirebaseUser(fbUser);
      await AsyncStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ user: finalUser, timestamp: Date.now() })
      );

      setLoading(false);
      return { success: true, user: finalUser };
    } catch (err) {
      setLoading(false);

      if (err.code === statusCodes?.SIGN_IN_CANCELLED) {
        return { success: false, cancelled: true };
      } else if (err.code === statusCodes?.IN_PROGRESS) {
        const msg = 'Google Sign-In is already in progress.';
        setError(msg);
        return { success: false, error: msg };
      } else if (err.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        const msg = 'Google Play Services is not available on this device.';
        setError(msg);
        return { success: false, error: msg };
      }

      // Check if native module is unavailable (e.g. standard Expo Go runtime)
      if (err.message && (err.message.includes('RNGoogleSignin') || err.message.includes('NativeModule is not available') || err.message.includes('null is not an object'))) {
        const msg = 'Native Google Sign-In requires a standalone build or development build (npx expo run:android) with Google Play Services.';
        setError(msg);
        return { success: false, error: msg };
      }

      const userFriendlyMessage = err.message || 'Google Sign-In failed. Please try again.';
      setError(userFriendlyMessage);
      return { success: false, error: userFriendlyMessage };
    }
  };

  // 7. Sign out
  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('[AuthContext] signOut notice:', e.message);
    }
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Non-fatal if user wasn't signed in via Google or module not configured
    }
    setUser(null);
    setFirebaseUser(null);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY).catch(() => {});
    setLoading(false);
  };

  // 8. Refresh user profile
  const refreshUser = async () => {
    if (!auth?.currentUser) return;
    try {
      const res = await authAPI.getMe();
      if (res.ok && res.data?.user) {
        setUser(res.data.user);
        await AsyncStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ user: res.data.user, timestamp: Date.now() })
        );
      }
    } catch (e) {
      console.warn('[AuthContext] refreshUser notice:', e.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        authReady,
        loading,
        error,
        isAuthenticated: !!user || !!firebaseUser,
        login,
        register,
        logout,
        resetPassword,
        signInWithGoogle,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
