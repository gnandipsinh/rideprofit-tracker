-- Add per-user profile and business fields without changing existing data.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS transportation_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_email TEXT NOT NULL DEFAULT '';
