CREATE TABLE public.driver_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  datum DATE NOT NULL,
  typ TEXT NOT NULL DEFAULT 'dienst',
  von TEXT NOT NULL DEFAULT '',
  bis TEXT NOT NULL DEFAULT '',
  notiz TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_shifts TO authenticated;
GRANT ALL ON public.driver_shifts TO service_role;
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berechtigte sehen Schichten" ON public.driver_shifts FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'disposition'::app_role)
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_shifts.driver_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Disposition legt Schichten an" ON public.driver_shifts FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition aendert Schichten" ON public.driver_shifts FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition loescht Schichten" ON public.driver_shifts FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

CREATE INDEX idx_driver_shifts_driver ON public.driver_shifts (driver_id);
CREATE INDEX idx_driver_shifts_datum ON public.driver_shifts (datum);

CREATE TRIGGER update_driver_shifts_updated_at BEFORE UPDATE ON public.driver_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();