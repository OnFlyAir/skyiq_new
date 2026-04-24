DO $$ BEGIN
  CREATE TYPE public.billing_email_preference AS ENUM ('all', 'critical', 'changes', 'none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_email_preference public.billing_email_preference NOT NULL DEFAULT 'all';