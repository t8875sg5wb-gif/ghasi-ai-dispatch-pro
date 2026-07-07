-- ============ conversations ============
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kategorie TEXT NOT NULL DEFAULT 'system',
  betreff TEXT NOT NULL DEFAULT '',
  partner TEXT NOT NULL DEFAULT '',
  kanal TEXT NOT NULL DEFAULT 'intern',
  prioritaet TEXT NOT NULL DEFAULT 'normal',
  gelesen BOOLEAN NOT NULL DEFAULT false,
  bezug JSONB,
  nachrichten JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Unterhaltungen" ON public.conversations FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition legt Unterhaltungen an" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition aendert Unterhaltungen" ON public.conversations FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition loescht Unterhaltungen" ON public.conversations FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ communication_drafts ============
CREATE TABLE public.communication_drafts (
  id TEXT NOT NULL PRIMARY KEY,
  kategorie TEXT NOT NULL DEFAULT 'system',
  kanal TEXT NOT NULL DEFAULT 'intern',
  titel TEXT NOT NULL DEFAULT '',
  empfaenger TEXT NOT NULL DEFAULT '',
  betreff TEXT,
  nachricht TEXT NOT NULL DEFAULT '',
  erklaerung TEXT NOT NULL DEFAULT '',
  grund TEXT NOT NULL DEFAULT '',
  quelldaten JSONB NOT NULL DEFAULT '[]'::jsonb,
  bezug JSONB,
  prioritaet TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'offen',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_drafts TO authenticated;
GRANT ALL ON public.communication_drafts TO service_role;
ALTER TABLE public.communication_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Berechtigte sehen Entwuerfe" ON public.communication_drafts FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition legt Entwuerfe an" ON public.communication_drafts FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition aendert Entwuerfe" ON public.communication_drafts FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE POLICY "Disposition loescht Entwuerfe" ON public.communication_drafts FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role));
CREATE TRIGGER update_communication_drafts_updated_at BEFORE UPDATE ON public.communication_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();