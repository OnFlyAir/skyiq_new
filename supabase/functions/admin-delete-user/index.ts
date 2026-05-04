// Admin-only edge function to fully delete a user.
// Hardened: validates JWT, requires Admin role + enabled account, validates target,
// blocks self/admin deletion, and audits every attempt.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

interface Body { target_user_id: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Service-role client is created lazily and never exposed to client input paths.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let callerId: string | null = null;
  let targetId: string | null = null;
  let outcome: 'success' | 'denied' | 'error' = 'error';
  let reason = '';

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      reason = 'missing_auth';
      outcome = 'denied';
      return json(401, { error: 'Missing auth' });
    }

    // Verify JWT cryptographically via getClaims (no trust in raw header).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      reason = 'invalid_token';
      outcome = 'denied';
      return json(401, { error: 'Invalid session' });
    }
    callerId = claimsData.claims.sub as string;

    // Caller must be Admin AND have an enabled account.
    const { data: callerProfile, error: cpErr } = await admin
      .from('profiles')
      .select('role_name, is_enabled')
      .eq('id', callerId)
      .maybeSingle();

    if (cpErr) throw cpErr;
    if (!callerProfile || callerProfile.role_name !== 'Admin' || callerProfile.is_enabled === false) {
      reason = 'not_admin';
      outcome = 'denied';
      return json(403, { error: 'Admin role required' });
    }

    // Validate body shape strictly.
    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      reason = 'bad_json';
      outcome = 'denied';
      return json(400, { error: 'Invalid JSON body' });
    }

    if (!body?.target_user_id || typeof body.target_user_id !== 'string' || !UUID_RE.test(body.target_user_id)) {
      reason = 'bad_target';
      outcome = 'denied';
      return json(400, { error: 'Valid target_user_id (uuid) required' });
    }
    targetId = body.target_user_id;

    if (targetId === callerId) {
      reason = 'self_delete';
      outcome = 'denied';
      return json(400, { error: 'You cannot delete your own account here.' });
    }

    // Confirm target exists and is not another Admin (prevents admins nuking each other).
    const { data: targetProfile, error: tpErr } = await admin
      .from('profiles')
      .select('id, role_name')
      .eq('id', targetId)
      .maybeSingle();

    if (tpErr) throw tpErr;
    if (!targetProfile) {
      reason = 'target_missing';
      outcome = 'denied';
      return json(404, { error: 'Target user not found' });
    }
    if (targetProfile.role_name === 'Admin') {
      reason = 'target_is_admin';
      outcome = 'denied';
      return json(403, { error: 'Cannot delete another Admin account.' });
    }

    // Wipe app data first (RPC also re-checks is_admin() server-side).
    const { error: dataErr } = await admin.rpc('admin_delete_user_data', { _target: targetId });
    if (dataErr) throw dataErr;

    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(targetId);
    if (authDeleteErr) throw authDeleteErr;

    outcome = 'success';
    return json(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    reason = message;
    outcome = 'error';
    console.error('admin-delete-user error:', message);
    return json(500, { error: 'Internal error' });
  } finally {
    // Best-effort audit log; never block the response on this.
    try {
      await admin.from('analytics_events').insert({
        event_name: 'admin_delete_user',
        user_id: callerId,
        properties: { target_user_id: targetId, outcome, reason },
      });
    } catch (_) { /* swallow */ }
  }
});
