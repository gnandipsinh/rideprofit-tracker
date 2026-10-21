-- 1. Ownership columns
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill legacy rows to the earliest registered account
WITH first_user AS (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
UPDATE public.vehicles SET user_id = (SELECT id FROM first_user) WHERE user_id IS NULL;
WITH first_user AS (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
UPDATE public.trips SET user_id = (SELECT id FROM first_user) WHERE user_id IS NULL;
WITH first_user AS (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
UPDATE public.app_settings SET user_id = (SELECT id FROM first_user) WHERE user_id IS NULL;

DELETE FROM public.trips WHERE user_id IS NULL;
DELETE FROM public.vehicles WHERE user_id IS NULL;
DELETE FROM public.app_settings WHERE user_id IS NULL;

ALTER TABLE public.vehicles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.trips ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.app_settings ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.vehicles ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.trips ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.app_settings ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON public.vehicles(user_id);
CREATE INDEX IF NOT EXISTS trips_user_id_idx ON public.trips(user_id);

-- one settings row per user
DELETE FROM public.app_settings a
USING public.app_settings b
WHERE a.user_id = b.user_id AND a.created_at > b.created_at;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_user_id_key ON public.app_settings(user_id);

-- 3. Reject new/changed duplicate mobile numbers (legacy duplicates tolerated)
CREATE OR REPLACE FUNCTION public.enforce_unique_profile_mobile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mobile IS NOT NULL AND NEW.mobile <> ''
     AND (TG_OP = 'INSERT' OR NEW.mobile IS DISTINCT FROM OLD.mobile) THEN
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.mobile = NEW.mobile AND p.id <> NEW.id) THEN
      RAISE EXCEPTION 'This mobile number is already registered';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_unique_mobile ON public.profiles;
CREATE TRIGGER profiles_unique_mobile
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_profile_mobile();

-- 4. Owner-scoped policies
DROP POLICY IF EXISTS "Authenticated users can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated users can manage trips" ON public.trips;
DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.app_settings;

CREATE POLICY "Users manage their own vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage their own trips" ON public.trips
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users manage their own settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
GRANT ALL ON public.trips TO service_role;
GRANT ALL ON public.app_settings TO service_role;