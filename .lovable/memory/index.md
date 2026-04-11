# Project Memory

## Core
SKYIQ — fuel planning app for aviation. Clean, professional aviation UI. Primary blue #1a7ade, accent amber.
New schema: user-scoped (no operators). Tables: profiles, aircrafts, trips (JSONB), carry_types, email_lists.
Fuel optimization runs via Supabase Edge Functions (optimize-fuel, parse-itinerary, send-trip-email).
Frontend services in src/lib/fuel-service.ts and src/lib/itinerary-service.ts call edge functions directly.
Two Supabase clients exist: src/lib/supabase.ts (used by new trip/fuel pages) and src/integrations/supabase/client.ts (used by original Lovable pages). Both use VITE_SUPABASE_PUBLISHABLE_KEY.
