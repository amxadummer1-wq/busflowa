# BUS FLOW — Phase 1

## Outcome
Build the requested first phase of BUS FLOW: a premium mobile-first splash, account access, and Admin workspace inspired by the supplied mockup.

## Scope
- Animated BUS FLOW splash with a small moving bus and loader, automatically opening sign-in.
- Email/password sign-in and Admin-only public account creation, with validation, secure session handling, and role-based navigation. Include Google and Sign in with Lovable alongside email/password.
- Admin dashboard with the requested summaries and quick-access destinations; implement Users & Staff as the functional administrative area.
- Staff management for conductor accounts: create accounts with conductor role, full name, email, assigned bus/route, and active status; edit assignments/details, change status, reset passwords, and show account state.
- A minimal protected Conductor destination only, ready for the next phase; no conductor dashboard, booking, QR payment, or ticket-generation implementation.
- Installable manifest and app icons without offline caching.

## Build approach
Use Lovable Cloud for persistent account/profile data and secure role checks. Keep roles separate from profiles, protect every Admin staff action on the server, and make public registration create Admin accounts only. Use the project's managed schema workflow rather than hand-editing managed database migrations. Honor the requested immediate sign-in after Admin registration through the appropriate auth setting.

Use the project's existing TanStack Start routes and design tokens, add route-specific metadata, and validate the main account and role flows plus mobile presentation before finishing.
