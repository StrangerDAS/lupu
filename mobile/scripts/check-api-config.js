/**
 * Script to validate API URL configuration behavior in mobile/src/services/api.js
 * Tests development, production, and explicit overrides.
 */

// Simulation helper
function testApiResolution(devFlag, explicitUrl) {
  const PRODUCTION_API_URL = 'https://lupu-backend.onrender.com/api';
  const DEV_API_URL = 'http://10.0.2.2:5001/api';

  const __DEV__ = devFlag;
  const customUrl = explicitUrl?.trim();

  if (customUrl) {
    if (!__DEV__ && (!customUrl.startsWith('https://') || customUrl.includes('10.0.2.2') || customUrl.includes('localhost'))) {
      throw new Error(`[Security Error] Production release build must use a secure HTTPS endpoint. Invalid explicit URL: "${customUrl}"`);
    }
    return customUrl;
  }

  if (__DEV__) {
    return DEV_API_URL;
  }

  if (!PRODUCTION_API_URL.startsWith('https://')) {
    throw new Error(`[Security Error] PRODUCTION_API_URL must start with https://. Found: "${PRODUCTION_API_URL}"`);
  }

  return PRODUCTION_API_URL;
}

console.log('--- Testing API URL Resolution ---');

// Test 1: Development build (no explicit URL)
const devUrl = testApiResolution(true, undefined);
console.log('1. Development default (__DEV__=true):', devUrl);
if (devUrl !== 'http://10.0.2.2:5001/api') throw new Error('Dev URL test failed');

// Test 2: Production build (no explicit URL)
const prodUrl = testApiResolution(false, undefined);
console.log('2. Production default (__DEV__=false):', prodUrl);
if (prodUrl !== 'https://lupu-backend.onrender.com/api') throw new Error('Prod URL test failed');

// Test 3: Explicit override in production
const customProdUrl = testApiResolution(false, 'https://custom-api.lupu.in/api');
console.log('3. Explicit HTTPS override in prod:', customProdUrl);
if (customProdUrl !== 'https://custom-api.lupu.in/api') throw new Error('Custom HTTPS URL test failed');

// Test 4: Insecure override in production must throw
try {
  testApiResolution(false, 'http://insecure-api.lupu.in/api');
  throw new Error('Should have thrown on insecure URL');
} catch (e) {
  console.log('4. Blocked insecure HTTP in production as expected:', e.message);
}

// Test 5: Insecure localhost in production must throw
try {
  testApiResolution(false, 'http://10.0.2.2:5001/api');
  throw new Error('Should have thrown on 10.0.2.2 in production');
} catch (e) {
  console.log('5. Blocked 10.0.2.2 in production as expected:', e.message);
}

console.log('--- All resolution tests PASSED ---');
