// Admin-only. Performs real Stripe actions for subscription management:
//   - cancel (cancel_at_period_end=true, access continues until period end)
//   - reactivate (cancel_at_period_end=false, re-enable account)
//   - change_cycle (schedules pending_billing_cycle; applied at renewal)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { stripeFetch, form, type StripeEnv } from '../_shared/stripe-gateway.ts';

interface Body {
  action: 'cancel' | 'reactivate' | 'change_cycle';
  subscription_id: string; // DB id
  cycle?: 'four_weekly' | 'annual';
  environment?: StripeEnv;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as any;

    const { data: caller } = await admin.from('profiles').select('role_name').eq('id', user.id).maybeSingle();
    if (caller?.role_name !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as Body;
    const env: StripeEnv = body.environment === 'live' ? 'live' : 'sandbox';

    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('id', body.subscription_id)
      .maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'cancel') {
      if (sub.stripe_subscription_id) {
        await stripeFetch(`/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: 'POST',
          body: form({ cancel_at_period_end: 'true' }),
        }, env);
      }
      await admin.from('subscriptions').update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      } as any).eq('id', body.subscription_id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'reactivate') {
      if (sub.stripe_subscription_id) {
        await stripeFetch(`/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: 'POST',
          body: form({ cancel_at_period_end: 'false' }),
        }, env);
      }
      await admin.from('subscriptions').update({
        status: 'active',
        canceled_at: null,
      } as any).eq('id', body.subscription_id);
      // Re-enable the account (unless admin/dev, which is handled by trigger anyway).
      await admin.from('profiles').update({ is_enabled: true } as any).eq('id', sub.user_id);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'change_cycle' && body.cycle) {
      // Schedule — actual Stripe change happens at next renewal in the webhook.
      await admin.from('subscriptions').update({
        pending_billing_cycle: body.cycle,
      } as any).eq('id', body.subscription_id);
      return new Response(JSON.stringify({ ok: true, scheduled: body.cycle }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('admin-subscription-action error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
