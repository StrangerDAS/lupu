# Debug Session: Phase 1 Regressions

## Symptom
1. **Owners cannot list vehicles**: Users attempting to list a vehicle (e.g. through onboarding links, `/owner/setup`, or "Post Your Ride" in UserHub) were bounced back to `/hub` because `/dashboard` is protected with `requireOwner` before the owner role was activated. In addition, generic error handling in vehicle creation masked phone duplicate errors.
2. **Profile section not working correctly**: Updating profile with empty/blank phone saved `phone: ""` which collided with MongoDB sparse unique index `phone_1`, causing duplicate key errors (HTTP 409). Profile page also didn't resolve local upload paths with `getImageUrl`.
3. **Vehicle photo uploads are still too slow**: `uploadVehicleImages` in `firestoreService.js` uploaded images sequentially using a `for` loop instead of parallel `Promise.all`. In addition, `imageCompression` settings (2048px / 1.5MB) were heavy, and the fallback to backend upload sent uncompressed original files instead of the compressed blobs.

## Evidence & Root Causes
- **Route Guard Bounce**: In [ProtectedRoute.jsx](file:///Users/stranger/Untitled/frontend/src/components/ProtectedRoute.jsx), `requireOwner` redirects users to `/hub` if `!user.isOwner && !isAdmin()`. [OwnerSetup.jsx](file:///Users/stranger/Untitled/frontend/src/pages/OwnerSetup.jsx) immediately redirected to `/dashboard?addVehicle=true` without activating the owner role, causing non-owners to get kicked back to `/hub`.
- **Sequential Storage Upload**: In [firestoreService.js](file:///Users/stranger/Untitled/frontend/src/firebase/firestoreService.js), `uploadVehicleImages` sequentially iterated with `await uploadBytes(fileRef, files[i])` for every image, serializing network round trips.
- **Uncompressed Fallback & Heavy Compression**: In [OwnerDashboard.jsx](file:///Users/stranger/Untitled/frontend/src/pages/OwnerDashboard.jsx) and [EditVehicleModal.jsx](file:///Users/stranger/Untitled/frontend/src/components/EditVehicleModal.jsx), compression was processing in chunks of 2 with 2048px/1.5MB bounds, and the fallback upload to backend sent raw `photoFiles` instead of `compressedFiles`.
- **Sparse Index Collision**: In [server.js](file:///Users/stranger/Untitled/backend/server.js), `PUT /api/users/profile` saved `updates.phone = phone.trim()`, storing `""` which violates MongoDB's sparse index (`sparse` only excludes `null`/`undefined`, not `""`), causing 409 duplicate errors for users without phone numbers.
- **Avatar Image Path Resolution**: In [Profile.jsx](file:///Users/stranger/Untitled/frontend/src/pages/Profile.jsx), avatar `<img>` tags did not use [getImageUrl](file:///Users/stranger/Untitled/frontend/src/utils/urlUtils.js) to resolve relative `/uploads/...` paths.

## Resolution
1. **Owner Setup & Onboarding**: Updated [OwnerSetup.jsx](file:///Users/stranger/Untitled/frontend/src/pages/OwnerSetup.jsx) to automatically activate the owner role via `roleAPI.activateOwner()` and update auth state before navigating to `/dashboard?addVehicle=true`. Routed [UserHub.jsx](file:///Users/stranger/Untitled/frontend/src/pages/UserHub.jsx) "Post Your Ride" to `/owner/setup`.
2. **Concurrent Image Upload**: Refactored `uploadVehicleImages` in [firestoreService.js](file:///Users/stranger/Untitled/frontend/src/firebase/firestoreService.js) to upload all images concurrently using `Promise.all`.
3. **Optimized Image Compression & Fallback**: Updated [OwnerDashboard.jsx](file:///Users/stranger/Untitled/frontend/src/pages/OwnerDashboard.jsx) and [EditVehicleModal.jsx](file:///Users/stranger/Untitled/frontend/src/components/EditVehicleModal.jsx) with optimal responsive compression settings (1600px max side, 1.0MB, 0.8 quality) and ensured fallbacks always transmit compressed files.
4. **Phone & Profile Sanitization**: Fixed `PUT /api/users/profile` in [server.js](file:///Users/stranger/Untitled/backend/server.js) to save `phone: null` when empty, avoiding sparse index collisions. Fixed [Profile.jsx](file:///Users/stranger/Untitled/frontend/src/pages/Profile.jsx) submission payload and wrapped avatar paths with `getImageUrl`.
5. **Accurate Error Reporting**: Improved error reporting in `POST /api/vehicles` in [server.js](file:///Users/stranger/Untitled/backend/server.js) to differentiate vehicle registration number collisions from owner phone collisions.

## Verification
- `npm run build` in `frontend` compiled cleanly in 3.21s with 0 errors.
- `test-vehicle-creation.js` ran and verified DB vehicle creation successfully.
- No database resets, config changes, or push/deployments were performed.
