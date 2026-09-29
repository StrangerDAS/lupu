---
phase: 1
plan: 2
wave: 2
---

# Plan 1.2: API Security and Authorization Lock Down

## Objective
Audit and secure the `server.js` monolith to ensure all endpoints have appropriate authentication and authorization middleware properly applied, preventing unauthenticated access to sensitive data and mutating actions.

## Context
- .gsd/SPEC.md
- backend/server.js
- backend/middleware/authMiddleware.js

## Tasks

<task type="auto">
  <name>Security Audit of API Endpoints</name>
  <files>backend/server.js</files>
  <action>
    - Review all `app.post`, `app.put`, `app.delete`, and sensitive `app.get` routes in `server.js`.
    - Ensure `verifyFirebaseToken` and `requireMongoUser` are applied to all routes that require a logged-in user.
    - Ensure `authorize(...)` is properly applied to admin/owner specific routes.
    - Classify routes explicitly and do NOT blindly protect public endpoints (like `/api/vehicles` GET without specific constraints).
  </action>
  <verify>grep -n "app\.post\|app\.put\|app\.delete" backend/server.js | grep -v verifyFirebaseToken</verify>
  <done>All mutating endpoints properly enforce authentication.</done>
</task>

<task type="auto">
  <name>Test Backend Security Changes</name>
  <files>backend/server.js</files>
  <action>
    - Add tests (or use existing test scripts like `test-vehicle-post.js`) to verify that unauthenticated requests fail with 401.
    - Ensure valid token requests still succeed.
  </action>
  <verify>node backend/test-api.js || true</verify>
  <done>Security changes are verified not to break core authenticated functionalities.</done>
</task>

## Success Criteria
- [ ] No unprotected state-changing routes remain in `server.js`.
- [ ] Valid authenticated API requests still function correctly.
