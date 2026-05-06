import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight, fire-and-forget analytics. Failures are swallowed so they
 * never break the user flow.
 */
export type AnalyticsEvent =
  | 'onboarding_step_viewed'
  | 'checkout_started'
  | 'trial_purchase_completed'
  | 'subscription_activated';

export async function track(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    // RLS requires user_id = auth.uid(); skip if no signed-in user.
    if (!user?.id) return;
    await (supabase.from('analytics_events' as any) as any).insert({
      user_id: user.id,
      event_name: event,
      properties,
    });
  } catch (e) {
    // Never let analytics break the app.
    console.warn('[analytics] failed to track', event, e);
  }
}
