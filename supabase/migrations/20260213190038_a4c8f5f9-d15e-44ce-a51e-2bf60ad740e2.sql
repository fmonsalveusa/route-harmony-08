
CREATE TABLE public.dispatcher_payment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  load_id UUID NOT NULL REFERENCES public.loads(id),
  load_reference TEXT NOT NULL,
  total_rate NUMERIC NOT NULL DEFAULT 0,
  percentage_applied NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatcher_payment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant dispatcher payment items"
ON public.dispatcher_payment_items FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

CREATE POLICY "Users can insert their tenant dispatcher payment items"
ON public.dispatcher_payment_items FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));

CREATE POLICY "Users can delete their tenant dispatcher payment items"
ON public.dispatcher_payment_items FOR DELETE
USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.is_master_admin(auth.uid()));
