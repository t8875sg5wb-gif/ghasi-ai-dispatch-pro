DROP POLICY IF EXISTS "Authenticated can read company settings" ON public.company_settings;

CREATE POLICY "Admin and finance can read company settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'finanz'::public.app_role)
);