-- Wipe any saved email recipient lists from the demo/dev sandbox account
-- so demo users never see real customer emails in the trip-email step.
DELETE FROM public.email_lists
WHERE user_id = '61d05b5c-92bb-4ef7-93a0-fe3adcbbe2d1';