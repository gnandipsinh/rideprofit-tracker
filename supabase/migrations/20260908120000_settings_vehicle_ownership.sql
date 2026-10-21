-- Keep a user's default vehicle inside that user's own vehicle set.
DROP POLICY IF EXISTS "Users manage their own settings" ON public.app_settings;

CREATE POLICY "Users manage their own settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      default_vehicle_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.vehicles
        WHERE public.vehicles.id = default_vehicle_id
          AND public.vehicles.user_id = auth.uid()
      )
    )
  );