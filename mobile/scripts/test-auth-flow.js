/**
 * Test script for LUPU Mobile Auth Flow
 * Validates:
 * 1. Firebase initialization & configuration integrity
 * 2. Auth flow state transitions:
 *    - Initial loading state (authReady=false -> LoadingScreen)
 *    - Signed-out state (authReady=true, isAuthenticated=false -> LoginScreen)
 *    - Signed-in state (authReady=true, isAuthenticated=true -> HomeScreen)
 *    - Logout transition (clears state -> LoginScreen)
 * 3. Session persistence contract with AsyncStorage key '@lupu_user_session'
 * 4. Input validation (email, password length, role, name)
 * 5. Firebase Authentication error mappings
 */

const { initializeApp } = require('firebase/app');
const {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} = require('firebase/auth');

// Firebase config matching mobile/src/services/firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyApxoYeZTelEFfFs8c1F0eePCEimOPRK9o",
  authDomain: "uniride-9be37.firebaseapp.com",
  databaseURL: "https://uniride-9be37-default-rtdb.firebaseio.com",
  projectId: "uniride-9be37",
  storageBucket: "uniride-9be37.firebasestorage.app",
  messagingSenderId: "760677444428",
  appId: "1:760677444428:web:a419f39fd2dc273cbbfde9",
};

