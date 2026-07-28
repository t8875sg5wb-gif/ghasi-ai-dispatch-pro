ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON public.activity_log (user_id);