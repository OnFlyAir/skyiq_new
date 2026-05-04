// Admin-only edge function to fully delete a user.
// Wipes app data via admin_delete_user_data() (caller-side authz check) and
// then removes the auth.users row using the service-role key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

interface Body { target_user_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify caller and verify admin via the same RLS-bound function the DB uses.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role_name')
      .eq('id', userRes.user.id)
      .single();

    if (!callerProfile || callerProfile.role_name !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.target_user_id || typeof body.target_user_id !== 'string') {
      return new Response(JSON.stringify({ error: 'target_user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.target_user_id === userRes.user.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account here.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Wipe app data first (cascades through related tables).
    const { error: dataErr } = await admin.rpc('admin_delete_user_data', {
      _target: body.target_user_id,
    });
    if (dataErr) throw dataErr;

    // Then remove the auth user.
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(body.target_user_id);
    if (authDeleteErr) throw authDeleteErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('admin-delete-user error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
