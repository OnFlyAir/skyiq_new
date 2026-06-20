// Admin-only edge function to create a new user (login + profile).
// Mirrors admin-delete-user hardening: validates JWT, requires Admin + enabled.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

interface Body {
  email: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  billing_exempt?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 20) + 'A1!';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let callerId: string | null = null;
  let createdId: string | null = null;
  let outcome: 'success' | 'denied' | 'error' = 'error';
  let reason = '';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      outcome = 'denied'; reason = 'missing_auth';
      return json(401, { error: 'Missing auth' });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      outcome = 'denied'; reason = 'invalid_token';
      return json(401, { error: 'Invalid session' });
    }
    callerId = userData.user.id;

    const { data: callerProfile, error: cpErr } = await admin
      .from('profiles')
      .select('role_name, is_enabled')
      .eq('id', callerId)
      .maybeSingle();
    if (cpErr) throw cpErr;
    if (!callerProfile || callerProfile.role_name !== 'Admin' || callerProfile.is_enabled === false) {
      outcome = 'denied'; reason = 'not_admin';
      return json(403, { error: 'Admin role required' });
    }

    let body: Body;
    try { body = (await req.json()) as Body; }
    catch { outcome = 'denied'; reason = 'bad_json'; return json(400, { error: 'Invalid JSON body' }); }

    const email = (body.email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || email.length > 255) {
      outcome = 'denied'; reason = 'bad_email';
      return json(400, { error: 'Valid email is required' });
    }
    const firstName = (body.first_name || '').trim().slice(0, 100);
    const lastName = (body.last_name || '').trim().slice(0, 100);
    const company = (body.company || '').trim().slice(0, 150);
    const password = body.password && body.password.length >= 8 ? body.password : randomPassword();
    const billingExempt = !!body.billing_exempt;

    // Create the auth user (email confirmed so they can sign in immediately).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (createErr || !created?.user?.id) {
      outcome = 'error';
      reason = createErr?.message || 'create_failed';
      return json(400, { error: createErr?.message || 'Could not create user' });
    }
    createdId = created.user.id;

    // Trigger handle_new_user already inserted a profile row — patch extra fields.
    const { error: profErr } = await admin
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        company: company || null,
        billing_exempt: billingExempt,
      })
      .eq('id', createdId);
    if (profErr) {
      // Not fatal: account exists. Log and continue.
      console.error('profile update failed:', profErr.message);
    }

    outcome = 'success';
    return json(200, {
      ok: true,
      user_id: createdId,
      email,
      temporary_password: body.password ? null : password,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reason = message; outcome = 'error';
    console.error('admin-create-user error:', message);
    return json(500, { error: message || 'Internal error' });
  } finally {
    try {
      await admin.from('analytics_events').insert({
        event_name: 'admin_create_user',
        user_id: callerId,
        properties: { created_user_id: createdId, outcome, reason },
      });
    } catch (_) { /* swallow */ }
  }
});
