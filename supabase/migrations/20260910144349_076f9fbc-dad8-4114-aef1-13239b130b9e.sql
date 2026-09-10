ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS mcp_alert_stille_zeiten jsonb NOT NULL DEFAULT '[]'::jsonb;