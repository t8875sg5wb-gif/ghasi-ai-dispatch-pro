-- ORDERS: admin/disposition, or the assigned driver
DROP POLICY IF EXISTS "Angemeldete sehen Aufträge" ON public.orders;
CREATE POLICY "Berechtigte sehen Aufträge"
ON public.orders
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
  OR (private.has_role(auth.uid(), 'fahrer'::app_role) AND fahrer_user_id = auth.uid())
);

-- RECURRING ORDERS: admin/disposition only
DROP POLICY IF EXISTS "Angemeldete sehen Daueraufträge" ON public.recurring_orders;
CREATE POLICY "Berechtigte sehen Daueraufträge"
ON public.recurring_orders
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
);

-- DRIVERS: admin/disposition, or own record
DROP POLICY IF EXISTS "Angemeldete sehen Fahrer" ON public.drivers;
CREATE POLICY "Berechtigte sehen Fahrer"
ON public.drivers
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
  OR user_id = auth.uid()
);

-- ACTIVITY LOG: admin/disposition only
DROP POLICY IF EXISTS "Protokoll ist lesbar fuer angemeldete Nutzer" ON public.activity_log;
CREATE POLICY "Berechtigte lesen das Protokoll"
ON public.activity_log
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
);

-- CHAT THREADS: management roles only (not fahrer)
DROP POLICY IF EXISTS "Threads sind lesbar fuer angemeldete Nutzer" ON public.chat_threads;
CREATE POLICY "Berechtigte lesen Threads"
ON public.chat_threads
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
  OR private.has_role(auth.uid(), 'finanz'::app_role)
);

-- CHAT MESSAGES: management roles only (not fahrer)
DROP POLICY IF EXISTS "Nachrichten sind lesbar fuer angemeldete Nutzer" ON public.chat_messages;
CREATE POLICY "Berechtigte lesen Nachrichten"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
  OR private.has_role(auth.uid(), 'finanz'::app_role)
);

-- GHASI MEMORY: management roles only (not fahrer)
DROP POLICY IF EXISTS "Memory ist lesbar fuer angemeldete Nutzer" ON public.ghasi_memory;
CREATE POLICY "Berechtigte lesen Memory"
ON public.ghasi_memory
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'disposition'::app_role)
  OR private.has_role(auth.uid(), 'finanz'::app_role)
);

-- PROFILES: self, or admin
DROP POLICY IF EXISTS "Profile sind für angemeldete Nutzer lesbar" ON public.profiles;
CREATE POLICY "Nutzer sehen ihr eigenes Profil"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR private.has_role(auth.uid(), 'admin'::app_role)
);