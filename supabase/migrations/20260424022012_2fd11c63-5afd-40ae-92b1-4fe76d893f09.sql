ALTER TABLE public.billing_email_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_email_log;