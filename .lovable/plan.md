

# Plan: Add OFP Upload to Trip Legs Page

## What It Does
Adds a file upload area at the top of the Trip Legs page. When a user uploads a PDF trip sheet, it sends it to the existing Python API at `/api/parse-itinerary`, parses the response, and auto-fills the legs form. A fallback "Try AI Parser" button re-sends the same file to `/api/parse-itinerary-ai`.

## Steps

### 1. Update TripLegsPage.tsx
- Add state for `selectedFile`, `uploading`, and `parseError`
- Add a file input (accept `.pdf`) with an "Upload OFP" button styled consistently with the page
- On file select, POST to `${API_URL}/api/parse-itinerary` as multipart form data
- Map the API response to the existing `LegData` interface:
  - `departure` → `departure_icao`, `destination` → `destination_icao`
  - `departure_fuel_price[0].price` → `fuel_price_tiers[0].price_per_gallon`, `min_fuel` → `min_quantity_gallons`
  - `fees` → sum into `departure_fee_cost`, first waivable fee's `waived_at` → `departure_fee_waived_with`
  - `passengers` → `passenger_weights`, `crew_weight` → `crew_weights`, `baggage` → `baggage_weight`
  - `reserve`, `fuel_burn` mapped directly
  - `starting_fuel` → `fuelOnBoard`
- Also update the trip's `itinerary_num` from the response
- Add a "Try AI Parser" button that sends the same file to `/api/parse-itinerary-ai`
- Show spinner during upload, toast on success/error
- Import `API_URL` from `src/lib/config.ts`
- Import toast from sonner

### No new files needed. Single file change to `src/pages/TripLegsPage.tsx`.

