ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS last_real_lat double precision,
  ADD COLUMN IF NOT EXISTS last_real_lng double precision,
  ADD COLUMN IF NOT EXISTS last_real_at timestamptz;