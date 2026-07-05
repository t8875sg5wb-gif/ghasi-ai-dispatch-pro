
-- Profiles: add controlled INSERT policy (self only)
CREATE POLICY "Nutzer erstellen ihr eigenes Profil"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Activity log: restrict reads to admins only (audit trail)
DROP POLICY IF EXISTS "Berechtigte lesen das Protokoll" ON public.activity_log;
CREATE POLICY "Nur Admins lesen das Protokoll"
ON public.activity_log FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Chat threads: per-user ownership scoping
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "Berechtigte lesen Threads" ON public.chat_threads;
CREATE POLICY "Nutzer lesen eigene Threads"
ON public.chat_threads FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- Chat messages: per-user ownership scoping
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS user_id uuid;
DROP POLICY IF EXISTS "Berechtigte lesen Nachrichten" ON public.chat_messages;
CREATE POLICY "Nutzer lesen eigene Nachrichten"
ON public.chat_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- GHASI memory: restrict reads to admins (server reads via service role)
DROP POLICY IF EXISTS "Berechtigte lesen Memory" ON public.ghasi_memory;
CREATE POLICY "Nur Admins lesen Memory"
ON public.ghasi_memory FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));
