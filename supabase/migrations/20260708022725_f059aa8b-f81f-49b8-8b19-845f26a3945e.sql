-- ============ documents ============
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  kategorie TEXT NOT NULL DEFAULT 'patientendokument',
  format TEXT NOT NULL DEFAULT 'pdf',
  ordner TEXT NOT NULL DEFAULT 'Allgemein',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  bezug JSONB,
  storage_path TEXT NOT NULL,
  groesse_kb INTEGER NOT NULL DEFAULT 0,
  ocr_text TEXT,
  hochgeladen_von TEXT NOT NULL DEFAULT '',
  uploaded_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Berechtigte sehen Dokumente" ON public.documents FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Berechtigte legen Dokumente an" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Berechtigte aendern Dokumente" ON public.documents FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));
CREATE POLICY "Berechtigte loeschen Dokumente" ON public.documents FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role));

CREATE INDEX idx_documents_kategorie ON public.documents (kategorie);
CREATE INDEX idx_documents_created ON public.documents (created_at DESC);

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ storage.objects policies for the private "documents" bucket ============
CREATE POLICY "Berechtigte sehen Dokumentdateien" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role)));
CREATE POLICY "Berechtigte laden Dokumentdateien hoch" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role)));
CREATE POLICY "Berechtigte aendern Dokumentdateien" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role)));
CREATE POLICY "Berechtigte loeschen Dokumentdateien" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'disposition'::app_role) OR private.has_role(auth.uid(), 'finanz'::app_role)));