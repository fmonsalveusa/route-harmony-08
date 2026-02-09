
-- Update dispatchers DELETE policy to also allow master admin
DROP POLICY "Tenant users can delete dispatchers" ON public.dispatchers;
CREATE POLICY "Tenant users can delete dispatchers"
  ON public.dispatchers
  FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Also fix UPDATE policy for consistency
DROP POLICY "Tenant users can update dispatchers" ON public.dispatchers;
CREATE POLICY "Tenant users can update dispatchers"
  ON public.dispatchers
  FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Fix same issue on all other tables too

-- drivers
DROP POLICY "Tenant users can delete drivers" ON public.drivers;
CREATE POLICY "Tenant users can delete drivers"
  ON public.drivers FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update drivers" ON public.drivers;
CREATE POLICY "Tenant users can update drivers"
  ON public.drivers FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- trucks
DROP POLICY "Tenant users can delete trucks" ON public.trucks;
CREATE POLICY "Tenant users can delete trucks"
  ON public.trucks FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update trucks" ON public.trucks;
CREATE POLICY "Tenant users can update trucks"
  ON public.trucks FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- loads
DROP POLICY "Tenant users can delete loads" ON public.loads;
CREATE POLICY "Tenant users can delete loads"
  ON public.loads FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update loads" ON public.loads;
CREATE POLICY "Tenant users can update loads"
  ON public.loads FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- companies
DROP POLICY "Tenant users can delete companies" ON public.companies;
CREATE POLICY "Tenant users can delete companies"
  ON public.companies FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update companies" ON public.companies;
CREATE POLICY "Tenant users can update companies"
  ON public.companies FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- invoices
DROP POLICY "Tenant users can delete invoices" ON public.invoices;
CREATE POLICY "Tenant users can delete invoices"
  ON public.invoices FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update invoices" ON public.invoices;
CREATE POLICY "Tenant users can update invoices"
  ON public.invoices FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- load_stops
DROP POLICY "Tenant users can delete load_stops" ON public.load_stops;
CREATE POLICY "Tenant users can delete load_stops"
  ON public.load_stops FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update load_stops" ON public.load_stops;
CREATE POLICY "Tenant users can update load_stops"
  ON public.load_stops FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- payment_adjustments
DROP POLICY "Tenant users can delete payment_adjustments" ON public.payment_adjustments;
CREATE POLICY "Tenant users can delete payment_adjustments"
  ON public.payment_adjustments FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can update payment_adjustments" ON public.payment_adjustments;
CREATE POLICY "Tenant users can update payment_adjustments"
  ON public.payment_adjustments FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- pod_documents
DROP POLICY "Tenant users can delete pod_documents" ON public.pod_documents;
CREATE POLICY "Tenant users can delete pod_documents"
  ON public.pod_documents FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Also fix INSERT policies for master admin
DROP POLICY "Tenant users can insert dispatchers" ON public.dispatchers;
CREATE POLICY "Tenant users can insert dispatchers"
  ON public.dispatchers FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert drivers" ON public.drivers;
CREATE POLICY "Tenant users can insert drivers"
  ON public.drivers FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert trucks" ON public.trucks;
CREATE POLICY "Tenant users can insert trucks"
  ON public.trucks FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert loads" ON public.loads;
CREATE POLICY "Tenant users can insert loads"
  ON public.loads FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert companies" ON public.companies;
CREATE POLICY "Tenant users can insert companies"
  ON public.companies FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert invoices" ON public.invoices;
CREATE POLICY "Tenant users can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert load_stops" ON public.load_stops;
CREATE POLICY "Tenant users can insert load_stops"
  ON public.load_stops FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert payment_adjustments" ON public.payment_adjustments;
CREATE POLICY "Tenant users can insert payment_adjustments"
  ON public.payment_adjustments FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

DROP POLICY "Tenant users can insert payments" ON public.payments;
CREATE POLICY "Tenant users can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- Also update payments UPDATE policy
DROP POLICY "Tenant users can update payments" ON public.payments;
CREATE POLICY "Tenant users can update payments"
  ON public.payments FOR UPDATE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