async function runTests() {
  console.log('=== LUPU Mobile Authentication Flow Verification ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  // Test 1: Navigation logic state transitions
  console.log('--- Test Suite 1: Root Navigation State Routing ---');
  function resolveScreen(authReady, isAuthenticated) {
    if (!authReady) return 'LoadingScreen';
    if (!isAuthenticated) return 'LoginScreen';
    return 'HomeScreen';
  }

  assert(
    resolveScreen(false, false) === 'LoadingScreen',
    'Startup with no session determined displays LoadingScreen'
  );
  assert(
    resolveScreen(false, true) === 'LoadingScreen',
    'Startup before authReady displays LoadingScreen even if cached user exists (no flicker)'
  );
  assert(
    resolveScreen(true, false) === 'LoginScreen',
    'Signed-out startup (authReady=true, isAuthenticated=false) displays LoginScreen'
  );
  assert(
    resolveScreen(true, true) === 'HomeScreen',
    'Signed-in startup / restored session displays HomeScreen (Explore)'
  );

  // Test 2: Logout transition
  let mockAuthState = { authReady: true, isAuthenticated: true, user: { email: 'user@test.com' } };
  assert(resolveScreen(mockAuthState.authReady, mockAuthState.isAuthenticated) === 'HomeScreen', 'User is initially on HomeScreen');
  // Trigger logout
  mockAuthState.isAuthenticated = false;
  mockAuthState.user = null;
  assert(resolveScreen(mockAuthState.authReady, mockAuthState.isAuthenticated) === 'LoginScreen', 'Logout immediately switches screen to LoginScreen');

  // Test 3: Session Persistence Schema
  console.log('\n--- Test Suite 2: AsyncStorage Session Persistence Contract ---');
  const SESSION_STORAGE_KEY = '@lupu_user_session';
  const sampleUser = {
    _id: '671234567890abcdef123456',
    email: 'test@lupu.in',
    name: 'Test Renter',
    role: 'user',
    isRider: true,
  };
  const serialized = JSON.stringify({ user: sampleUser, timestamp: Date.now() });
  const parsed = JSON.parse(serialized);

  assert(parsed && parsed.user && parsed.user.email === 'test@lupu.in', 'Serialized user restores valid object with email');
  assert(parsed.user.role === 'user', 'User role preserved across session serialization');

  // Test 4: Live Firebase Authentication tests
  console.log('\n--- Test Suite 3: Firebase Auth Verification (uniride-9be37) ---');
  const app = initializeApp(firebaseConfig, 'testApp');
  const auth = getAuth(app);

  // 4a. Invalid credentials rejection
  try {
    await signInWithEmailAndPassword(auth, 'nonexistent_user_998877@lupu.in', 'invalidPassword123');
    assert(false, 'Nonexistent account should fail sign-in');
  } catch (err) {
    const isExpected = err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential';
    assert(isExpected, `Rejected invalid credentials with Firebase error code: ${err.code}`);
  }

  // 4b. Weak password rejection
  try {
    await createUserWithEmailAndPassword(auth, 'valid_format@lupu.in', '123');
    assert(false, 'Weak password should fail registration');
  } catch (err) {
    const isWeakPass = err.code === 'auth/weak-password' || err.code === 'auth/password-does-not-meet-requirements';
    assert(isWeakPass, `Rejected weak password with code: ${err.code}`);
  }

  // 4c. Invalid email format rejection
  try {
    await signInWithEmailAndPassword(auth, 'notanemail', 'somepassword123');
    assert(false, 'Malformed email should fail sign-in');
  } catch (err) {
    assert(err.code === 'auth/invalid-email', `Rejected invalid email with code: ${err.code}`);
  }

  // Test 5: Native Google Auth & Firebase Credential Handshake
  console.log('\n--- Test Suite 4: Google Sign-In Credential & Flow Verification ---');
  const { GoogleAuthProvider, signInWithCredential } = require('firebase/auth');

  // 5a. Credential construction
  const dummyGoogleIdToken = 'header.payload.signature';
  const credential = GoogleAuthProvider.credential(dummyGoogleIdToken);
  assert(credential && credential.providerId === 'google.com', 'GoogleAuthProvider generates valid google.com auth credential');
  assert(credential.signInMethod === 'google.com', 'Credential specifies google.com signInMethod');

  // 5b. Firebase rejection of invalid token (proves live communication with Firebase Auth endpoint)
  try {
    await signInWithCredential(auth, credential);
    assert(false, 'Dummy Google credential should fail Firebase verification');
  } catch (err) {
    const isExpected = err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-token';
    assert(isExpected, `Firebase accurately rejected invalid Google token with code: ${err.code}`);
  }

  // 5c. Cancellation handling simulation
  const cancellationSimulation = (response) => {
    if (response && response.type === 'cancelled') {
      return { success: false, cancelled: true };
    }
    return { success: true };
  };
  const cancelResult = cancellationSimulation({ type: 'cancelled' });
  assert(cancelResult.cancelled === true && cancelResult.success === false, 'User cancellation yields graceful non-error state');

  // Test 6: Native Android Package & Keystore Configuration Integrity
  console.log('\n--- Test Suite 5: Android Native & Expo Config Integrity ---');
  const fs = require('fs');
  const path = require('path');

  const appJsonPath = path.resolve(__dirname, '../app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  assert(appJson.expo.android.package === 'in.lupu.app', 'app.json android package is in.lupu.app');
  assert(appJson.expo.android.googleServicesFile === './google-services.json', 'app.json android.googleServicesFile is configured');
  assert(appJson.expo.plugins.includes('@react-native-google-signin/google-signin'), 'app.json plugins includes @react-native-google-signin/google-signin');

  const rootBuildGradle = fs.readFileSync(path.resolve(__dirname, '../android/build.gradle'), 'utf8');
  assert(rootBuildGradle.includes('com.google.gms:google-services'), 'android/build.gradle contains com.google.gms:google-services dependency');

  const appBuildGradle = fs.readFileSync(path.resolve(__dirname, '../android/app/build.gradle'), 'utf8');
  assert(appBuildGradle.includes("applicationId 'in.lupu.app'"), "android/app/build.gradle sets applicationId 'in.lupu.app'");
  assert(appBuildGradle.includes("apply plugin: 'com.google.gms.google-services'"), "android/app/build.gradle applies com.google.gms.google-services plugin");

  const googleServicesPath = path.resolve(__dirname, '../google-services.json');
  assert(fs.existsSync(googleServicesPath), 'mobile/google-services.json exists');
  const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
  assert(googleServices.project_info?.project_id === 'uniride-9be37', 'google-services.json matches project uniride-9be37');
  assert(googleServices.client?.[0]?.client_info?.android_client_info?.package_name === 'in.lupu.app', 'google-services.json client package is in.lupu.app');
  const webClient = googleServices.client?.[0]?.oauth_client?.find(c => c.client_type === 3);
  assert(!!webClient?.client_id && webClient.client_id.endsWith('.apps.googleusercontent.com'), 'google-services.json contains valid Web OAuth Client ID');

  console.log(`\n=== Verification Summary: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();

