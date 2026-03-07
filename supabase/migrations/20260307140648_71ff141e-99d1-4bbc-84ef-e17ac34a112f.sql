
CREATE TABLE public.broker_credit_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_name text NOT NULL,
  score integer,
  days_to_pay integer,
  rating text,
  notes text,
  tenant_id uuid REFERENCES public.tenants(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(broker_name, tenant_id)
);

ALTER TABLE public.broker_credit_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read broker_credit_scores"
  ON public.broker_credit_scores FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert broker_credit_scores"
  ON public.broker_credit_scores FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update broker_credit_scores"
  ON public.broker_credit_scores FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete broker_credit_scores"
  ON public.broker_credit_scores FOR DELETE
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_master_admin(auth.uid()));
