-- Store each authenticated user's transportation/company name for reports.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS transportation_name TEXT NOT NULL DEFAULT '';
