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

const PROMPT = `I need you to output a JSON object that contains data from the attached PDF document. Please extract structured data from the string related to trip details, ensuring accuracy and completeness. Follow these specific guidelines for each data point:
Crew Itinerary Id
Aircraft Tail Number
Extract and provide the Tail Number. Tail number is a 2-6 digit code and does not include a manufacturer name.
Trip Segments (Per Leg of the Trip)
Departure & Destination: Extract airport codes. Do not provide times for departure or arrival.
Fuel Cost: Provide a list of all the cost per gallon at each airport. In each fuel cost, include the price of the fuel and the minimum amount of fuel needed to use that price. If only one fuel price is listed, the minimum amount of fuel should be set to 1.
Passengers & Weight
If a passenger weight is specified, use that value.
If not specified, assume -1 lbs per passenger.
Provide a comma-delimited list of all passenger weights.
Fee Waivers
Identify all fees that include "waived with" or "ww" or "ww/". List the price of the fee, the number of gallons needed to waive it, and the port associated with it. If no port is listed, set port to the destination.
Return only fees that are waivable. If no fees are waivable, return an empty list.

Output Format:
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
Do not include any summaries or comments in the output. Do not include the word "json". All comments that start with '//' must be removed`;

async function parseWithAI(text: string): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: `${PROMPT}\nthe string is ###${text}###` }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error("Rate limited — please try again in a moment");
    if (response.status === 402) throw new Error("AI credits exhausted — please add funds in Settings > Workspace > Usage");
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

function convertToTrip(jsonStr: string): ParsedTrip {
  const parsed: ParsedData = JSON.parse(jsonStr);

  const legs: ParsedLeg[] = parsed.trip_segments.map((segment) => {
    const fees: ParsedFee[] = segment.fee_waivers
      .filter((w) => w.price > 0 && w.gallons_needed_to_waive > 0)
      .map((w) => ({
        name: w.fee_name,
        amount: w.price,
        is_waivable: true,
        waived_at: w.gallons_needed_to_waive,
        airport: w.airport,
      }));

    return {
      leg_num: segment.leg,
      departure: segment.departure,
      destination: segment.destination,
      arrival_fuel_price: "",
      departure_fuel_price: segment.fuel_prices,
      fees,
      reserve: 0,
      fuel_burn: 0,
      passengers: segment.passengers_weights,
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
