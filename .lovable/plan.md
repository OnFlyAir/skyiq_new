

# Plan: Replace Database Schema & Add API URL

## Context

This project already has a working Lovable Cloud database with tables (`profiles`, `aircraft`, `trips`, `trip_legs`, `trip_leg_results`, `operators`, `operator_invites`). The user wants to replace this with a new schema from their original C# app that has a different data model — simpler, user-scoped (no operator concept), with trips stored as JSON blobs and a new `carry_types` table.

## Important Considerations

**This is a breaking change.** The new schema is fundamentally different from the current one:
- **No more `operators`** — the new schema ties data directly to users via `user_company` (UUID referencing `profiles.id`)
- **No more `trip_legs` / `trip_leg_results`** — trips store everything as JSON (`details`, `itinerary_details`)
- **`aircraft` → `aircrafts`** with different columns (e.g., `carry_type_id` instead of `operator_id`)
- **New tables:** `carry_types`, `email_lists`
- **`profiles` changes:** drops `operator_id`/`role`, adds `company`/`role_name`/`is_enabled`

All existing page code (Fleet, Trips, Profile, Onboarding, etc.) references the old schema and will break after migration. The code will need significant updates.

## Steps

### 1. Drop Old Tables & Create New Schema (Migration)
Run a migration that:
- Drops old tables: `trip_leg_results`, `trip_legs`, `trips`, `aircraft`, `operator_invites`, `operators`
- Drops and recreates `profiles` with the new columns
- Creates `carry_types`, `aircrafts`, `trips` (new shape), `email_lists`
- Sets up RLS policies, indexes, triggers, and the `is_admin()` function
- Recreates the `handle_new_user` trigger with the new profile columns

### 2. Add VITE_API_URL Environment Variable
Store `VITE_API_URL=https://skyiq-api-production.up.railway.app` as a public env variable in the codebase (since it's a public API URL, not a secret).

### 3. Update TypeScript Types
Rewrite `src/types/database.ts` to match the new schema (remove operator types, update Aircraft/Trip interfaces, add CarryType/EmailList types).

### 4. Update All Pages & Components
Every page that references old tables will need updates:
- **ProfilePage** — remove operator/team roster logic, use new `company`/`role_name` columns
- **FleetPage / AddAircraftPage / AircraftDetailPage** — use `aircrafts` table, `user_company` instead of `operator_id`, handle `carry_type_id`
- **Trip pages** (NewTrip, TripLegs, TripFuel, TripSummary, TripEmail) — use new JSON-based trips table, integrate with the Python API at `VITE_API_URL`
- **DashboardPage / SavingsPage** — update queries
- **OnboardingPage** — remove operator creation flow (no longer needed)
- **ProtectedRoute** — remove operator_id check
- **useAuth / useAuthContext** — update Profile type references
- **AppLayout / navigation** — remove admin/operator-specific nav items

## Technical Details

- The migration will use `DROP TABLE IF EXISTS ... CASCADE` for old tables
- The `profiles` table PK references `auth.users(id)` — same pattern as current but with different columns
- The new `aircrafts` and `trips` tables use `SERIAL` primary keys (integer) instead of UUID
- RLS policies are user-scoped (no operator indirection)
- `carry_types` is read-only for authenticated users (reference data)

