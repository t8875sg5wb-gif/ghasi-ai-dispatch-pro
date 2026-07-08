CREATE TABLE public.automation_states (
  automation_id TEXT NOT NULL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'aktiv',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_states TO authenticated;
GRANT ALL ON public.automation_states TO service_role;
ALTER TABLE public.automation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berechtigte sehen Automationsstatus" ON public.automation_states FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition legt Automationsstatus an" ON public.automation_states FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition aendert Automationsstatus" ON public.automation_states FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

CREATE TRIGGER update_automation_states_updated_at BEFORE UPDATE ON public.automation_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();