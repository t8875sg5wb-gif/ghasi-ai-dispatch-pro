-- Chat-Laufzeit ohne Service-Role-Zwang.
-- Threads/Nachrichten bleiben strikt an auth.uid() gebunden.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;

DROP POLICY IF EXISTS "Nutzer erstellen eigene Threads" ON public.chat_threads;
CREATE POLICY "Nutzer erstellen eigene Threads"
ON public.chat_threads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer aendern eigene Threads" ON public.chat_threads;
CREATE POLICY "Nutzer aendern eigene Threads"
ON public.chat_threads FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer loeschen eigene Threads" ON public.chat_threads;
CREATE POLICY "Nutzer loeschen eigene Threads"
ON public.chat_threads FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Nutzer erstellen eigene Nachrichten" ON public.chat_messages;
CREATE POLICY "Nutzer erstellen eigene Nachrichten"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_threads t
    WHERE t.id = thread_id AND t.user_id = auth.uid()
  )
);
-- Audit-Metadaten werden nicht direkt vom Client geschrieben.
REVOKE INSERT, UPDATE, DELETE ON public.ai_audit_log FROM authenticated;
