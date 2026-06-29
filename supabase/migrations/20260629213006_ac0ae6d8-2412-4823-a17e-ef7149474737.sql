-- 1) Restrict public-readable tables to authenticated users only
DROP POLICY IF EXISTS "Protokoll ist offen lesbar" ON public.activity_log;
CREATE POLICY "Protokoll ist lesbar fuer angemeldete Nutzer"
  ON public.activity_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Nachrichten sind offen lesbar" ON public.chat_messages;
CREATE POLICY "Nachrichten sind lesbar fuer angemeldete Nutzer"
  ON public.chat_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Threads sind offen lesbar" ON public.chat_threads;
CREATE POLICY "Threads sind lesbar fuer angemeldete Nutzer"
  ON public.chat_threads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Memory ist offen lesbar" ON public.ghasi_memory;
CREATE POLICY "Memory ist lesbar fuer angemeldete Nutzer"
  ON public.ghasi_memory FOR SELECT TO authenticated USING (true);

-- 2) Move SECURITY DEFINER helpers out of the exposed public schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

CREATE OR REPLACE FUNCTION private.primary_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select role from public.user_roles
  where user_id = _user_id
  order by case role
    when 'admin' then 1
    when 'disposition' then 2
    when 'finanz' then 3
    when 'fahrer' then 4
  end
  limit 1;
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.primary_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.primary_role(uuid) TO authenticated, service_role;

-- 3) Recreate all policies to reference private.has_role
DROP POLICY IF EXISTS "Admins lesen das KI-Audit" ON public.ai_audit_log;
CREATE POLICY "Admins lesen das KI-Audit" ON public.ai_audit_log
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Disposition legt Fahrer an" ON public.drivers;
CREATE POLICY "Disposition legt Fahrer an" ON public.drivers
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Disposition loescht Fahrer" ON public.drivers;
CREATE POLICY "Disposition loescht Fahrer" ON public.drivers
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Disposition und Fahrer aendern Fahrer" ON public.drivers;
CREATE POLICY "Disposition und Fahrer aendern Fahrer" ON public.drivers
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'fahrer'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'fahrer'::app_role));

DROP POLICY IF EXISTS "Finanzen legen Rechnungen an" ON public.invoices;
CREATE POLICY "Finanzen legen Rechnungen an" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

DROP POLICY IF EXISTS "Finanzen löschen Rechnungen" ON public.invoices;
CREATE POLICY "Finanzen löschen Rechnungen" ON public.invoices
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

DROP POLICY IF EXISTS "Finanzen sehen Rechnungen" ON public.invoices;
CREATE POLICY "Finanzen sehen Rechnungen" ON public.invoices
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

DROP POLICY IF EXISTS "Finanzen ändern Rechnungen" ON public.invoices;
CREATE POLICY "Finanzen ändern Rechnungen" ON public.invoices
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

DROP POLICY IF EXISTS "Disposition legt Aufträge an" ON public.orders;
CREATE POLICY "Disposition legt Aufträge an" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Disposition löscht Aufträge" ON public.orders;
CREATE POLICY "Disposition löscht Aufträge" ON public.orders
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Disposition und Fahrer ändern Aufträge" ON public.orders;
CREATE POLICY "Disposition und Fahrer ändern Aufträge" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'fahrer'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'fahrer'::app_role));

DROP POLICY IF EXISTS "Disposition legt Daueraufträge an" ON public.recurring_orders;
CREATE POLICY "Disposition legt Daueraufträge an" ON public.recurring_orders
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Disposition löscht Daueraufträge" ON public.recurring_orders;
CREATE POLICY "Disposition löscht Daueraufträge" ON public.recurring_orders
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Disposition ändert Daueraufträge" ON public.recurring_orders;
CREATE POLICY "Disposition ändert Daueraufträge" ON public.recurring_orders
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));

DROP POLICY IF EXISTS "Admins sehen alle Rollen" ON public.user_roles;
CREATE POLICY "Admins sehen alle Rollen" ON public.user_roles
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 4) Remove the now-unused public (API-exposed) helper functions
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.primary_role(uuid);