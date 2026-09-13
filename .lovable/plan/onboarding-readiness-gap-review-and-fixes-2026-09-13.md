# Onboarding readiness — gap review and fixes

## What I checked

Routes, auth flow, billing chain, scheduled jobs, security posture, demo, and sign-up pages.

## What's already solid (no work needed)

- **Billing engine**: $1 trial → 30 days → auto-conversion to tiered pricing ($200/$150/$100 per tail). Both daily jobs (trial reminders, trial conversion) are active and scheduled.
- **Paywall**: expired trials and unpaid accounts are blocked at login; billing-exempt accounts (your friends) bypass it.
- **Cancellation flow**: reason → 20%-off-one-month retention offer → 6-digit email code → cancel at period end. Live and tested.
- **Security**: RLS locked down, immutable admin audit log, security page at /security, cookie consent gate for PostHog.
- **Admin tools**: create users, manage fleets, subscriptions, email log, webhook events, audit log.
- **Demo + guided tour** work end-to-end on desktop and mobile.

## Gaps to fix before onboarding

### 1. Google sign-in (you approved)
- Add "Continue with Google" to both Login and Sign Up pages.
- Uses Lovable's managed Google sign-in — I'll enable and configure it for you; no Google Console setup needed on your side.
- New Google users flow into the same onboarding/$1 trial path as email users.

### 2. Terms of Service + Privacy Policy pages (you approved)
- New `/terms` and `/privacy` pages with standard SaaS terms tailored to SkyIQ: fuel-planning service, uploaded itinerary data, Stripe billing, cancellation terms, data handling (no AI training on client data, per your security page).
- Linked in the sign-up footer ("By continuing you agree to…") and the app footer, so users have a compliance click-through.

### 3. Small polish items
- Sign-up copy says "4 weeks" trial in places while billing grants 30 days — align wording to "30 days".
- Add a link to /security from the login page so prospects see it pre-signup.

## Deliberately left alone

- Everyone currently signed up stays billing-exempt — new signups only go through real billing.
- DFY fuel planning stays hidden from non-admins.
- MFA / leaked-password checks stay deferred (can add later if you want).

## Technical notes

- Google sign-in via `supabase--configure_social_auth` (managed), buttons call `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`; post-auth landing handled by existing RootRedirect.
- Terms/Privacy are static pages, public routes, SEO metadata set, no database changes.
