-- GHASI AI Langzeitgedächtnis
CREATE TABLE public.ghasi_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kategorie TEXT NOT NULL DEFAULT 'beobachtung',
  inhalt TEXT NOT NULL,
  quelle TEXT NOT NULL DEFAULT 'beobachtung',
  wichtigkeit INTEGER NOT NULL DEFAULT 3,
  bezug TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ghasi_memory TO anon, authenticated;
GRANT ALL ON public.ghasi_memory TO service_role;
ALTER TABLE public.ghasi_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memory ist offen lesbar" ON public.ghasi_memory FOR SELECT USING (true);
CREATE POLICY "Memory anlegen" ON public.ghasi_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "Memory aktualisieren" ON public.ghasi_memory FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Memory loeschen" ON public.ghasi_memory FOR DELETE USING (true);

-- Aktivitätsprotokoll (wer/wann/was)
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bereich TEXT NOT NULL,
  entitaet TEXT,
  aktion TEXT NOT NULL,
  beschreibung TEXT NOT NULL,
  akteur TEXT NOT NULL DEFAULT 'Unternehmer',
  metadaten JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_log TO anon, authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Protokoll ist offen lesbar" ON public.activity_log FOR SELECT USING (true);
CREATE POLICY "Protokoll anlegen" ON public.activity_log FOR INSERT WITH CHECK (true);

CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX idx_ghasi_memory_updated_at ON public.ghasi_memory (updated_at DESC);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ghasi_memory_updated_at BEFORE UPDATE ON public.ghasi_memory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();