// Supabase Edge Function: send-trip-email
// Sends trip summary emails matching the in-app summary layout.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface EmailRequest {
  tripId: number;
  emails: { email: string }[];
  senderName?: string;
}

interface TripSummaryLeg {
  arrival: string;
  departure: string;
  takeoffWeight: number;
  landingWeight: number;
  startFuel: number;
  takeoffFuel: number;
  landingFuel: number;
  fuelBurn: number;
  fuelUpliftLbs: number;
  fuelUpliftGals: number;
  fuelCost: number;
  hasWaivedFee: boolean;
  hasWaivableFee: boolean;
  feeMin: number;
  feeAmount: number;
  totalCost: number;
  errors: string[];
}

interface TripSummary {
  itineraryNum: string | null;
  legs: TripSummaryLeg[];
  aircraftNumber: string;
  savings: number;
  maxFuelLbs?: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtW(n: number): string {
  return `${Math.round(n).toLocaleString()} lbs`;
}

// Simplified leg strategy (mirrors client-side logic)
function legStrategy(leg: TripSummaryLeg, maxFuelLbs: number): { label: string; desc: string } {
  if (leg.fuelUpliftGals <= 0) {
    return { label: "Skip fuel", desc: `No fuel needed at ${leg.departure}` };
  }
  if (maxFuelLbs > 0 && leg.startFuel >= maxFuelLbs * 0.95) {
    return { label: "Top off", desc: `Fill to max capacity at ${leg.departure}` };
  }
  if (leg.hasWaivedFee && leg.fuelUpliftGals >= leg.feeMin && leg.fuelUpliftGals < leg.feeMin * 1.15) {
    return { label: "Waive fee", desc: `Buy ${Math.round(leg.feeMin)} gal min to waive fee` };
  }
  const target = Math.round(leg.startFuel / 10) * 10;
  return { label: `Bring to ${target.toLocaleString()} lbs`, desc: `Add fuel to reach ${target.toLocaleString()} lbs` };
}

function overallStrategy(legs: TripSummaryLeg[], savings: number): string {
  if (savings <= 0) return "Fueling at each departure point is already the cheapest option for this trip.";
  const priced = legs.filter(l => l.fuelUpliftGals > 0).map(l => ({
    airport: l.departure, ppg: l.fuelCost / l.fuelUpliftGals,
  }));
  if (priced.length === 0) return "The aircraft had sufficient fuel for the entire trip.";
  if (priced.length === 1) return `By optimizing the fuel load, the plan saves $${savings.toFixed(0)} compared to the standard approach.`;
  const cheapest = priced.reduce((a, b) => a.ppg < b.ppg ? a : b);
  const expensive = priced.reduce((a, b) => a.ppg > b.ppg ? a : b);
  if (expensive.ppg - cheapest.ppg > 0.5) {
    return `The optimizer shifts purchases toward ${cheapest.airport} (~$${cheapest.ppg.toFixed(2)}/gal) and away from ${expensive.airport} (~$${expensive.ppg.toFixed(2)}/gal), saving $${savings.toFixed(0)} by tankering cheaper fuel forward.`;
  }
  return `By balancing fuel loads, weight penalties, and fee waivers across ${priced.length} stops, the optimizer saves $${savings.toFixed(0)}.`;
}

function buildEmailHtml(summary: TripSummary): string {
  const totalCost = summary.legs.reduce((s, l) => s + l.totalCost, 0);
  const maxFuel = summary.maxFuelLbs ?? 0;
  const overall = overallStrategy(summary.legs, summary.savings);
  const tripLabel = summary.itineraryNum ? `Trip #${summary.itineraryNum}` : "Trip Summary";

  const legsHtml = summary.legs.map((leg, i) => {
    const strat = legStrategy(leg, maxFuel);
    const hasErr = leg.errors && leg.errors.length > 0;

    const errHtml = hasErr
      ? leg.errors.map(e => `<p style="color:#ef4444;font-size:13px;margin:0 0 4px;">${e}</p>`).join("")
      : "";

    const feeHtml = leg.hasWaivableFee && leg.feeAmount > 0
      ? `<p style="font-size:12px;color:#6b7280;margin:4px 0 0;">
          ${leg.hasWaivedFee
            ? `✅ Fee waived (min ${Math.round(leg.feeMin)} gal)`
            : `⚠️ $${leg.feeAmount.toFixed(2)} facility fee applies`}
         </p>`
      : "";

    return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;overflow:hidden;">
        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <strong style="font-size:15px;">Leg ${i + 1}: ${leg.departure} → ${leg.arrival}</strong>
        </div>
        <div style="padding:16px;">
          ${errHtml}
          <!-- Strategy -->
          <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f3f4f6;">
            <span style="display:inline-block;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;">${strat.label}</span>
            <span style="font-size:12px;color:#6b7280;margin-left:8px;">${strat.desc}</span>
            ${feeHtml}
          </div>
          <!-- Numbers grid -->
          <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 8px;width:50%;">
                <span style="font-size:11px;color:#6b7280;display:block;">Fuel to Uplift</span>
                <span style="font-size:14px;font-weight:700;">${Math.round(leg.fuelUpliftGals)} gal / ${fmtW(leg.fuelUpliftLbs)}</span>
              </td>
              <td style="padding:6px 8px;width:50%;">
                <span style="font-size:11px;color:#6b7280;display:block;">Fuel Cost</span>
                <span style="font-size:14px;font-weight:600;">${fmt(leg.fuelCost)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 8px;">
                <span style="font-size:11px;color:#6b7280;display:block;">Starting Fuel</span>
                <span style="font-size:13px;">${fmtW(leg.startFuel)}</span>
              </td>
              <td style="padding:6px 8px;">
                <span style="font-size:11px;color:#6b7280;display:block;">Fuel Burn</span>
                <span style="font-size:13px;">${fmtW(leg.fuelBurn)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 8px;">
                <span style="font-size:11px;color:#6b7280;display:block;">Landing Fuel</span>
                <span style="font-size:13px;${leg.landingFuel < 0 ? 'color:#ef4444;font-weight:700;' : ''}">${fmtW(leg.landingFuel)}</span>
              </td>
              <td style="padding:6px 8px;">
                <span style="font-size:11px;color:#6b7280;display:block;">Total Cost</span>
                <span style="font-size:14px;font-weight:700;">${fmt(leg.totalCost)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 8px;">
                <span style="font-size:11px;color:#6b7280;display:block;">Takeoff Weight</span>
                <span style="font-size:13px;">${fmtW(leg.takeoffWeight)}</span>
              </td>
              <td style="padding:6px 8px;">
                <span style="font-size:11px;color:#6b7280;display:block;">Landing Weight</span>
                <span style="font-size:13px;${leg.landingWeight < 0 ? 'color:#ef4444;font-weight:700;' : ''}">${fmtW(leg.landingWeight)}</span>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div style="font-family:'Montserrat',Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;">
      <!-- Header -->
      <div style="background:#1a3a5c;padding:24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:0.5px;">SkyIQ Fuel Plan</h1>
      </div>

      <div style="padding:24px;">
        <!-- Trip info -->
        <h2 style="color:#1a3a5c;margin:0 0 4px;font-size:20px;">${tripLabel}</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Aircraft: <strong>${summary.aircraftNumber || "N/A"}</strong></p>

        ${summary.savings > 0 ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <span style="font-size:13px;color:#6b7280;">Estimated Savings</span>
          <span style="font-size:18px;font-weight:700;color:#1a7ade;">${fmt(summary.savings)}</span>
        </div>
        ` : ""}

        <!-- Overall strategy -->
        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1a3a5c;">💡 Optimizer Strategy</p>
          <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.5;">${overall}</p>
        </div>

        <!-- Total -->
        <div style="text-align:right;margin-bottom:16px;">
          <span style="font-size:17px;font-weight:700;color:#1a3a5c;">Total: ${fmt(totalCost)}</span>
        </div>

        <!-- Legs -->
        ${legsHtml}

        <!-- Footer -->
        <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:24px;">Powered by SkyIQ — Fly Smarter</p>
      </div>
    </div>
  `;
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
    const { tripId, emails, senderName }: EmailRequest = await req.json();

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "No email recipients provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: trip, error } = await supabase
      .from("trips")
      .select("details, itinerary_num")
      .eq("id", tripId)
      .single();

    if (error || !trip) {
      return new Response(
        JSON.stringify({ error: "Trip not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const details = trip.details as unknown as TripSummary;
    if (!details || !details.legs) {
      return new Response(
        JSON.stringify({ error: "Trip has no summary data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure itinerary num is populated
    if (!details.itineraryNum && trip.itinerary_num) {
      details.itineraryNum = trip.itinerary_num;
    }

    const tripLabel = details.itineraryNum ? `Trip #${details.itineraryNum}` : `Trip #${tripId}`;
    const htmlBody = buildEmailHtml(details);

    // Fetch maxFuelLbs if missing
    if (!details.maxFuelLbs && details.aircraftNumber) {
      const { data: aircraft } = await supabase
        .from("aircrafts")
        .select("max_fuel_capacity")
        .eq("tail_number", details.aircraftNumber)
        .single();
      if (aircraft?.max_fuel_capacity) {
        details.maxFuelLbs = aircraft.max_fuel_capacity;
      }
    }

    // Send via Resend
    if (RESEND_API_KEY) {
      const results = await Promise.allSettled(
        emails.map(async ({ email }) => {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `SkyIQ <info@skyiq.net>`,
              to: [email],
              subject: `SkyIQ Fuel Plan — ${tripLabel}`,
              html: htmlBody,
            }),
          });
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Resend error for ${email}: ${err}`);
          }
          return res.json();
        }),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        return new Response(
          JSON.stringify({
            sent: results.length - failed.length,
            failed: failed.length,
            errors: failed.map((f) => (f as PromiseRejectedResult).reason?.message),
          }),
          { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ sent: emails.length, failed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: `Email send failed: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
