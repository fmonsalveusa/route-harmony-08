
-- 1. Create the global brokers table (no tenant_id)
CREATE TABLE public.brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  mc_number text,
  rating text,
  days_to_pay integer,
  notes text,
  loads_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies: all authenticated users can read, insert, update
CREATE POLICY "Authenticated users can read brokers"
  ON public.brokers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert brokers"
  ON public.brokers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update brokers"
  ON public.brokers FOR UPDATE TO authenticated
  USING (true);

-- 4. Updated_at trigger
CREATE TRIGGER set_brokers_updated_at
  BEFORE UPDATE ON public.brokers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger to auto-register brokers from loads
CREATE OR REPLACE FUNCTION public.auto_register_broker()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.broker_client IS NOT NULL AND TRIM(NEW.broker_client) <> '' THEN
    INSERT INTO public.brokers (name)
    VALUES (TRIM(NEW.broker_client))
    ON CONFLICT (name) DO UPDATE SET loads_count = (
      SELECT COUNT(*) FROM public.loads WHERE TRIM(broker_client) = TRIM(NEW.broker_client)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_register_broker
  AFTER INSERT OR UPDATE OF broker_client ON public.loads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_register_broker();

-- 6. Migrate existing data from broker_credit_scores into brokers
INSERT INTO public.brokers (name, mc_number, rating, days_to_pay, notes, created_at, updated_at)
SELECT DISTINCT ON (LOWER(TRIM(broker_name)))
  TRIM(broker_name),
  mc_number,
  rating,
  days_to_pay,
  notes,
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM public.broker_credit_scores
WHERE broker_name IS NOT NULL AND TRIM(broker_name) <> ''
ORDER BY LOWER(TRIM(broker_name)), updated_at DESC NULLS LAST
ON CONFLICT (name) DO UPDATE SET
  mc_number = COALESCE(EXCLUDED.mc_number, public.brokers.mc_number),
  rating = COALESCE(EXCLUDED.rating, public.brokers.rating),
  days_to_pay = COALESCE(EXCLUDED.days_to_pay, public.brokers.days_to_pay),
  notes = COALESCE(EXCLUDED.notes, public.brokers.notes);

-- 7. Backfill brokers from existing loads
INSERT INTO public.brokers (name)
SELECT DISTINCT TRIM(broker_client)
FROM public.loads
WHERE broker_client IS NOT NULL AND TRIM(broker_client) <> ''
ON CONFLICT (name) DO NOTHING;

-- 8. Update loads_count for all brokers
UPDATE public.brokers b
SET loads_count = (
  SELECT COUNT(*) FROM public.loads l WHERE TRIM(l.broker_client) = b.name
);
