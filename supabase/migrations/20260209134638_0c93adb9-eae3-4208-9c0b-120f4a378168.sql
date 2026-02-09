
-- Fix: Change DELETE policies from RESTRICTIVE to PERMISSIVE for loads and related tables

-- loads
DROP POLICY IF EXISTS "Tenant users can delete loads" ON public.loads;
CREATE POLICY "Tenant users can delete loads"
ON public.loads
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- load_stops
DROP POLICY IF EXISTS "Tenant users can delete load_stops" ON public.load_stops;
CREATE POLICY "Tenant users can delete load_stops"
ON public.load_stops
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- payments
DROP POLICY IF EXISTS "Tenant users can delete payments" ON public.payments;
CREATE POLICY "Tenant users can delete payments"
ON public.payments
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- invoices
DROP POLICY IF EXISTS "Tenant users can delete invoices" ON public.invoices;
CREATE POLICY "Tenant users can delete invoices"
ON public.invoices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- pod_documents
DROP POLICY IF EXISTS "Tenant users can delete pod_documents" ON public.pod_documents;
CREATE POLICY "Tenant users can delete pod_documents"
ON public.pod_documents
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));

-- payment_adjustments
DROP POLICY IF EXISTS "Tenant users can delete payment_adjustments" ON public.payment_adjustments;
CREATE POLICY "Tenant users can delete payment_adjustments"
ON public.payment_adjustments
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
