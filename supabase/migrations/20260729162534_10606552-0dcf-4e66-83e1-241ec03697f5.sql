DELETE FROM public.invoices WHERE id = '5c371a82-f0e0-4f3c-99d5-d39f396204af';

CREATE UNIQUE INDEX idx_invoices_bezug_auftrag_unique
  ON public.invoices(bezug_auftrag)
  WHERE typ = 'rechnung' AND bezug_auftrag IS NOT NULL AND bezug_auftrag <> '';

CREATE TABLE public.invoice_audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_row jsonb NOT NULL,
  new_row jsonb NOT NULL
);

GRANT SELECT ON public.invoice_audit_snapshots TO authenticated;
GRANT ALL ON public.invoice_audit_snapshots TO service_role;

ALTER TABLE public.invoice_audit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finanz sieht Rechnungs-Snapshots"
  ON public.invoice_audit_snapshots
  FOR SELECT
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    OR private.has_role(auth.uid(), 'finanz'::public.app_role)
  );

CREATE INDEX idx_invoice_audit_snapshots_invoice ON public.invoice_audit_snapshots(invoice_id);

CREATE OR REPLACE FUNCTION public.log_invoice_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.invoice_audit_snapshots (invoice_id, old_row, new_row)
  VALUES (NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_invoices_audit_snapshot
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invoice_snapshot();