---
phase: 1
plan: 3
wave: 3
---

# Plan 1.3: Privacy Filter and Multer Migration Plan

## Objective
Strip sensitive owner/renter contact information from default API GET responses, and prepare a detailed plan to migrate remaining backend Multer uploads to Firebase Storage in a future phase.

## Context
- .gsd/SPEC.md
- backend/server.js

## Tasks

<task type="auto">
  <name>Apply Privacy Filter on API Responses</name>
  <files>backend/server.js</files>
  <action>
    - Audit the `/api/vehicles` (GET list and GET single) and `/api/bookings` responses.
    - Remove `ownerName`, `ownerPhone`, and `documents` fields from the standard response payloads for unauthenticated or non-involved users.
    - Ensure contact information is *only* revealed when explicitly permitted (e.g., to the confirmed renter or the owner themselves).
  </action>
  <verify>grep -n "ownerPhone" backend/server.js</verify>
  <done>Sensitive contact information is no longer leaked in public API responses.</done>
</task>

<task type="auto">
  <name>Prepare Multer Migration Plan</name>
  <files>.gsd/phases/1/MULTER_MIGRATION_PLAN.md</files>
  <action>
    - Write a detailed document mapping out the required changes in frontend forms (`OwnerDashboard.jsx`, etc.) to migrate RC, Insurance, PUC, and Avatar uploads directly to Firebase Storage.
    - Identify backend routes to eventually remove/deprecate.
    - Do NOT execute the migration; just document the plan for Phase 2/3.
  </action>
  <verify>cat .gsd/phases/1/MULTER_MIGRATION_PLAN.md | grep "Migration Plan"</verify>
  <done>MULTER_MIGRATION_PLAN.md exists and contains the migration strategy.</done>
</task>

## Success Criteria
- [ ] Public API requests for vehicles do not expose `ownerPhone` or `documents`.
- [ ] Multer migration plan is fully documented and ready for a later phase.
