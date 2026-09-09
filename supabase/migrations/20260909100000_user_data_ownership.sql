-- Keep every vehicle, trip, and settings row private to its authenticated owner.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.set_row_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  ELSIF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot assign data to another user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_set_owner ON public.vehicles;
CREATE TRIGGER vehicles_set_owner
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_row_owner();

DROP TRIGGER IF EXISTS trips_set_owner ON public.trips;
CREATE TRIGGER trips_set_owner
  BEFORE INSERT OR UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_row_owner();

DROP TRIGGER IF EXISTS app_settings_set_owner ON public.app_settings;
CREATE TRIGGER app_settings_set_owner
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_row_owner();

DROP POLICY IF EXISTS "Authenticated users can manage vehicles" ON public.vehicles;
CREATE POLICY "Users manage their own vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can manage trips" ON public.trips;
CREATE POLICY "Users manage their own trips"
  ON public.trips FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.vehicles
      WHERE public.vehicles.id = vehicle_id
        AND public.vehicles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users manage their own settings" ON public.app_settings;
CREATE POLICY "Users manage their own settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      default_vehicle_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.vehicles
        WHERE public.vehicles.id = default_vehicle_id
          AND public.vehicles.user_id = auth.uid()
      )
  ));

CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON public.vehicles (user_id);
CREATE INDEX IF NOT EXISTS trips_user_date_idx ON public.trips (user_id, date DESC);
CREATE INDEX IF NOT EXISTS app_settings_user_id_idx ON public.app_settings (user_id);