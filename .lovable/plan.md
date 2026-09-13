# Turn on real Stripe billing after the $1 trial

## What I found

I traced the full billing chain (checkout → Stripe → webhook → database → access control) and checked live account data. **Right now, paid billing never starts.** Everyone who signs up stays on a free trial forever.

Evidence from the live data: every trial account has a Stripe customer but **no Stripe subscription**, and trials from May, June and July are still marked "trial" today — still with full access, never billed.

The specific gaps:

1. **Nothing creates the recurring plan.** The $1 signup is a one-time charge only (deliberately, to avoid the old double-charge problem). The card is saved for later, but no code ever uses it to start the real plan. The comment in the checkout code says the subscription is "created later inside the app" — that part was never built.
2. **Trial end does nothing.** The daily job emails "your trial is ending", then the trial end date simply passes. Access is never cut off and no charge is attempted.
3. **Payment is never confirmed.** The trial row is written when checkout *opens*, not when the $1 actually clears. Someone can open checkout, close it, and still get a full trial.
4. **Trial length is inconsistent.** Sign-up copy says 4 weeks; the database default gives 30 days.
5. **Legacy $1 plans.** Three older accounts have a real Stripe subscription charging $1 per cycle instead of their true fleet price.

## What I'll build

### 1. Confirm the $1 payment properly
Add handling for the checkout-completed event from Stripe. Only when the $1 actually clears do we:
- mark the account as on trial, starting *then*,
- set the trial end to exactly 28 days out,
- store the saved card so it can be charged later,
- enable the account.

### 2. New job: start the real plan at trial end
A daily job that finds trials whose end date has arrived and, for each one:
- counts the account's active aircraft and computes the tiered price (unchanged pricing: $200/$150/$100 per tail, 20% off annual),
- creates the real recurring Stripe subscription on the saved card, on their chosen cycle,
- marks the account active and emails a confirmation.

Edge cases handled explicitly:
- **No aircraft on file** → don't guess a price. Move the account to a "needs setup" state: access blocked with a clear prompt to add aircraft and activate, plus an email. No surprise charge.
- **Card declines** → account goes past-due, the existing past-due email and access block kick in, Stripe retries.
- **Billing-exempt / Admin / Dev** → skipped entirely.
- Safe to run repeatedly; it will never double-charge or create two subscriptions.

### 3. Close the "free forever" hole
Account access currently treats "trial" as valid regardless of date. It will additionally require the trial end date to still be in the future.

### 4. Clean up existing accounts
- The four expired trials (May–July) get flagged for your review in the admin area rather than being silently charged — you decide whether to activate or close them.
- The three $1 legacy subscriptions get corrected to their true fleet price at their next renewal, with a plan-change email.

### 5. Admin visibility
Add a "Trial conversions" panel to the admin subscriptions page: upcoming conversions, conversions that failed, and accounts stuck without aircraft — with a manual "convert now" button.

## Technical notes

- New edge function `convert-expiring-trials`, scheduled daily via pg_cron using the existing `CRON_SECRET` header pattern.
- `payments-webhook` gains a `checkout.session.completed` case; it reads `payment_intent.payment_method` and stores it as the customer's default payment method (`invoice_settings.default_payment_method`) so off-session subscription creation succeeds.
- Subscription creation uses the same inline `price_data` shape already used in `sync-subscription-billing`, so cycle switching and aircraft-count syncing keep working unchanged.
- Idempotency: conversion only runs when `status = 'trial'` and `stripe_subscription_id is null`, and the row is stamped inside the same call.
- `ProtectedRoute` gains a trial-expiry date check alongside the existing status check.
- No pricing logic changes; `calcPriceCents` remains the single source of truth.
