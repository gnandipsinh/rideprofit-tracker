CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Truck',
  model TEXT NOT NULL DEFAULT '',
  vehicle_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  income NUMERIC NOT NULL DEFAULT 0,
  diesel NUMERIC NOT NULL DEFAULT 0,
  driver_payment NUMERIC NOT NULL DEFAULT 0,
  emi_share NUMERIC NOT NULL DEFAULT 0,
  other_expense_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX trips_vehicle_date_idx ON public.trips (vehicle_id, date DESC);

CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Vehicle Calculation System',
  currency TEXT NOT NULL DEFAULT 'INR',
  default_vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO anon, authenticated;
GRANT ALL ON public.vehicles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO anon, authenticated;
GRANT ALL ON public.trips TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage vehicles" ON public.vehicles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can manage trips" ON public.trips FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can manage settings" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.vehicles (name, type, model, vehicle_number, notes)
VALUES ('Eicher Pro 2114', 'Eicher', 'Eicher Pro 2114 24 Ft', '', '');

INSERT INTO public.app_settings (app_name, currency) VALUES ('Vehicle Calculation System', 'INR');