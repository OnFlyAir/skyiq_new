// notify-dfy — Sends DFY notification emails via Resend.
// kind="admin_new_request" -> emails all Admin profiles about a new request.
// kind="client_completed"  -> emails the request's client contact_email.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Resend requires a verified sender. Until a domain is verified for this
// project we fall back to Resend's universal onboarding sender.
const FROM = Deno.env.get("DFY_FROM_EMAIL") ?? "DFY Fuel Planning <onboarding@resend.dev>";

interface Payload {
  kind: "admin_new_request" | "client_completed";
  request_id: string;
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Resend ${r.status}: ${text}`);
  return text;
}

function escape(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body?.kind || !body?.request_id) {
      return new Response(JSON.stringify({ error: "bad payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: reqRow, error: reqErr } = await admin
      .from("dfy_requests")
      .select("*, dfy_clients(*)")
      .eq("id", body.request_id)
      .maybeSingle();

    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: "request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = (reqRow as any).dfy_clients ?? {};
    const parsed = (reqRow as any).parsed_result ?? {};
    const fuelBurns = ((reqRow as any).fuel_burns ?? []) as Array<{
      leg: number; departure: string; destination: string; fuel_burn_lbs: number;
    }>;
    const fuelOnBoard = (reqRow as any).fuel_on_board_lbs;
    const itineraryNum = parsed.itinerary_num || "(not parsed)";
    const aircraft = parsed.aircraft || "(unknown)";

    const burnsHtml = fuelBurns.length
      ? `<table style="border-collapse:collapse;font-size:13px;margin-top:8px">
          <thead><tr>
            <th style="text-align:left;padding:4px 10px;border-bottom:1px solid #ddd">Leg</th>
            <th style="text-align:left;padding:4px 10px;border-bottom:1px solid #ddd">Route</th>
            <th style="text-align:right;padding:4px 10px;border-bottom:1px solid #ddd">Burn (lbs)</th>
          </tr></thead>
          <tbody>${fuelBurns
            .map(
              (b) => `<tr>
                <td style="padding:4px 10px">${b.leg}</td>
                <td style="padding:4px 10px">${escape(b.departure)} → ${escape(b.destination)}</td>
                <td style="padding:4px 10px;text-align:right">${escape(b.fuel_burn_lbs)}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table>`
      : "<p style='color:#888'>No fuel burns provided.</p>";

    if (body.kind === "admin_new_request") {
      const { data: admins } = await admin
        .from("profiles")
        .select("email")
        .eq("role_name", "Admin");
      const recipients = (admins ?? [])
        .map((a) => (a as any).email)
        .filter(Boolean);
      if (recipients.length === 0) {
        return new Response(JSON.stringify({ skipped: "no admins" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const html = `
        <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
          <h2 style="margin:0 0 12px">New DFY fuel-planning request</h2>
          <p><strong>Client:</strong> ${escape(client.company_name || "Unknown")}<br/>
          <strong>Contact:</strong> ${escape(client.contact_email || "—")}<br/>
          <strong>Itinerary #:</strong> ${escape(itineraryNum)}<br/>
          <strong>Aircraft:</strong> ${escape(aircraft)}<br/>
          <strong>Fuel on board:</strong> ${fuelOnBoard ?? "—"} lbs</p>
          ${burnsHtml}
          <p style="margin-top:18px">
            <a href="https://skiiq2.lovable.app/admin/dfy"
               style="background:#0070f3;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
              Open admin DFY portal
            </a>
          </p>
        </div>`;
      await sendEmail(recipients, `New DFY request — ${client.company_name || "Client"}`, html);
      return new Response(JSON.stringify({ ok: true, sent_to: recipients }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.kind === "client_completed") {
      const to = client.contact_email;
      if (!to) {
        return new Response(JSON.stringify({ skipped: "no client email" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminNotes = (reqRow as any).admin_notes || "";
      const html = `
        <div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
          <h2 style="margin:0 0 12px">Your fuel plan is ready</h2>
          <p>Hi${client.contact_name ? ` ${escape(client.contact_name)}` : ""},</p>
          <p>Your Done-For-You fuel plan for itinerary <strong>${escape(itineraryNum)}</strong>
          (aircraft ${escape(aircraft)}) has been completed.</p>
          ${burnsHtml}
          ${adminNotes ? `<p><strong>Notes from your planner:</strong><br/>${escape(adminNotes).replace(/\n/g, "<br/>")}</p>` : ""}
          <p>Sign in to your portal to download the optimized plan:</p>
          <p><a href="https://skiiq2.lovable.app/dfy"
                style="background:#0070f3;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
            Open my DFY portal</a></p>
          <p style="color:#666;font-size:12px;margin-top:24px">Thanks for flying with us.</p>
        </div>`;
      await sendEmail([to], `Your fuel plan is ready — ${itineraryNum}`, html);
      return new Response(JSON.stringify({ ok: true, sent_to: to }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown kind" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-dfy error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
