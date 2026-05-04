-- Restrict EXECUTE on admin-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.admin_delete_user_data(uuid) FROM PUBLIC, anon, authenticated;

-- Helper SECURITY DEFINER functions used by RLS only — revoke from anon
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_billing_exempt(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_billing(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;