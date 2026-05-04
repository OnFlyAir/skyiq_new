import { supabase } from "@/integrations/supabase/client";

export type AdminAuditAction =
  | "user.activate"
  | "user.deactivate"
  | "user.billing_exempt_on"
  | "user.billing_exempt_off"
  | "user.delete"
  | "fleet.aircraft_update"
  | "fleet.aircraft_enable"
  | "fleet.aircraft_disable"
  | "fleet.aircraft_delete";

interface LogParams {
  action: AdminAuditAction;
  targetUserId?: string | null;
  targetLabel?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Best-effort write to admin_audit_log. Never throws — auditing must not
 * block the admin action it describes. RLS ensures only admins succeed.
 */
export async function logAdminAction({
  action,
  targetUserId = null,
  targetLabel = null,
  details = {},
}: LogParams): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const actor = userRes?.user;
    if (!actor) return;

    await supabase.from("admin_audit_log" as any).insert({
      actor_id: actor.id,
      actor_email: actor.email ?? null,
      action,
      target_user_id: targetUserId,
      target_label: targetLabel,
      details,
    } as any);
  } catch (err) {
    // Swallow — auditing failures should not surface to the admin.
    console.warn("admin audit log failed", err);
  }
}
