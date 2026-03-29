-- Fix ALL RLS policies from RESTRICTIVE to PERMISSIVE across all tenant tables

-- ============ LOADS ============
DROP POLICY IF EXISTS "Tenant users can read loads" ON public.loads;
DROP POLICY IF EXISTS "Tenant users can insert loads" ON public.loads;
DROP POLICY IF EXISTS "Tenant users can update loads" ON public.loads;
DROP POLICY IF EXISTS "Tenant users can delete loads" ON public.loads;

CREATE POLICY "Tenant users can read loads" ON public.loads FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert loads" ON public.loads FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update loads" ON public.loads FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete loads" ON public.loads FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ DRIVERS ============
DROP POLICY IF EXISTS "Tenant users can read drivers" ON public.drivers;
DROP POLICY IF EXISTS "Tenant users can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Tenant users can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Tenant users can delete drivers" ON public.drivers;

CREATE POLICY "Tenant users can read drivers" ON public.drivers FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert drivers" ON public.drivers FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update drivers" ON public.drivers FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete drivers" ON public.drivers FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ TRUCKS ============
DROP POLICY IF EXISTS "Tenant users can read trucks" ON public.trucks;
DROP POLICY IF EXISTS "Tenant users can insert trucks" ON public.trucks;
DROP POLICY IF EXISTS "Tenant users can update trucks" ON public.trucks;
DROP POLICY IF EXISTS "Tenant users can delete trucks" ON public.trucks;

CREATE POLICY "Tenant users can read trucks" ON public.trucks FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert trucks" ON public.trucks FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update trucks" ON public.trucks FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete trucks" ON public.trucks FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ DISPATCHERS ============
DROP POLICY IF EXISTS "Tenant users can read dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Tenant users can insert dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Tenant users can update dispatchers" ON public.dispatchers;
DROP POLICY IF EXISTS "Tenant users can delete dispatchers" ON public.dispatchers;

CREATE POLICY "Tenant users can read dispatchers" ON public.dispatchers FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert dispatchers" ON public.dispatchers FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update dispatchers" ON public.dispatchers FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete dispatchers" ON public.dispatchers FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "Tenant users can read payments" ON public.payments;
DROP POLICY IF EXISTS "Tenant users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Tenant users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Tenant users can delete payments" ON public.payments;

CREATE POLICY "Tenant users can read payments" ON public.payments FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert payments" ON public.payments FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update payments" ON public.payments FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete payments" ON public.payments FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ INVOICES ============
DROP POLICY IF EXISTS "Tenant users can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenant users can delete invoices" ON public.invoices;

CREATE POLICY "Tenant users can read invoices" ON public.invoices FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert invoices" ON public.invoices FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update invoices" ON public.invoices FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete invoices" ON public.invoices FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Tenant users can read companies" ON public.companies;
DROP POLICY IF EXISTS "Tenant users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Tenant users can update companies" ON public.companies;
DROP POLICY IF EXISTS "Tenant users can delete companies" ON public.companies;

CREATE POLICY "Tenant users can read companies" ON public.companies FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert companies" ON public.companies FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update companies" ON public.companies FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete companies" ON public.companies FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ LOAD_STOPS ============
DROP POLICY IF EXISTS "Tenant users can read load_stops" ON public.load_stops;
DROP POLICY IF EXISTS "Tenant users can insert load_stops" ON public.load_stops;
DROP POLICY IF EXISTS "Tenant users can update load_stops" ON public.load_stops;
DROP POLICY IF EXISTS "Tenant users can delete load_stops" ON public.load_stops;

CREATE POLICY "Tenant users can read load_stops" ON public.load_stops FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert load_stops" ON public.load_stops FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update load_stops" ON public.load_stops FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete load_stops" ON public.load_stops FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ PAYMENT_ADJUSTMENTS ============
DROP POLICY IF EXISTS "Tenant users can read payment_adjustments" ON public.payment_adjustments;
DROP POLICY IF EXISTS "Tenant users can insert payment_adjustments" ON public.payment_adjustments;
DROP POLICY IF EXISTS "Tenant users can update payment_adjustments" ON public.payment_adjustments;
DROP POLICY IF EXISTS "Tenant users can delete payment_adjustments" ON public.payment_adjustments;

CREATE POLICY "Tenant users can read payment_adjustments" ON public.payment_adjustments FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert payment_adjustments" ON public.payment_adjustments FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update payment_adjustments" ON public.payment_adjustments FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete payment_adjustments" ON public.payment_adjustments FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ POD_DOCUMENTS ============
DROP POLICY IF EXISTS "Tenant users can read pod_documents" ON public.pod_documents;
DROP POLICY IF EXISTS "Tenant users can insert pod_documents" ON public.pod_documents;
DROP POLICY IF EXISTS "Tenant users can delete pod_documents" ON public.pod_documents;

CREATE POLICY "Tenant users can read pod_documents" ON public.pod_documents FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert pod_documents" ON public.pod_documents FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete pod_documents" ON public.pod_documents FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ EXPENSES ============
DROP POLICY IF EXISTS "Tenant users can read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Tenant users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Tenant users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Tenant users can delete expenses" ON public.expenses;

CREATE POLICY "Tenant users can read expenses" ON public.expenses FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert expenses" ON public.expenses FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can update expenses" ON public.expenses FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete expenses" ON public.expenses FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ EXPENSE_RECEIPTS ============
DROP POLICY IF EXISTS "Tenant users can read expense_receipts" ON public.expense_receipts;
DROP POLICY IF EXISTS "Tenant users can insert expense_receipts" ON public.expense_receipts;
DROP POLICY IF EXISTS "Tenant users can delete expense_receipts" ON public.expense_receipts;

CREATE POLICY "Tenant users can read expense_receipts" ON public.expense_receipts FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can insert expense_receipts" ON public.expense_receipts FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Tenant users can delete expense_receipts" ON public.expense_receipts FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- ============ PROFILES (fix SELECT to be permissive) ============
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow trigger to create profile" ON public.profiles;
DROP POLICY IF EXISTS "Master admin can manage profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING ((id = auth.uid()) OR is_master_admin(auth.uid()) OR (tenant_id = get_user_tenant_id(auth.uid())));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "Allow trigger to create profile" ON public.profiles FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Master admin can manage profiles" ON public.profiles
  USING (is_master_admin(auth.uid()));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Master admin can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view roles in their tenant" ON public.user_roles FOR SELECT
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
CREATE POLICY "Master admin can manage all roles" ON public.user_roles
  USING (is_master_admin(auth.uid()));

-- ============ TENANTS ============
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Master admin can do all on tenants" ON public.tenants;

CREATE POLICY "Users can view own tenant" ON public.tenants FOR SELECT
  USING (id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Master admin can do all on tenants" ON public.tenants
  USING (is_master_admin(auth.uid()));

-- ============ SUBSCRIPTIONS ============
DROP POLICY IF EXISTS "Tenant users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Master admin can manage subscriptions" ON public.subscriptions;

CREATE POLICY "Tenant users can view own subscription" ON public.subscriptions FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Master admin can manage subscriptions" ON public.subscriptions
  USING (is_master_admin(auth.uid()));

-- ============ SUBSCRIPTION_PAYMENTS ============
DROP POLICY IF EXISTS "Tenant users can view own payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Master admin can manage subscription payments" ON public.subscription_payments;

CREATE POLICY "Tenant users can view own payments" ON public.subscription_payments FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Master admin can manage subscription payments" ON public.subscription_payments
  USING (is_master_admin(auth.uid()));
