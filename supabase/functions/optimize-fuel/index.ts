// Supabase Edge Function: optimize-fuel
// Accepts a TripInput JSON payload, runs the DP fuel optimizer, returns results.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { optimizeFuel } from "./fuel-optimizer.ts";
import type { TripInput } from "./fuel-optimizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Auth is enforced by the platform via verify_jwt = true in config.toml.
  // Reaching this point means the caller has a valid user JWT.

  try {
    const tripInput: TripInput = await req.json();

    // Validate required fields
    if (!tripInput.legs || tripInput.legs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No legs provided in trip input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (tripInput.starting_fuel === undefined || tripInput.starting_fuel === null) {
      return new Response(
        JSON.stringify({ error: "starting_fuel is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Run the optimizer
    const result = optimizeFuel(tripInput);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Optimization failed: ${message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
