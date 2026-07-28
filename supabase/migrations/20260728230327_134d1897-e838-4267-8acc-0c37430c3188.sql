UPDATE public.recurring_orders o
SET insurer_id = m.iid
FROM (
  SELECT key, min(id::text)::uuid AS iid
  FROM (
    SELECT lower(btrim(i.name)) AS key, i.id FROM public.insurers i
    UNION ALL
    SELECT lower(btrim(i.kuerzel)) AS key, i.id FROM public.insurers i WHERE i.kuerzel IS NOT NULL AND btrim(i.kuerzel) <> ''
  ) u
  GROUP BY key
  HAVING count(DISTINCT id) = 1
) m
WHERE o.insurer_id IS NULL
  AND o.krankenkasse IS NOT NULL
  AND lower(btrim(o.krankenkasse)) = m.key;