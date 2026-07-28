DROP POLICY IF EXISTS "Berechtigte sehen Anrufe" ON public.calls;
CREATE POLICY "Berechtigte sehen Anrufe"
ON public.calls FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
  OR private.has_role(auth.uid(), 'finanz'::app_role)
);