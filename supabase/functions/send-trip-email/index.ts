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
  return { label: `Fuel up to ${target.toLocaleString()} lbs`, desc: `Add fuel to reach ${target.toLocaleString()} lbs` };
}

// Generate "Why?" details for a leg (mirrors client-side fuel-reasoning.ts)
function legWhyDetails(leg: TripSummaryLeg, nextLeg: TripSummaryLeg | undefined, i: number, total: number): string[] {
  const details: string[] = [];
  const isLast = i === total - 1;

  // Fee reasoning
  if (leg.hasWaivableFee && leg.feeAmount > 0) {
    if (leg.hasWaivedFee) {
      details.push(`Buying at least ${Math.round(leg.feeMin)} gallons waives the $${leg.feeAmount.toFixed(2)} facility fee at this airport.`);
    } else {
      details.push(`A $${leg.feeAmount.toFixed(2)} facility fee applies at ${leg.departure}. Would need ${Math.round(leg.feeMin)} gallons to waive it, but the optimizer determined it's cheaper to pay the fee.`);
    }
  } else if (!leg.hasWaivableFee) {
    details.push(`No waivable facility fee at ${leg.departure}.`);
  }

  if (leg.fuelUpliftGals <= 0) {
    details.push("The aircraft had enough on board from the previous stop.");
    if (nextLeg && nextLeg.fuelCost < leg.fuelCost) {
      details.push(`Fuel is cheaper at ${nextLeg.departure}, so it's better to buy there.`);
    }
    return details;
  }

  // Price reasoning
  const ppg = leg.fuelUpliftGals > 0 ? leg.fuelCost / leg.fuelUpliftGals : 0;
  if (nextLeg) {
    const nextPpg = nextLeg.fuelUpliftGals > 0 ? nextLeg.fuelCost / nextLeg.fuelUpliftGals : 0;
    if (ppg > 0 && nextPpg > 0) {
      if (ppg < nextPpg * 0.95) {
        details.push(`Fuel here is ~$${ppg.toFixed(2)}/gal — cheaper than ${nextLeg.departure} (~$${nextPpg.toFixed(2)}/gal), so loading up saves money.`);
      } else if (ppg > nextPpg * 1.05) {
        details.push(`Fuel is more expensive here (~$${ppg.toFixed(2)}/gal vs ~$${nextPpg.toFixed(2)}/gal at ${nextLeg.departure}), so only enough to reach the next stop safely was purchased.`);
      } else {
        details.push(`Prices are similar here and at ${nextLeg.departure}, so the optimizer balanced fueling to minimize total weight penalty.`);
      }
    }
  } else {
    details.push("This is the final leg — only enough fuel to arrive safely with reserves was purchased.");
  }

  if (i === 0) {
    details.push(`Starting with ${Math.round(leg.startFuel).toLocaleString()} lbs of fuel already on board.`);
  }

  if (!isLast && leg.landingFuel > leg.fuelBurn * 0.8) {
    details.push(`Landing with ${Math.round(leg.landingFuel).toLocaleString()} lbs — extra fuel carried forward for savings at the next stop.`);
  }

  return details;
}

function buildEmailHtml(summary: TripSummary): string {
  const maxFuel = summary.maxFuelLbs ?? 0;
  const tripLabel = summary.itineraryNum ? `Trip #${summary.itineraryNum}` : "Trip Summary";
  const legCount = summary.legs.length;

  const legsHtml = summary.legs.map((leg, i) => {
    const strat = legStrategy(leg, maxFuel);
    const nextLeg = summary.legs[i + 1];
    const whyDetails = legWhyDetails(leg, nextLeg, i, legCount);
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

    const whyHtml = whyDetails.length > 0
      ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #f3f4f6;">
           <p style="font-size:12px;font-weight:600;color:#1a3a5c;margin:0 0 6px;">💡 Why?</p>
           <ul style="margin:0;padding-left:18px;">
             ${whyDetails.map(d => `<li style="font-size:12px;color:#6b7280;line-height:1.5;margin-bottom:4px;">${d}</li>`).join("")}
           </ul>
         </div>`
      : "";

    return `
      <div style="margin-bottom:20px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">
        <table style="width:100%;margin-bottom:8px;" cellpadding="0" cellspacing="0"><tr>
          <td><strong style="font-size:14px;color:#1a3a5c;">Leg ${i + 1}: ${leg.departure} → ${leg.arrival}</strong></td>
          <td style="text-align:right;"><span style="background:#1a3a5c;color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:10px;">${strat.label}</span></td>
        </tr></table>
        <p style="font-size:11px;color:#64748b;margin:0 0 10px;">${strat.desc}${feeHtml ? ' · ' + (leg.hasWaivedFee ? '✅ Fee waived' : '⚠️ Fee applies') : ''}</p>
        ${errHtml}
        <table style="width:100%;border-collapse:collapse;font-size:12px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 0;color:#64748b;width:35%;">Uplift</td>
            <td style="padding:4px 0;font-weight:700;color:#1a3a5c;">${Math.round(Math.abs(leg.fuelUpliftGals))} gal / ${fmtW(Math.abs(leg.fuelUpliftLbs))}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Fuel Cost</td>
            <td style="padding:4px 0;font-weight:600;color:#1a3a5c;">${fmt(Math.abs(leg.fuelCost))}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Starting Fuel</td>
            <td style="padding:4px 0;color:#334155;">${fmtW(leg.startFuel)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Fuel Burn</td>
            <td style="padding:4px 0;color:#334155;">${fmtW(leg.fuelBurn)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Landing Fuel</td>
            <td style="padding:4px 0;${leg.landingFuel < 0 ? 'color:#ef4444;font-weight:700;' : 'color:#334155;'}">${fmtW(leg.landingFuel)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">Total Cost</td>
            <td style="padding:4px 0;font-weight:700;color:#1a3a5c;">${fmt(Math.abs(leg.totalCost))}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;">TO / Ldg Weight</td>
            <td style="padding:4px 0;color:#334155;">${fmtW(leg.takeoffWeight)} / ${fmtW(leg.landingWeight)}</td>
          </tr>
        </table>
      </div>
    `;
  }).join("");

  return `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <!-- Compact header -->
      <table style="width:100%;background:#1a3a5c;" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:12px 20px;"><img src="https://bfoxdonskxtlxfqayili.supabase.co/storage/v1/object/public/email-assets/skyiq-business-logo.png" alt="SkyIQ" style="height:36px;vertical-align:middle;" /></td>
        <td style="padding:12px 20px;text-align:right;">
          <span style="color:#ffffff;font-size:15px;font-weight:700;">${tripLabel}</span><br/>
          <span style="color:#94a3b8;font-size:12px;">${summary.aircraftNumber || "N/A"}</span>
        </td>
      </tr></table>

      <div style="padding:20px;">
        ${legsHtml}
      </div>

      <div style="padding:12px 20px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:10px;color:#94a3b8;">Powered by SkyIQ — Fly Smarter</p>
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
