// Supabase Edge Function: parse-itinerary
// Accepts a PDF upload, sends to AI for structured parsing.
// Saves parsed client data to onfly_data and PDF to storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  client_name: string;
  client_email: string;
  client_phone: string;
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
  client_name: string;
  client_email: string;
  client_phone: string;
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

### 3. Client / Passenger Contact Info
- Look for the PRIMARY client or passenger name, email, and phone number.
- Check "Passenger Manifest", "PAX Info", "Client", "Requester", "Booked By", "Contact", header sections.
- If multiple passengers, use the FIRST listed or the one labeled as primary/requester.
- Extract: client_name (full name), client_email, client_phone.

### 4. Trip Segments (one per leg of the trip)
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
    "client_name": string,
    "client_email": string,
    "client_phone": string,
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

async function parseWithAI(pdfBase64: string, retries = 3): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Parse this trip sheet PDF and extract all the data as specified.",
              },
            ],
          },
        ],
      }),
    });

    if (response.status === 429) {
      const delay = Math.pow(2, attempt) * 2000;
      console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    if (response.status === 402) {
      throw new Error("AI credits exhausted — please add funds in Settings > Workspace > Usage");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI API error (${response.status}):`, errorText);
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  }

  throw new Error("Rate limited after multiple retries — please try again later");
}

function extractJson(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.trim();
}

function convertToTrip(jsonStr: string): { trip: ParsedTrip; parsed: ParsedData } {
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

  const trip: ParsedTrip = {
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
    client_name: parsed.client_name || "",
    client_email: parsed.client_email || "",
    client_phone: parsed.client_phone || "",
  };

  return { trip, parsed };
}

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) throw new Error("Missing Supabase config");
  return createClient(url, serviceKey);
}

async function saveToOnflyAndStorage(
  pdfBase64: string,
  parsed: ParsedData,
  trip: ParsedTrip,
  userId: string,
  tripId?: number,
) {
  const supabaseAdmin = getSupabaseAdmin();

  // Save PDF to storage
  const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const storagePath = `${userId}/${Date.now()}_${parsed.crew_itinerary_id || "itinerary"}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("itinerary-pdfs")
    .upload(storagePath, pdfBytes, { contentType: "application/pdf" });

  if (uploadError) {
    console.error("PDF upload error:", uploadError);
  } else {
    console.log("PDF uploaded to:", storagePath);
  }

  const rowData = {
    user_id: userId,
    client_name: parsed.client_name || "",
    client_email: parsed.client_email || "",
    client_phone: parsed.client_phone || "",
    itinerary_num: parsed.crew_itinerary_id || "",
    raw_itinerary: trip as unknown as Record<string, unknown>,
    pdf_storage_path: uploadError ? null : storagePath,
  };

  // Upsert: update if trip_id already exists, insert otherwise
  if (tripId) {
    const { data: existing } = await supabaseAdmin
      .from("onfly_data")
      .select("id")
      .eq("trip_id", tripId)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabaseAdmin.from("onfly_data").update(rowData).eq("id", existing[0].id);
    } else {
      await supabaseAdmin.from("onfly_data").insert({ ...rowData, trip_id: tripId });
    }
  } else {
    await supabaseAdmin.from("onfly_data").insert({ ...rowData, trip_id: null });
  }
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
    // Extract user from JWT
    const authHeader = req.headers.get("authorization") ?? "";
    let userId = "";
    let tripId: number | undefined;

    if (authHeader.startsWith("Bearer ")) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
        console.log("Auth result:", user?.id ?? "no user", authError?.message ?? "no error");
        userId = user?.id ?? "";
      } catch (e) {
        console.error("Auth extraction failed:", e);
      }
    } else {
      console.log("No Bearer token found in authorization header");
    }

    const contentType = req.headers.get("content-type") ?? "";
    let pdfBase64 = "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      pdfBase64 = body.pdf_base64 ?? "";
      tripId = body.trip_id ?? undefined;
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      pdfBase64 = btoa(binary);
    }

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: "No PDF content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResponse = await parseWithAI(pdfBase64);

    if (!aiResponse) {
      return new Response(
        JSON.stringify({ error: "AI returned empty response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { trip, parsed } = convertToTrip(aiResponse);

    // Save to onfly_data and storage (server-side only)
    console.log("userId for save:", userId, "tripId:", tripId);
    if (userId) {
      try {
        await saveToOnflyAndStorage(pdfBase64, parsed, trip, userId, tripId);
        console.log("Successfully saved onfly data and PDF");
      } catch (err) {
        console.error("Failed to save onfly data/PDF:", err);
      }
    } else {
      console.log("Skipping onfly save — no userId");
    }

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
