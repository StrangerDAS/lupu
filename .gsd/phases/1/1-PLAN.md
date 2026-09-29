---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Client-Side Image Compression for Vehicle Photos

## Objective
Implement client-side image compression in the frontend using `browser-image-compression` to ensure fast vehicle photo uploads over mobile networks, keeping Firebase Storage as the primary destination.

## Context
- .gsd/SPEC.md
- .gsd/ROADMAP.md
- frontend/src/pages/OwnerDashboard.jsx
- frontend/src/components/EditVehicleModal.jsx

## Tasks

<task type="auto">
  <name>Install Compression Dependency</name>
  <files>frontend/package.json</files>
  <action>
    Install `browser-image-compression` in the frontend directory.
  </action>
  <verify>grep browser-image-compression frontend/package.json</verify>
  <done>Dependency is successfully added and installed.</done>
</task>

<task type="auto">
  <name>Implement Compression in OwnerDashboard</name>
  <files>frontend/src/pages/OwnerDashboard.jsx</files>
  <action>
    - Import `imageCompression` from `browser-image-compression`.
    - Modify the `handlePhotoChange` or the `onSubmit` upload pipeline to compress images before uploading to Firebase Storage.
    - Set target max file size to ~1.5MB and `maxWidthOrHeight` to 2048px.
    - Add controlled concurrent uploads, progress indicators, and retry handling.
    - Do NOT change the Firebase bucket or database structure.
  </action>
  <verify>npm run build --prefix frontend</verify>
  <done>Images are compressed client-side before being pushed to Firebase.</done>
</task>

<task type="auto">
  <name>Implement Compression in EditVehicleModal</name>
  <files>frontend/src/components/EditVehicleModal.jsx</files>
  <action>
    - Apply the identical compression logic (max size 1.5MB, max width/height 2048px) used in `OwnerDashboard.jsx` to `EditVehicleModal.jsx`.
    - Ensure progress indicators are visible during upload.
  </action>
  <verify>npm run build --prefix frontend</verify>
  <done>Images uploaded via editing are also compressed.</done>
</task>

## Success Criteria
- [ ] Compression logic successfully shrinks 10MB images to < 1.5MB.
- [ ] Upload functionality remains intact in both creation and edit views.
- [ ] Build passes without linting/compilation errors.
