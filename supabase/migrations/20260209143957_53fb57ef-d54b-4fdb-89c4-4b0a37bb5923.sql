
-- Create expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  truck_id UUID REFERENCES public.trucks(id),
  driver_name TEXT,
  driver_service_type TEXT,
  expense_type TEXT NOT NULL DEFAULT 'fuel',
  category TEXT,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0)) STORED,
  payment_method TEXT NOT NULL DEFAULT 'fleet_card',
  vendor TEXT,
  location TEXT,
  odometer_reading NUMERIC,
  invoice_number TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense_receipts table
CREATE TABLE public.expense_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for expenses
CREATE POLICY "Tenant users can read expenses" ON public.expenses FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert expenses" ON public.expenses FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update expenses" ON public.expenses FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete expenses" ON public.expenses FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- RLS policies for expense_receipts
CREATE POLICY "Tenant users can read expense_receipts" ON public.expense_receipts FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert expense_receipts" ON public.expense_receipts FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete expense_receipts" ON public.expense_receipts FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Update trigger
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
