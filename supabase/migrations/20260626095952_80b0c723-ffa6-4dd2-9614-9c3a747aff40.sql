-- Offene Schreib-Policies entfernen; Schreibzugriffe laufen serverseitig (service_role, RLS-Bypass)
DROP POLICY IF EXISTS "Memory anlegen" ON public.ghasi_memory;
DROP POLICY IF EXISTS "Memory aktualisieren" ON public.ghasi_memory;
DROP POLICY IF EXISTS "Memory loeschen" ON public.ghasi_memory;
DROP POLICY IF EXISTS "Protokoll anlegen" ON public.activity_log;

-- Anon/authenticated dürfen nicht mehr direkt schreiben
REVOKE INSERT, UPDATE, DELETE ON public.ghasi_memory FROM anon, authenticated;
REVOKE INSERT ON public.activity_log FROM anon, authenticated;