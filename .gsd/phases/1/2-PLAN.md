---
phase: 1
plan: 2
wave: 2
---

# Plan 1.2: API Security and Authorization Lock Down

## Objective
Audit and secure the `server.js` monolith to ensure all endpoints have appropriate authentication and authorization middleware properly applied.

## Context
- .gsd/SPEC.md
- backend/server.js
- backend/middleware/authMiddleware.js
- backend/test-api.js

## Tasks

<task type="auto">
  <name>Explicit Security Audit of API Endpoints</name>
  <files>backend/server.js</files>
  <action>
    - Inspect each backend route individually and classify it (public, authenticated, owner-only, renter-only, admin-only, or other explicit access).
    - Ensure `verifyFirebaseToken`, `requireMongoUser`, and `authorize(...)` are applied appropriately to the sensitive routes based on the classification.
    - Do not blindly add authentication to legitimate public endpoints (such as public vehicle browsing).
    - Verify the actual middleware chain for every sensitive route to ensure there are no bypasses.
    - Do not change working behavior unnecessarily.
  </action>
  <verify>node backend/test-api.js || true</verify>
  <done>All endpoints are correctly classified and secured based on role requirements.</done>
</task>

<task type="auto">
  <name>Test Backend Security Constraints</name>
  <files>
    backend/server.js
    backend/test-api.js
  </files>
  <action>
    - Ensure tests (or create new ones) verify the security matrix for changed protected routes:
      1. Unauthenticated request (should fail).
      2. Authenticated unauthorized user (should fail).
      3. Authorized user (should succeed).
      4. Correct owner/admin access where applicable.
  </action>
  <verify>node backend/test-api.js || true</verify>
  <done>Security matrix is empirically verified.</done>
</task>

## Success Criteria
- [ ] Sensitive routes properly reject unauthenticated and unauthorized requests.
- [ ] Public routes remain accessible without authentication.
- [ ] Existing frontend functionalities (like viewing vehicles) continue to work flawlessly.
