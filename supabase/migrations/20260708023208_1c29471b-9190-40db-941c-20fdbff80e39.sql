CREATE TABLE public.vehicle_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  km_start INTEGER NOT NULL DEFAULT 0,
  km_ende INTEGER NOT NULL DEFAULT 0,
  fahrer TEXT NOT NULL DEFAULT '',
  zweck TEXT NOT NULL DEFAULT '',
  notiz TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_trips TO authenticated;
GRANT ALL ON public.vehicle_trips TO service_role;
ALTER TABLE public.vehicle_trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berechtigte sehen Fahrten" ON public.vehicle_trips FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition legt Fahrten an" ON public.vehicle_trips FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition aendert Fahrten" ON public.vehicle_trips FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition loescht Fahrten" ON public.vehicle_trips FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

CREATE INDEX idx_vehicle_trips_vehicle ON public.vehicle_trips (vehicle_id);
CREATE INDEX idx_vehicle_trips_datum ON public.vehicle_trips (datum DESC);

CREATE TRIGGER update_vehicle_trips_updated_at BEFORE UPDATE ON public.vehicle_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();