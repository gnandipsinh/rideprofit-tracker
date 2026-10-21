ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON public.vehicles (is_active);
