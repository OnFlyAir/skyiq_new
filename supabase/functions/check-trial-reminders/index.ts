// Daily cron — finds trials ending in ~3 days that haven't been notified
// yet, sends the "trial ending soon" email, and flips trial_reminder_sent.
//
// Trigger via pg_cron or by manual curl. Safe to call multiple times per
// day — idempotent on the trial_reminder_sent flag.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { sendBillingEmail } from '../_shared/billing-emails.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Window: trials ending between now+2d and now+4d (~3 days out, with slack)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString();

    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('user_id, trial_ends_at, monthly_amount_cents')
      .eq('status', 'trial')
      .eq('trial_reminder_sent', false)
      .gte('trial_ends_at', windowStart)
      .lte('trial_ends_at', windowEnd);

    if (error) throw error;
    const list = (subs ?? []) as any[];
    let sent = 0;

    for (const s of list) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, first_name, role_name')
        .eq('id', s.user_id)
        .maybeSingle();
      if (!profile || !(profile as any).email) continue;
      // Skip exempt roles — they're not on a real trial.
      if (['Admin', 'Dev'].includes((profile as any).role_name)) continue;

      const result = await sendBillingEmail({
        to: (profile as any).email,
        type: 'trial_ending',
        data: {
          firstName: (profile as any).first_name,
          trialEndsAt: new Date(s.trial_ends_at).toLocaleDateString(),
          amount: s.monthly_amount_cents,
        },
      });

      if (result.ok) {
        await supabase
          .from('subscriptions')
          .update({ trial_reminder_sent: true } as any)
          .eq('user_id', s.user_id);
        sent++;
      }
    }

    return new Response(JSON.stringify({ checked: list.length, sent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown';
    console.error('[check-trial-reminders] error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
