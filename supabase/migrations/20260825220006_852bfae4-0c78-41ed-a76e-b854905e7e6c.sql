CREATE TABLE public.recurring_rejections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  aktion text NOT NULL CHECK (aktion IN ('create','update','delete','generate')),
  ziel_id uuid,
  patient text,
  grund text NOT NULL,
  felder jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX recurring_rejections_created_at_idx ON public.recurring_rejections (created_at DESC);

GRANT INSERT, SELECT ON public.recurring_rejections TO authenticated;
GRANT ALL ON public.recurring_rejections TO service_role;

ALTER TABLE public.recurring_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_rejections_insert_own" ON public.recurring_rejections
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "recurring_rejections_select_admin" ON public.recurring_rejections
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));