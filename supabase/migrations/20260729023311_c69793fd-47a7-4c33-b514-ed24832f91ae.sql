ALTER TABLE public.recurring_orders
  ADD COLUMN IF NOT EXISTS bevorzugter_fahrer_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS bevorzugtes_fahrzeug_id uuid REFERENCES public.vehicles(id);