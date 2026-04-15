

# Plan: Fix Email Signup + Build Interactive Guided Demo

## Two Parts

### Part 1: Fix Email Signup
The signup flow calls `supabase.auth.signOut()` immediately after `signUp()`, which signs out the unconfirmed user. The likely issue is that email confirmation is required but confirmation emails are not being delivered (no custom email domain is configured, so it relies on default Lovable emails). 

**Fix:** Enable auto-confirm for signups so new users can sign in immediately without waiting for a confirmation email. This removes the friction and gets users into the app right away. The `signOut()` call after signup and the "check your email" screen will be replaced with an immediate redirect to onboarding/dashboard.

### Part 2: Interactive Guided Demo (29-Step Tour)
Replace the existing simple `Walkthrough` modal with a full interactive guided demo system. This is a major feature — a step-by-step tour that highlights real UI elements, pre-fills data, and walks first-time users through the entire SkyIQ workflow.

**Architecture:**
- A new `DemoManager` context/provider that tracks demo state (active, current step, sub-step)
- A `DemoOverlay` component that renders spotlight highlights on target elements, tooltip popups with instructions, and "Next" buttons
- A `DemoDataProvider` that seeds demo data (pre-fills NSKYIQ tail number, auto-selects Cessna/CJ3, provides a bundled demo PDF itinerary)
- A "DEMO" link in the sidebar that can restart the tour at any time
- Demo state stored in localStorage so it persists across page navigations

**Step-by-step flow (29 steps across multiple pages):**

1. Welcome overlay → "Click Dashboard" in sidebar
2. Dashboard → "Click Manage Fleet" in sidebar  
3. Fleet page → "Click Add Aircraft"
4. Add Aircraft page → Auto-fill tail number NSKYIQ, basic empty weight 8300
5. Select manufacturer Cessna/Textron from dropdown
6. Select model CE525b CJ3 from dropdown (auto-fills specs)
7-12. Quick tooltip walkthroughs of each field in the aircraft profile (MTOW, fuel capacity, burn rate, etc.)
13. Click Save
14. Success message: "Great job! Now you're ready to plan your trips"
15. Navigate to Plan a Trip
16. Click Upload PDF — demo auto-populates a bundled sample PDF file
17. Click "Check Itinerary" — guide user to verify parsed data
18-19. Walk through Leg 1 fields with one-liner explanations
20. Guide user to verify each leg
21. Point out trash can icon for deleting legs
22. Point out Add Leg button
23. Click "Next: Fuel Burns"
24. Tell user what numbers to enter in each fuel burn box (TBD from you)
25. Expand weight limits
26. Click Confirm Trip
27. Optimizer strategy explanation
28. Walk through Leg 1 summary numbers
29. Click Full Summary → Quick Reference view
30. Click Send Email
31. Enter email and send
32. Closing: email sent, find trips in sidebar, more features to discover
33. Final note: access demo anytime via DEMO in sidebar, email info@skyiq.net for questions

**Key technical decisions:**
- The demo will use a "spotlight + tooltip" pattern (darken everything except the target element, show a tooltip with instructions)
- Navigation between pages happens automatically when the user completes a step
- Demo data (aircraft, trip) is real data created in the database but tagged as demo data for easy cleanup
- The bundled PDF will need to be provided by you (I'll need you to upload the specific itinerary PDF for the demo)
- Fuel burn numbers for step 24 will need to be provided by you

**Sidebar addition:**
- Add a "Demo" nav item to the sidebar with a play icon
- Clicking it resets and restarts the guided tour

**Files to create/modify:**
- `src/contexts/DemoContext.tsx` — demo state management
- `src/components/demo/DemoOverlay.tsx` — spotlight + tooltip overlay
- `src/components/demo/DemoSteps.ts` — step definitions (target selectors, text, actions)
- `src/components/layout/AppLayout.tsx` — add Demo link to sidebar
- `src/pages/SignUpPage.tsx` — fix signup flow
- `src/pages/LoginPage.tsx` — minor adjustments
- `src/pages/AddAircraftPage.tsx` — demo data pre-fill hooks
- `src/pages/TripLegsPage.tsx` — demo hooks for guided interaction
- `src/pages/TripFuelPage.tsx` — demo hooks
- `src/pages/TripSummaryPage.tsx` — demo hooks
- `src/pages/TripEmailPage.tsx` — demo hooks
- Various pages will need `data-demo` attributes on key elements for targeting
- Remove old `Walkthrough.tsx` component

**What I need from you before implementation:**
1. The specific demo PDF itinerary file to bundle
2. The fuel burn numbers for each leg (step 24)
3. Confirmation that auto-confirm email signup is acceptable

This is a large feature that will be built incrementally — signup fix first, then the demo system framework, then wiring up each of the 29 steps.

