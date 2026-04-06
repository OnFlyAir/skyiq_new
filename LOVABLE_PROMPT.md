Build me a full-stack aviation fuel planning web app called **skyIQ** (tagline: "Fly Smarter") using React, TypeScript, Tailwind CSS, and Supabase.

---

## BRAND & COLORS

- Primary brand color (logo, sidebar): #1a3a5c (dark navy blue)
- Auth page background: light blue tint (#87ceeb at 30% opacity)
- Accent/buttons/links: #2563eb (blue)
- Success (savings): #16a34a (green)
- Warning: #f59e0b
- Danger: #dc2626
- Logo: text-based "skyIQ" in bold navy, with "Fly Smarter" subtitle in gray

---

## AUTH (Supabase Auth)

Three roles: `super_admin`, `operator_admin`, `pilot`.

### Login Page (`/login`)
Centered card on light blue background with skyIQ logo above. Fields: email, password, "Remember me?" checkbox. "Log in" button in accent blue. Links to Sign Up and Reset Password below.

### Sign Up Page (`/signup`)
Same centered card layout. Fields: first name, last name (side by side), email, password, confirm password. "Sign up with email" button. On success, show "Check your email" confirmation with link back to login.

### Reset Password Page (`/reset-password`)
Email input, "Send reset link" button. On success shows confirmation message.

---

## ONBOARDING (`/onboarding`)

Shown when a logged-in user has no `operator_id`. Full-screen centered layout (no sidebar). Two large cards to choose:

1. **"Create an Operator Account"** — "I'm setting up my company on skyIQ". Leads to a form with company name input. Creates an operator record and links the user as `operator_admin`.

2. **"Join an Existing Operator"** — "I've been invited by my company". Checks for a pending invite matching the user's email. If found, links the user to that operator.

---

## APP LAYOUT (Sidebar)

All authenticated pages use a sidebar layout:

**Sidebar (left, 288px wide):**
- Top: "skyIQ" logo + "Fly Smarter" text, with close button on mobile
- Search input: "Search Tail #/Trip"
- Nav links with icons:
  - Dashboard (Home icon)
  - Plan a Trip (Plane icon)
  - Manage Fleet (Settings icon)
  - Savings Accrued (DollarSign icon)
- Bottom: User avatar (initials in navy circle), full name, role label, sign out button

**Mobile:** Hamburger menu in top bar, sidebar slides in as overlay with dark backdrop.

**Main content:** Scrollable area with padding.

---

## PAGES

### 1. Dashboard (`/dashboard`)
- Operator company name centered at top
- Large "skyIQ / Fly Smarter" logo centered
- Two action cards side by side (max 200px each):
  - **"Plan a trip"** — Plane icon, subtitle "Fool-proof fuel planning", links to `/trips/new`
  - **"Manage Fleet"** — Settings icon, subtitle "View/Edit aircraft, add tail#'s", links to `/fleet`
- Below: "Previous Trips" section — list of recent trips showing trip number, aircraft name, date, with chevron right icon. Each links to the trip summary.

### 2. Fleet (`/fleet`)
- Title: "Select an Aircraft"
- Grid (2-4 columns responsive) of aircraft cards: large Plane icon + nickname or tail number
- For admins: dashed "Add Aircraft" card with Plus icon

### 3. Add Aircraft (`/fleet/add`)
- Title: "Add an Aircraft"
- Form with label-input rows (label on left, input on right):
  - Tail Number (text, required)
  - Nickname (text, optional)
  - Basic Empty Weight in lbs (number)
  - Max Takeoff Weight in lbs (number)
  - Max Landing Weight in lbs (number)
  - Max Ramp Weight in lbs (number)
  - Preferred Reserve in lbs (number)
  - Max Fuel Capacity in lbs (number)
  - Taxi Fuel Burn in lbs (number)
  - Default PAX Weight (number)
  - Baggage Weight with PAX (number)
  - Baggage Weight without PAX (number)
  - Default PIC Weight (number)
  - Default SIC Weight (number)
  - Cabin Attendant Weight (number)
  - Manufacturer (text)
  - Model (text)
  - Cruise Fuel Burn (number)
  - Penalty Rate (number)
  - Type (dropdown): Very Light Jet, Light Jet, Midsize Jet, Super-Mid Jet, Large Jet, Heavy Jet, Ultra-Long Range Jet, Turboprop
- "Add Aircraft" submit button
- Note: "Ensure this data is accurate. You can make edits from the manage fleet menu."

### 4. Aircraft Detail (`/fleet/:id`)
- Back to Fleet link with arrow
- Aircraft name as title
- Edit (pencil) and Delete (trash) buttons for admins
- White card with divider rows showing all aircraft specs (label left, value right)

### 5. New Trip (`/trips/new`)
- Title: "Plan a Trip"
- Aircraft dropdown selector
- Trip Number text input (optional)
- When aircraft is selected, show two options:
  - **"Upload Itinerary"** — Upload icon, PDF file input, "Upload your trip sheet PDF and we'll extract the details"
  - **"No Itinerary"** — Plus icon, "Add a blank leg and fill out all the details manually"
- Creates a trip record and navigates to legs page

### 6. Trip Legs (`/trips/:tripId/legs`)
- Title: "Plan a Trip" with subtitle showing aircraft name
- Per-leg cards (white bordered, rounded) containing:
  - Leg number header
  - Departure ICAO + Destination ICAO inputs (side by side)
  - Fee Cost (USD) + Waived With inputs (side by side)
  - Crew Weights (comma-separated text input)
  - Passenger Weights (comma-separated text input)
  - Baggage Weight (number)
  - Departure Fuel Prices section: repeatable tier rows with "Price Per Gallon ($USD)" and "Min Quantity per Rate (gal)" inputs. "Add fuel price option" and "Remove fuel price option" buttons.
  - Reserve, Taxi Fuel Burn, Max Takeoff Weight, Max Landing Weight (2x2 grid)
  - Note: "Be Sure to Adjust Max Takeoff & Max Landing weights to ensure sufficient Runway."
  - "Yes" button (green border when active) to save leg, "Leg Not Needed" button to deactivate
- "Add Leg" button below all legs
- "Next — Starting fuel and fuel burns" button to proceed

### 7. Trip Fuel (`/trips/:tripId/fuel`)
- Title: "Plan a Trip" with aircraft name subtitle
- "Current Fuel on Board Aircraft" number input with note about max fuel capacity
- Per-leg fuel burn inputs showing leg number, departure, destination, and fuel burn input
- "Confirm trip" button and "Return to previous page" button

### 8. Trip Summary (`/trips/:tripId/summary`)
- Title: "Trip [number] Summary"
- Toggle between "Full Summary" and "Quick Ref" views (accent colored active tab)
- Per-leg bordered cards with table rows:
  - **Full view:** Fuel to Uplift (gal + lbs), Starting Fuel, Fuel Burn, Landing Fuel, Takeoff Weight, Landing Weight, Fuel Cost, Waived Fees, Total Cost
  - **Quick Ref:** Uplift, Starting Fuel, Fuel Burn, Waived Fees only
- Total Cost at bottom (full view only)
- Action buttons: toggle view, Send Email link, Edit Itinerary link

### 9. Trip Email (`/trips/:tripId/email`)
- Title: "Trip Summary" / "Quick Ref Fuel Plan"
- Table with checkbox + email input per row
- "Send Email", "Add Email", "Remove Email" buttons (dark gray)
- On send: success message with "Back to Trip Summary" button

### 10. Savings (`/savings`)
- Title: "Potential Savings Earned"
- Italic subtitle explaining the savings calculation methodology
- Stats: Total Savings (dollar amount) and Fuel Plans Calculated (count)
- Grid of aircraft with large Plane icons, aircraft name, and savings amount in green
- Empty state: "No trips calculated yet. Plan a trip to see your savings!"

### 11. Profile (`/profile`)
- Title: "Edit User"
- Form: First Name, Last Name (editable), Email, Company (read-only gray). "Save changes" button.
- **Admin section** (operator_admin and super_admin only):
  - "Team Roster" — list of team members with name, email, and role dropdown (Pilot/Admin)
  - "Invite a team member" — email input + role dropdown + "Invite" button

### 12. Admin Dashboard (`/admin`) — super_admin only
- Title: "Platform Overview"
- Three stat cards: Est. Savings, Trips Run, Tails (3-column grid)
- "Trips/Tails" section with search input
- List of operators: company name, trips count, estimated savings, last trip date

---

## SUPABASE DATABASE SCHEMA

### Tables:

**operators** — id (uuid), name (text), created_by (uuid ref auth.users), created_at, updated_at

**profiles** — id (uuid ref auth.users, primary key), email, first_name, last_name, role (enum: super_admin/operator_admin/pilot, default pilot), operator_id (uuid ref operators, nullable), created_at, updated_at

**operator_invites** — id, operator_id (ref operators), email, role (enum: operator_admin/pilot), status (enum: pending/accepted/declined), invited_by (ref auth.users), created_at

**aircraft** — id, operator_id (ref operators), tail_number, nickname (nullable), manufacturer, model, aircraft_type (enum: very_light_jet/light_jet/midsize_jet/super_mid_jet/large_jet/heavy_jet/ultra_long_range_jet/turboprop), basic_empty_weight, max_takeoff_weight, max_landing_weight, max_ramp_weight, preferred_reserve, max_fuel_capacity, taxi_fuel_burn, default_pax_weight (default 170), baggage_weight_with_pax, baggage_weight_without_pax, default_pic_weight (default 200), default_sic_weight (default 200), cabin_attendant_weight, cruise_fuel_burn, penalty_rate, created_at, updated_at

**trips** — id, operator_id (ref operators), aircraft_id (ref aircraft), trip_number, status (enum: draft/confirmed/completed), current_fuel_on_board (numeric, default 0), total_cost (nullable), total_savings (nullable), created_by (ref auth.users), created_at, updated_at

**trip_legs** — id, trip_id (ref trips), leg_number (integer), departure_icao, destination_icao, departure_fee_cost (default 0), departure_fee_waived_with (default 0), crew_weights (numeric array), passenger_weights (numeric array), baggage_weight (default 0), fuel_price_tiers (jsonb array of {price_per_gallon, min_quantity_gallons}), reserve (default 0), taxi_fuel_burn (default 0), max_takeoff_weight (default 0), max_landing_weight (default 0), fuel_burn (default 0), is_active (boolean default true), created_at, updated_at

**trip_leg_results** — id, trip_leg_id (ref trip_legs), fuel_to_uplift_gallons, fuel_to_uplift_lbs, starting_fuel_lbs, landing_fuel_lbs, takeoff_weight_lbs, landing_weight_lbs, fuel_cost, waived_fees (text), total_cost, created_at

**trip_uploads** — id, trip_id (ref trips), uploaded_by (ref auth.users), file_name, file_path, parsed_data (jsonb), created_at

### Database Triggers:
- Auto-create profile when user signs up (copies email, first_name, last_name from user metadata)
- Auto-accept pending invites on signup (links profile to operator)
- updated_at auto-update triggers on profiles, operators, aircraft, trips, trip_legs

### Row Level Security:
- Users see their own profile; operator members see each other; super_admins see all
- Operators visible to their members and super_admins
- Aircraft scoped to operator
- Trips scoped to operator; creators and admins can update
- Trip legs/results scoped through trip ownership
- Super_admins bypass all restrictions

### Storage:
- Bucket: `trip-uploads` (private) for PDF itinerary uploads

---

## DESIGN NOTES
- Clean, minimal, professional. Lots of white space.
- Inputs: gray-100 backgrounds, gray-200 borders, rounded-lg, text-sm
- Cards: white background, gray-200 border, rounded-xl
- Buttons: accent blue for primary actions, gray-900 for secondary
- Hover states: cards get accent border color on hover
- Loading: spinning circle with accent border
- Mobile responsive throughout
- Support email: info@skyiq.net (shown on auth pages footer)
