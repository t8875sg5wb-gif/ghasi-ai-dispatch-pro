-- 1) Altbestand: Auth-Zuordnung ohne stabilen Fahrerbezug entfernen.
UPDATE public.orders
   SET fahrer_user_id = NULL
 WHERE fahrer_id IS NULL
   AND fahrer_user_id IS NOT NULL;

-- 2) Aufträge: Fahrer dürfen nur eigene Aufträge ändern.
DROP POLICY IF EXISTS "Disposition und Fahrer ändern Aufträge" ON public.orders;
CREATE POLICY "Disposition und Fahrer ändern Aufträge"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'disposition'::public.app_role)
  OR (private.has_role(auth.uid(), 'fahrer'::public.app_role) AND fahrer_user_id = auth.uid())
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'disposition'::public.app_role)
  OR (private.has_role(auth.uid(), 'fahrer'::public.app_role) AND fahrer_user_id = auth.uid())
);

-- 3) Fahrer: nur eigener Datensatz änderbar.
DROP POLICY IF EXISTS "Disposition und Fahrer aendern Fahrer" ON public.drivers;
CREATE POLICY "Disposition und Fahrer aendern Fahrer"
ON public.drivers
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'disposition'::public.app_role)
  OR (private.has_role(auth.uid(), 'fahrer'::public.app_role) AND user_id = auth.uid())
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'disposition'::public.app_role)
  OR (private.has_role(auth.uid(), 'fahrer'::public.app_role) AND user_id = auth.uid())
);