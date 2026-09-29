---
phase: 1
plan: 1
wave: 1
---

# Plan 1.1: Client-Side Image Compression for Vehicle Photos

## Objective
Implement client-side image compression in the frontend using `browser-image-compression` to ensure fast vehicle photo uploads over mobile networks, keeping Firebase Storage as the primary destination, while preserving sufficient quality for vehicle inspection.

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
  <name>Implement Compression with Concurrency Control</name>
  <files>
    frontend/src/pages/OwnerDashboard.jsx
    frontend/src/components/EditVehicleModal.jsx
  </files>
  <action>
    - Import `imageCompression` from `browser-image-compression`.
    - Modify the upload pipelines to compress images before uploading to Firebase Storage.
    - Set target max file size to approximately 1.5MB and `maxWidthOrHeight` to 2048px (these are practical target ranges, not absolute limits).
    - Ensure image quality remains high enough for license plate visibility and vehicle inspection.
    - Implement controlled concurrent uploads, processing approximately 2–3 images at a time to avoid overwhelming the browser/network.
    - Add progress indicators and individual retry handling.
    - Do NOT change the Firebase bucket or database structure.
  </action>
  <verify>npm run build --prefix frontend</verify>
  <done>Images are compressed client-side and uploaded using controlled concurrency.</done>
</task>

## Success Criteria
- [ ] Upload functionality remains intact in both creation and edit views, supporting individual retries and progress indicators.
- [ ] Meaningful size reduction is achieved compared to original photos.
- [ ] Visual quality remains acceptable for inspections and reading license plates.
- [ ] Build passes without linting/compilation errors.
