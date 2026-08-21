ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_pickup_facility_id_idx ON public.orders (pickup_facility_id);
CREATE INDEX IF NOT EXISTS orders_destination_facility_id_idx ON public.orders (destination_facility_id);

COMMENT ON COLUMN public.orders.pickup_facility_id IS 'Stabile Einrichtungs-Zuordnung des Abholorts (facilities.id); NULL = nicht verknüpft.';
COMMENT ON COLUMN public.orders.destination_facility_id IS 'Stabile Einrichtungs-Zuordnung des Zielorts (facilities.id); NULL = nicht verknüpft.';