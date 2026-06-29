ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_house_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_country text NOT NULL DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS pickup_additional_info text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_house_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_country text NOT NULL DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS destination_additional_info text NOT NULL DEFAULT '';

ALTER TABLE public.recurring_orders
  ADD COLUMN IF NOT EXISTS pickup_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_house_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_country text NOT NULL DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS pickup_additional_info text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_house_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination_country text NOT NULL DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS destination_additional_info text NOT NULL DEFAULT '';

-- Best-effort migration from existing one-line address strings.
UPDATE public.orders
SET
  pickup_postal_code = COALESCE(NULLIF(substring(abholort from '([0-9]{4,5})\\s+[^,()]+'), ''), pickup_postal_code),
  pickup_city = COALESCE(NULLIF(btrim(substring(abholort from '[0-9]{4,5}\\s+([^,()]+)')), ''), pickup_city),
  pickup_street = CASE WHEN pickup_street = '' THEN btrim(split_part(regexp_replace(abholort, '\\s*[0-9]{4,5}\\s+[^,()]+.*$', ''), ',', 1)) ELSE pickup_street END,
  pickup_country = CASE WHEN pickup_country = '' THEN 'Deutschland' ELSE pickup_country END,
  destination_postal_code = COALESCE(NULLIF(substring(zielort from '([0-9]{4,5})\\s+[^,()]+'), ''), destination_postal_code),
  destination_city = COALESCE(NULLIF(btrim(substring(zielort from '[0-9]{4,5}\\s+([^,()]+)')), ''), destination_city),
  destination_street = CASE WHEN destination_street = '' THEN btrim(split_part(regexp_replace(zielort, '\\s*[0-9]{4,5}\\s+[^,()]+.*$', ''), ',', 1)) ELSE destination_street END,
  destination_country = CASE WHEN destination_country = '' THEN 'Deutschland' ELSE destination_country END
WHERE abholort <> '' OR zielort <> '';

UPDATE public.recurring_orders
SET
  pickup_postal_code = COALESCE(NULLIF(substring(abholort from '([0-9]{4,5})\\s+[^,()]+'), ''), pickup_postal_code),
  pickup_city = COALESCE(NULLIF(btrim(substring(abholort from '[0-9]{4,5}\\s+([^,()]+)')), ''), pickup_city),
  pickup_street = CASE WHEN pickup_street = '' THEN btrim(split_part(regexp_replace(abholort, '\\s*[0-9]{4,5}\\s+[^,()]+.*$', ''), ',', 1)) ELSE pickup_street END,
  pickup_country = CASE WHEN pickup_country = '' THEN 'Deutschland' ELSE pickup_country END,
  destination_postal_code = COALESCE(NULLIF(substring(zielort from '([0-9]{4,5})\\s+[^,()]+'), ''), destination_postal_code),
  destination_city = COALESCE(NULLIF(btrim(substring(zielort from '[0-9]{4,5}\\s+([^,()]+)')), ''), destination_city),
  destination_street = CASE WHEN destination_street = '' THEN btrim(split_part(regexp_replace(zielort, '\\s*[0-9]{4,5}\\s+[^,()]+.*$', ''), ',', 1)) ELSE destination_street END,
  destination_country = CASE WHEN destination_country = '' THEN 'Deutschland' ELSE destination_country END
WHERE abholort <> '' OR zielort <> '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_orders TO authenticated;
GRANT ALL ON public.recurring_orders TO service_role;