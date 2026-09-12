-- Ensure the existing per-user Settings fields are present in live databases.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS transportation_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mobile_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_email TEXT NOT NULL DEFAULT '';
