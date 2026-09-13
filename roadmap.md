
## Billing activation (Sep 13)
- [x] Repricing: 1-3 planes $200/plane, 4-6 $150/plane, 7+ $100/plane (app, checkout, Stripe helper, DB function)
- [x] $1 trial = 30 days, access granted only after the $1 clears (checkout.session.completed)
- [x] Auto-start real Stripe subscription at trial end on saved card (convert-expiring-trials, daily 09:30 UTC)
- [x] Expired trials blocked at ProtectedRoute
- [x] Fixed broken cron auth (reminder job had been failing 401 daily)
- [x] Existing accounts: ALL stay billing-exempt (user decision Sep 12) — nobody currently signed up pays.
      New self-serve signups go through normal $1 trial -> paid conversion.

## Onboarding readiness (Sep 13)
- [x] Google sign-in on login + signup (managed OAuth, enabled)
- [x] handle_new_user trigger now pulls full name from Google metadata
- [x] Terms of Service (/terms) + Privacy Policy (/privacy) pages, linked from auth footer + signup consent line
- [x] Trial copy aligned to "30 days" everywhere (was mixed 4 weeks / 28 days)
- [x] Sent test of all 5 billing email types from info@skyiq.net to pierce@onflyair.com — all logged sent
