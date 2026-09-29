# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
Turn the existing LUPU codebase into a stable, secure, production-ready MVP by systematically finishing, testing, and hardening existing features for vehicle rentals.

## Goals
1. Stabilize and secure authentication, user profiles, and backend API authorization.
2. Perfect the vehicle listing, image uploads (with client-side compression), and document KYC handling with strict privacy.
3. Finalize core user flows: exploring rentals, booking workflows, dashboard management, and offline/cash payment tracking.
4. Implement reliable administrative and support systems: admin panel, dispute/damage workflows, and system notifications.
5. Ensure production readiness through exhaustive testing, empirical verification, mobile responsiveness, and active monitoring.

## Non-Goals (Out of Scope)
- Rebuilding the application from scratch or changing the architecture without strong technical reasons.
- Re-engineering already working features unnecessarily.
- Removing existing production functionality.
- Automating deployments or pushing changes without explicit manual approval.

## Users
- **Renters**: Customers looking to explore, book, and securely rent vehicles.
- **Owners**: Users listing their vehicles, managing bookings, communicating securely, and receiving payments.
- **Admins**: Platform operators overseeing verifications, disputes, and system integrity.

## Constraints
- **Security**: Strict zero-exposure policy for secrets, Firebase keys, MongoDB credentials, or environment variables.
- **Data Protection**: Do not modify production data unless explicitly requested. Protect owner/renter contact information privacy.
- **Methodology**: Prefer small, testable phases. Every implementation must be verified with actual tests/proof before being considered complete.
- **Foundation**: Treat the existing codebase and the GSD codebase map as the absolute starting point.

## Success Criteria
- [ ] Client-side compression eliminates photo upload bottlenecks on mobile networks.
- [ ] A single reliable payment record exists for offline/cash payments, visible to all parties.
- [ ] All critical user flows (booking, payment, KYC, listing) pass empirical testing verification.
- [ ] Admin panel successfully manages verifications, roles, and disputes.
- [ ] Platform is fully mobile-responsive and secure against unauthorized API access.
