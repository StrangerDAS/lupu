---
phase: 1
plan: 3
wave: 3
---

# Plan 1.3: Privacy Filter and Multer Migration Plan

## Objective
Enforce strict privacy rules on owner phone numbers and vehicle documents based on booking status, and prepare documentation for migrating backend Multer uploads to Firebase Storage without executing the migration yet.

## Context
- .gsd/SPEC.md
- backend/server.js

## Tasks

<task type="auto">
  <name>Enforce Context-Aware Privacy Filter</name>
  <files>backend/server.js</files>
  <action>
    - Audit vehicle and booking GET responses.
    - Protect `ownerPhone` and sensitive vehicle documents (RC, Insurance, PUC) from public/default responses.
    - Do NOT blindly remove `ownerName`.
    - Do NOT replace existing authorization/enrichment logic with a generic filter that breaks the accepted-booking contact workflow.
    - Enforce the following visibility rules:
      - Pending/Unaccepted Booking: renter must NOT receive owner phone.
      - Rejected/Cancelled Booking: renter must NOT receive owner phone.
      - Accepted/Authorized Booking: permitted renter may receive owner phone.
      - Owners may access their own relevant contact information.
      - Unrelated users must not access another user's contact information.
    - Do NOT delete documents from MongoDB or storage.
  </action>
  <verify>npm run build --prefix backend || true</verify>
  <done>Privacy rules are strictly enforced without breaking valid contact workflows.</done>
</task>

<task type="auto">
  <name>Document Multer Migration Strategy</name>
  <files>.gsd/phases/1/MULTER_MIGRATION_PLAN.md</files>
  <action>
    - Write a detailed document mapping out the required changes in frontend forms to migrate RC, Insurance, PUC, and Avatar uploads directly to Firebase Storage.
    - Keep this as documentation only in Phase 1. Do NOT remove Multer or its backend routes yet.
  </action>
  <verify>test -f .gsd/phases/1/MULTER_MIGRATION_PLAN.md</verify>
  <done>MULTER_MIGRATION_PLAN.md exists and outlines the future migration.</done>
</task>

## Success Criteria
- [ ] `ownerPhone` is hidden in pending/rejected states and revealed in accepted states.
- [ ] RC, Insurance, and PUC are never exposed in public vehicle APIs.
- [ ] Multer logic remains fully intact for current workflows.
