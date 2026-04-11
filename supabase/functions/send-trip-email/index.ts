// Supabase Edge Function: send-trip-email
// Sends trip summary emails using Resend (or any SMTP provider).
// Accepts: { tripId, emails: [{ email }], summaryUrl }
// In production, set RESEND_API_KEY as a Supabase secret.

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

    // Fetch trip details from Supabase
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

    const tripNum = trip.itinerary_num || `Trip #${tripId}`;
    const details = trip.details as Record<string, unknown>;
    const legs = (details?.legs as Array<Record<string, unknown>>) ?? [];

    // Build email HTML
    const legsHtml = legs.map((leg, i) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">Leg ${i + 1}: ${leg.departure} → ${leg.arrival}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${Math.round(leg.fuelUpliftGals as number || 0)} gal</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">$${(leg.totalCost as number || 0).toFixed(2)}</td>
      </tr>
    `).join("");

    const totalCost = legs.reduce((sum, l) => sum + ((l.totalCost as number) || 0), 0);
    const savings = (details?.savings as number) || 0;

    const htmlBody = `
      <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a3a5c; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">SkyIQ Fuel Plan</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #1a3a5c;">Trip Summary — ${tripNum}</h2>
          <p>Aircraft: <strong>${(details?.aircraftNumber as string) || "N/A"}</strong></p>
          ${savings > 0 ? `<p style="color: #16a34a; font-size: 18px; font-weight: bold;">Estimated Savings: $${savings.toFixed(2)}</p>` : ""}
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Leg</th>
                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Uplift</th>
                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Cost</th>
              </tr>
            </thead>
            <tbody>
              ${legsHtml}
              <tr style="background: #f3f4f6; font-weight: bold;">
                <td style="padding: 8px; border: 1px solid #e5e7eb;">Total</td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">$${totalCost.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p style="font-size: 12px; color: #6b7280;">Powered by SkyIQ — Fly Smarter</p>
        </div>
      </div>
    `;

    // Send via Resend API (if configured)
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
              from: `SkyIQ <${senderName || "noreply"}@skyiq.net>`,
              to: [email],
              subject: `SkyIQ Fuel Plan — ${tripNum}`,
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
