CREATE TABLE public.chat_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titel text NOT NULL DEFAULT 'Neue Unterhaltung',
  archiviert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_threads TO anon, authenticated;
GRANT ALL ON public.chat_threads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Threads sind offen lesbar"
  ON public.chat_threads FOR SELECT
  USING (true);

CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  rolle text NOT NULL,
  inhalt text NOT NULL DEFAULT '',
  parts jsonb,
  quellen jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_thread ON public.chat_messages (thread_id, created_at);

GRANT SELECT ON public.chat_messages TO anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nachrichten sind offen lesbar"
  ON public.chat_messages FOR SELECT
  USING (true);

CREATE TRIGGER update_chat_threads_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();