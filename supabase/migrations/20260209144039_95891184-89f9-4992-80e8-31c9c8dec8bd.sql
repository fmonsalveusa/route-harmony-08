
-- Fix RLS policies to be PERMISSIVE (drop restrictive, recreate as permissive)
DROP POLICY "Tenant users can read expenses" ON public.expenses;
DROP POLICY "Tenant users can insert expenses" ON public.expenses;
DROP POLICY "Tenant users can update expenses" ON public.expenses;
DROP POLICY "Tenant users can delete expenses" ON public.expenses;
DROP POLICY "Tenant users can read expense_receipts" ON public.expense_receipts;
DROP POLICY "Tenant users can insert expense_receipts" ON public.expense_receipts;
DROP POLICY "Tenant users can delete expense_receipts" ON public.expense_receipts;

CREATE POLICY "Tenant users can read expenses" ON public.expenses FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert expenses" ON public.expenses FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can update expenses" ON public.expenses FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete expenses" ON public.expenses FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can read expense_receipts" ON public.expense_receipts FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can insert expense_receipts" ON public.expense_receipts FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

CREATE POLICY "Tenant users can delete expense_receipts" ON public.expense_receipts FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
