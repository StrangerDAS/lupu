# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: MVP Hardening (v1.0)

## Must-Haves (from SPEC)
- [ ] Client-side compression eliminates photo upload bottlenecks on mobile networks.
- [ ] A single reliable payment record exists for offline/cash payments, visible to all parties.
- [ ] All critical user flows (booking, payment, KYC, listing) pass empirical testing verification.
- [ ] Admin panel successfully manages verifications, roles, and disputes.
- [ ] Platform is fully mobile-responsive and secure against unauthorized API access.

## Phases

### Phase 1: Security & Foundation
**Status**: ⬜ Not Started
**Objective**: Lock down backend API authorization, secure Firebase/MongoDB credentials, enforce role-based access, and implement client-side image compression for fast uploads.
**Requirements**: REQ-01, REQ-02, REQ-03

### Phase 2: Core Workflows & Privacy
**Status**: ⬜ Not Started
**Objective**: Perfect the vehicle listing, KYC document upload privacy, booking flow, and owner/renter contact privacy.
**Requirements**: REQ-04, REQ-05, REQ-08

### Phase 3: Payments & Disputes
**Status**: ⬜ Not Started
**Objective**: Implement offline/cash payment tracking with a single source of truth, handle security deposits, and establish damage/cancellation/dispute workflows.
**Requirements**: REQ-06, REQ-07

### Phase 4: Admin Controls & Dashboards
**Status**: ⬜ Not Started
**Objective**: Complete the Admin panel, Owner settings, user dashboards, and comprehensive system notifications.
**Requirements**: REQ-09

### Phase 5: Polish & Verification
**Status**: ⬜ Not Started
**Objective**: Fix mobile responsiveness/UX, ensure robust production error handling, and rigorously test all critical user flows before final deployment.
**Requirements**: REQ-10, REQ-11
