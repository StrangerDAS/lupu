import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import LoadingScreen from './src/screens/LoadingScreen';

/**
 * Root Application Navigator
 * Implements strict initial authentication flow:
 * 1. Shows LoadingScreen while checking persisted session (no flicker of Explore screen).
 * 2. If signed out, renders LoginScreen (with clear option to register).
 * 3. If signed in (or session restored), renders HomeScreen (Explore).
 * 4. When logging out, immediately returns to LoginScreen.
 */
function AppNavigation() {
  const { authReady, isAuthenticated } = useAuth();

  useEffect(() => {
    if (authReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [authReady]);

  // 1. Loading screen while verifying persisted Firebase session
  if (!authReady) {
    return <LoadingScreen />;
  }

  // 2. Unauthenticated: initial screen is Login screen with registration option
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 3. Authenticated: navigate to main Explore screen
  return <HomeScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#000000" />
      <AuthProvider>
        <AppNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
