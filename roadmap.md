
## Billing activation (Sep 13)
- [x] Repricing: 1-3 planes $200/plane, 4-6 $150/plane, 7+ $100/plane (app, checkout, Stripe helper, DB function)
- [x] $1 trial = 30 days, access granted only after the $1 clears (checkout.session.completed)
- [x] Auto-start real Stripe subscription at trial end on saved card (convert-expiring-trials, daily 09:30 UTC)
- [x] Expired trials blocked at ProtectedRoute
- [x] Fixed broken cron auth (reminder job had been failing 401 daily)
- [ ] BLOCKED ON USER: 9 of 10 existing accounts are flagged billing-exempt, including the three on legacy $1
      recurring plans (ben@onflyair.com, pierce@onflyair.com, paiged115@yahoo.com) and the stale May-Jul trials.
      Conversion + repricing skip them by design. User must say which accounts should start paying.
      Then run convert-expiring-trials with {"repair_pricing": true} and/or clear the exempt flags.
- [ ] Send test of all billing email types from info@skyiq.net to pierce@onflyair.com (test-billing-emails function)
