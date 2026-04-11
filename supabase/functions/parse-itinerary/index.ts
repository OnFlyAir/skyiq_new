// Supabase Edge Function: parse-itinerary
// Accepts a PDF text upload, sends to AI for structured parsing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// --- Types ---

interface FuelPrice {
  price: number;
  min_fuel: number;
}

interface FeeWaiver {
  fee_name: string;
  price: number;
  gallons_needed_to_waive: number;
  airport: string;
}

interface TripSegment {
  leg: number;
  departure: string;
  destination: string;
  fuel_prices: FuelPrice[];
  passengers_weights: number[];
  fee_waivers: FeeWaiver[];
}

interface ParsedData {
  crew_itinerary_id: string;
  aircraft_tail_number: string;
  trip_segments: TripSegment[];
}

interface ParsedTrip {
  itinerary_num: string;
  starting_fuel: number;
  aircraft: string;
  legs: ParsedLeg[];
  minimum_fuel_reserve: number;
  max_fuel_reserve: number;
  max_takeoff_weight: number;
  max_landing_weight: number;
  basic_empty_weight: number;
  errors: string[];
  penalty: number;
  lbs_per_hour: number;
}

interface ParsedLeg {
  leg_num: number;
  departure: string;
  destination: string;
  arrival_fuel_price: string;
  departure_fuel_price: FuelPrice[];
  fees: ParsedFee[];
  reserve: number;
  fuel_burn: number;
  passengers: number[];
  baggage: number;
  distance: number;
  crew_weight: number[];
  max_takeoff_weight: number;
  max_landing_weight: number;
  max_ramp_weight: number;
  taxi_fuel_burn: number;
}

interface ParsedFee {
  name: string;
  amount: number;
  is_waivable: boolean;
  waived_at: number;
  airport: string;
}

// --- AI call ---

const PROMPT = `You are an aviation trip sheet parser. Extract structured data from the following trip sheet / crew itinerary document. Be thorough and accurate.

## WHAT TO EXTRACT

### 1. Crew Itinerary ID
- Look for labels like "Crew Itinerary", "Trip ID", "Trip #", "Itinerary #", "CI#", or similar.
- This is usually an alphanumeric code (e.g., "CI-1234", "T2456", "ABC123").
- Do NOT confuse this with a flight number or leg number.

### 2. Aircraft Tail Number
- Look for "Tail #", "Tail Number", "Aircraft", "A/C", "Registration", or similar.
- This is a 2-6 character alphanumeric code like "N7814", "N123AB".
- Do NOT include manufacturer names (e.g., NOT "Challenger 300" — just the tail number).

### 3. Trip Segments (one per leg of the trip)
For EACH leg, extract:

**Departure & Destination:**
- ICAO airport codes (4 characters, e.g., KJFK, KLAX, KTEB).
- Sometimes shown as IATA (3 chars like JFK) — convert to ICAO if possible.

**Fuel Prices at Departure Airport:**
- Look in "Fuel Quotes", "Fuel Prices", "FBO" sections, or any table/list showing $/gallon.
- Often formatted as "$X.XX/gal" or just a decimal price.
- There may be TIERED pricing: a base price and a discounted price if you buy more than X gallons (e.g., "$5.20/gal, $4.80 over 200 gal").
- For each price tier, record: { "price": dollars_per_gallon, "min_fuel": minimum_gallons_for_that_price }.
- If only one price with no minimum stated, set min_fuel to 1.
- IMPORTANT: Fuel prices are PER GALLON, typically between $3.00 and $12.00. Do not confuse total fuel costs with per-gallon prices.

**Passenger Weights:**
- Look for passenger manifest, PAX weights, or passenger list sections.
- If individual weights are given, use them.
- If only a count is given without weights, use -1 for each passenger.
- If no passengers, return an empty list [].

**Fee Waivers:**
- Look for fees marked with "waived with", "ww", "ww/", "waived w/", or "waived at X gallons".
- These are FBO fees (facility fees, ramp fees, handling fees) that get waived if you purchase enough fuel.
- For each waivable fee, extract:
  - fee_name: the name/description of the fee
  - price: the dollar amount of the fee
  - gallons_needed_to_waive: how many gallons you must buy to waive it
  - airport: which airport this fee applies to (ICAO code). If not specified, use the DEPARTURE airport for that leg.
- Only include fees that ARE waivable. Skip non-waivable fees.
- Common fee names: "Facility Fee", "Ramp Fee", "Handling Fee", "Infrastructure Fee", "Landing Fee".

## OUTPUT FORMAT (JSON only, no markdown, no comments):
{
    "crew_itinerary_id": string,
    "aircraft_tail_number": string,
    "trip_segments": [
        {
        "leg": number,
        "departure": string,
        "destination": string,
        "fuel_prices": [
            {
            "price": float,
            "min_fuel": float
            }
        ],
        "passengers_weights": [float],
        "fee_waivers": [
            {
            "fee_name": string,
            "price": float,
            "gallons_needed_to_waive": float,
            "airport": string
            }
        ]
    }]
}

IMPORTANT RULES:
- Return ONLY valid JSON. No summaries, no comments, no markdown fences.
- All airport codes must be ICAO format (4 characters starting with K for US airports).
- Fuel prices are per gallon (typically $3-$12 range).
- If you cannot find a value, use reasonable defaults: empty string for text, 0 for numbers, empty array for lists.
- Do not include "//" comments in the JSON output.`;

async function parseWithAI(text: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `Here is the trip sheet content:\n\n${text}` },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error("Rate limited — please try again in a moment");
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

function convertToTrip(jsonStr: string): ParsedTrip {
  const parsed: ParsedData = JSON.parse(extractJson(jsonStr));

  const legs: ParsedLeg[] = parsed.trip_segments.map((segment) => {
    const fees: ParsedFee[] = (segment.fee_waivers || [])
      .filter((w) => w.price > 0 && w.gallons_needed_to_waive > 0)
      .map((w) => ({
        name: w.fee_name,
        amount: w.price,
        is_waivable: true,
        waived_at: w.gallons_needed_to_waive,
        airport: w.airport || segment.departure,
      }));

    return {
      leg_num: segment.leg,
      departure: segment.departure,
      destination: segment.destination,
      arrival_fuel_price: "",
      departure_fuel_price: segment.fuel_prices || [],
      fees,
      reserve: 0,
      fuel_burn: 0,
      passengers: segment.passengers_weights || [],
      baggage: 0,
      distance: 0,
      crew_weight: [0],
      max_takeoff_weight: 0,
      max_landing_weight: 0,
      max_ramp_weight: 0,
      taxi_fuel_burn: 0,
    };
  });

  return {
    itinerary_num: parsed.crew_itinerary_id,
    starting_fuel: 0,
    aircraft: parsed.aircraft_tail_number,
    legs,
    minimum_fuel_reserve: 0,
    max_fuel_reserve: 0,
    max_takeoff_weight: 0,
    max_landing_weight: 0,
    basic_empty_weight: 0,
    errors: [],
    penalty: 0,
    lbs_per_hour: 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let pdfText = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      pdfText = await file.text();
    } else {
      const body = await req.json();
      pdfText = body.text ?? "";
    }

    if (!pdfText) {
      return new Response(
        JSON.stringify({ error: "No PDF text content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResponse = await parseWithAI(pdfText);

    if (!aiResponse) {
      return new Response(
        JSON.stringify({ error: "AI returned empty response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trip = convertToTrip(aiResponse);

    return new Response(
      JSON.stringify(trip),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Parse failed: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
