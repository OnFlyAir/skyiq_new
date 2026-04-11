# Project Memory

## Core
SKYIQ — fuel planning app for aviation. Clean, professional aviation UI. Primary blue #1a7ade, accent amber.
New schema: user-scoped (no operators). Tables: profiles, aircrafts, trips (JSONB), carry_types, email_lists.
Fuel optimization runs via Supabase Edge Functions (optimize-fuel, parse-itinerary, send-trip-email).
PDF upload on TripLegsPage sends file directly to Railway API (https://skyiq-api-production.up.railway.app).
Single Supabase client: src/integrations/supabase/client.ts. src/lib/supabase.ts was removed — never recreate it.
Frontend services in src/lib/fuel-service.ts and src/lib/itinerary-service.ts.
