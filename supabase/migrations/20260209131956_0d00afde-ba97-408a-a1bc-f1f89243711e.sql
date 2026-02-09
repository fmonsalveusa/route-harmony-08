
-- Update payments DELETE policy to also allow master admin
DROP POLICY "Tenant users can delete payments" ON public.payments;
CREATE POLICY "Tenant users can delete payments"
  ON public.payments
  FOR DELETE
  USING ((tenant_id = get_user_tenant_id(auth.uid())) OR is_master_admin(auth.uid()));
