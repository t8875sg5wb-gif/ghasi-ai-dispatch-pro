ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS chat_retention_months integer NOT NULL DEFAULT 12;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_chat_retention_months_check
  CHECK (chat_retention_months BETWEEN 1 AND 120);