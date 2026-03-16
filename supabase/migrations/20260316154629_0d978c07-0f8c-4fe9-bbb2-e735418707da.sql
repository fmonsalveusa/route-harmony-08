CREATE TABLE IF NOT EXISTS public.plan_configs (
  plan public.subscription_plan PRIMARY KEY,
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 0,
  max_trucks integer NOT NULL DEFAULT 0,
  max_drivers integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_configs' AND policyname = 'Authenticated users can read plan configs'
  ) THEN
    CREATE POLICY "Authenticated users can read plan configs"
    ON public.plan_configs
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_configs' AND policyname = 'Master admins can insert plan configs'
  ) THEN
    CREATE POLICY "Master admins can insert plan configs"
    ON public.plan_configs
    FOR INSERT
    TO authenticated
    WITH CHECK (is_master_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plan_configs' AND policyname = 'Master admins can update plan configs'
  ) THEN
    CREATE POLICY "Master admins can update plan configs"
    ON public.plan_configs
    FOR UPDATE
    TO authenticated
    USING (is_master_admin(auth.uid()))
    WITH CHECK (is_master_admin(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_plan_configs_updated_at'
  ) THEN
    CREATE TRIGGER update_plan_configs_updated_at
    BEFORE UPDATE ON public.plan_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.plan_configs (plan, name, price_monthly, max_users, max_trucks, max_drivers)
SELECT seeded.plan, seeded.name, seeded.price_monthly, seeded.max_users, seeded.max_trucks, seeded.max_drivers
FROM (
  VALUES
    ('basic'::public.subscription_plan, 'Basic', 199::numeric, 1, 5, 5),
    ('intermediate'::public.subscription_plan, 'Intermediate', 399::numeric, 2, 15, 15),
    ('pro'::public.subscription_plan, 'Pro', 799::numeric, 20, 100, -1)
) AS seeded(plan, name, price_monthly, max_users, max_trucks, max_drivers)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_configs pc WHERE pc.plan = seeded.plan
);

UPDATE public.plan_configs pc
SET
  price_monthly = s.price_monthly,
  max_users = s.max_users,
  max_trucks = s.max_trucks
FROM (
  SELECT DISTINCT ON (plan)
    plan,
    price_monthly,
    max_users,
    max_trucks
  FROM public.subscriptions
  ORDER BY plan, updated_at DESC
) s
WHERE pc.plan = s.plan;

UPDATE public.plan_configs pc
SET max_drivers = t.max_drivers
FROM (
  SELECT DISTINCT ON (current_plan)
    current_plan,
    max_drivers
  FROM public.tenants
  WHERE current_plan IN ('basic', 'intermediate', 'pro')
    AND max_drivers IS NOT NULL
  ORDER BY current_plan, updated_at DESC
) t
WHERE pc.plan::text = t.current_plan;