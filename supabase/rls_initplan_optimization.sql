-- RLS: las funciones de permisos (is_master_admin, has_role, get_user_tenant_id, ...) y auth.uid()
-- se envuelven en (SELECT ...) para que Postgres las evalúe UNA vez por consulta y no por cada fila.
-- Mismo resultado (verificado con 6 tipos de usuario en 17 tablas); la lista de cargas pasó de ~75 ms a ~3 ms.
begin;
ALTER POLICY "Master admin can manage profiles" ON public."profiles" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "Users can update own profile" ON public."profiles" USING ((id = (SELECT auth.uid())));
ALTER POLICY "Users can view own profile and tenant" ON public."profiles" USING (((id = (SELECT auth.uid())) OR (SELECT is_master_admin(auth.uid())) OR (tenant_id = (SELECT get_user_tenant_id(auth.uid())))));
ALTER POLICY "Master admin can manage all roles" ON public."user_roles" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "Tenant admins can manage roles" ON public."user_roles" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND (SELECT has_role(auth.uid(), 'admin'::app_role)))) WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND (SELECT has_role(auth.uid(), 'admin'::app_role))));
ALTER POLICY "Users can view roles in their tenant" ON public."user_roles" USING ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))));
ALTER POLICY "Master admin can manage subscriptions" ON public."subscriptions" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "Tenant users can view own subscription" ON public."subscriptions" USING ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))));
ALTER POLICY "Master admin can manage subscription payments" ON public."subscription_payments" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "Tenant users can view own subscription payments" ON public."subscription_payments" USING ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))));
ALTER POLICY "Tenant users can read eld data" ON public."eld_driver_data" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Tenant users can delete broker_credit_scores" ON public."broker_credit_scores" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert broker_credit_scores" ON public."broker_credit_scores" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read broker_credit_scores" ON public."broker_credit_scores" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update broker_credit_scores" ON public."broker_credit_scores" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Authorized roles can read trucks" ON public."trucks" USING (((((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role))) AND (tenant_id = (SELECT get_user_tenant_id(auth.uid())))) OR (SELECT is_master_admin(auth.uid())) OR ((SELECT has_role(auth.uid(), 'dispatcher'::app_role)) AND ((id)::text IN ( SELECT d.truck_id
   FROM drivers d
  WHERE ((d.dispatcher_id = (SELECT get_user_dispatcher_id(auth.uid()))) AND (d.truck_id IS NOT NULL))))) OR ((SELECT has_role(auth.uid(), 'driver'::app_role)) AND ((id)::text = ( SELECT d.truck_id
   FROM drivers d
  WHERE (((d.id)::text = (SELECT get_user_driver_id(auth.uid()))) AND (d.truck_id IS NOT NULL))
 LIMIT 1)))));
ALTER POLICY "Tenant users can delete trucks" ON public."trucks" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert trucks" ON public."trucks" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update trucks" ON public."trucks" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Authorized roles can read drivers" ON public."drivers" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role)) OR ((SELECT has_role(auth.uid(), 'dispatcher'::app_role)) AND (dispatcher_id = (SELECT get_user_dispatcher_id(auth.uid())))) OR ((SELECT has_role(auth.uid(), 'driver'::app_role)) AND ((id)::text = (SELECT get_user_driver_id(auth.uid())))) OR (investor_email = ( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid()))))))));
ALTER POLICY "Tenant users can delete drivers" ON public."drivers" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert drivers" ON public."drivers" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update drivers" ON public."drivers" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_all" ON public."whatsapp_templates" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid())))) WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete loads" ON public."loads" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert loads" ON public."loads" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read loads" ON public."loads" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role)) OR ((SELECT has_role(auth.uid(), 'dispatcher'::app_role)) AND (dispatcher_id = (SELECT get_user_dispatcher_id(auth.uid())))) OR ((SELECT has_role(auth.uid(), 'driver'::app_role)) AND (driver_id = (SELECT get_user_driver_id(auth.uid())))) OR (driver_id IN ( SELECT (di.driver_id)::text AS driver_id
   FROM (driver_investors di
     JOIN investors i ON ((i.id = di.investor_id)))
  WHERE ((di.is_active = true) AND (lower(i.email) = lower(( SELECT profiles.email
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid()))))))))))));
ALTER POLICY "Tenant users can update loads" ON public."loads" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete load_stops" ON public."load_stops" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert load_stops" ON public."load_stops" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read load_stops" ON public."load_stops" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update load_stops" ON public."load_stops" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete dispatchers" ON public."dispatchers" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert dispatchers" ON public."dispatchers" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read dispatchers" ON public."dispatchers" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update dispatchers" ON public."dispatchers" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete load_adjustments" ON public."load_adjustments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert load_adjustments" ON public."load_adjustments" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read load_adjustments" ON public."load_adjustments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update load_adjustments" ON public."load_adjustments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete payments" ON public."payments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert payments" ON public."payments" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read payments" ON public."payments" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role)) OR ((SELECT has_role(auth.uid(), 'dispatcher'::app_role)) AND (((recipient_type = 'dispatcher'::text) AND (recipient_id = (SELECT get_user_dispatcher_id(auth.uid())))) OR (load_id IN ( SELECT l.id
   FROM loads l
  WHERE (l.dispatcher_id = (SELECT get_user_dispatcher_id(auth.uid()))))))) OR ((SELECT has_role(auth.uid(), 'driver'::app_role)) AND (recipient_id = (SELECT get_user_driver_id(auth.uid())))) OR ((recipient_type = 'investor'::text) AND (recipient_id IN ( SELECT (i.id)::text AS id
   FROM investors i
  WHERE (lower(i.email) = lower(( SELECT p.email
           FROM profiles p
          WHERE (p.id = (SELECT auth.uid())))))
UNION
 SELECT (di.driver_id)::text AS driver_id
   FROM (driver_investors di
     JOIN investors i ON ((i.id = di.investor_id)))
  WHERE (di.is_active AND (lower(i.email) = lower(( SELECT p.email
           FROM profiles p
          WHERE (p.id = (SELECT auth.uid())))))))))))));
ALTER POLICY "Tenant users can update payments" ON public."payments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete payment_adjustments" ON public."payment_adjustments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert payment_adjustments" ON public."payment_adjustments" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read payment_adjustments" ON public."payment_adjustments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update payment_adjustments" ON public."payment_adjustments" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete recurring_deductions" ON public."recurring_deductions" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert recurring_deductions" ON public."recurring_deductions" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read recurring_deductions" ON public."recurring_deductions" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update recurring_deductions" ON public."recurring_deductions" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete dispatcher_payment_items" ON public."dispatcher_payment_items" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert dispatcher_payment_items" ON public."dispatcher_payment_items" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read dispatcher_payment_items" ON public."dispatcher_payment_items" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update dispatcher_payment_items" ON public."dispatcher_payment_items" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_delete_driver_investors" ON public."driver_investors" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tenant_insert_driver_investors" ON public."driver_investors" WITH CHECK ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tenant_select_driver_investors" ON public."driver_investors" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tenant_update_driver_investors" ON public."driver_investors" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Tenant users can delete dispatch_service_invoices" ON public."dispatch_service_invoices" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert dispatch_service_invoices" ON public."dispatch_service_invoices" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read dispatch_service_invoices" ON public."dispatch_service_invoices" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update dispatch_service_invoices" ON public."dispatch_service_invoices" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete invoices" ON public."invoices" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert invoices" ON public."invoices" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read invoices" ON public."invoices" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update invoices" ON public."invoices" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete pod_documents" ON public."pod_documents" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert pod_documents" ON public."pod_documents" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read pod_documents" ON public."pod_documents" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update pod_documents" ON public."pod_documents" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete investors" ON public."investors" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert investors" ON public."investors" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read investors" ON public."investors" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update investors" ON public."investors" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete expense_receipts" ON public."expense_receipts" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert expense_receipts" ON public."expense_receipts" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read expense_receipts" ON public."expense_receipts" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete truck_maintenance" ON public."truck_maintenance" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert truck_maintenance" ON public."truck_maintenance" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read truck_maintenance" ON public."truck_maintenance" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update truck_maintenance" ON public."truck_maintenance" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete expenses" ON public."expenses" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert expenses" ON public."expenses" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read expenses" ON public."expenses" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update expenses" ON public."expenses" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete maintenance_service_log" ON public."maintenance_service_log" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert maintenance_service_log" ON public."maintenance_service_log" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read maintenance_service_log" ON public."maintenance_service_log" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete truck_fixed_costs" ON public."truck_fixed_costs" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert truck_fixed_costs" ON public."truck_fixed_costs" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read truck_fixed_costs" ON public."truck_fixed_costs" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update truck_fixed_costs" ON public."truck_fixed_costs" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete notifications" ON public."notifications" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert notifications" ON public."notifications" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read notifications" ON public."notifications" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update notifications" ON public."notifications" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete eld_accounts" ON public."eld_accounts" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert eld_accounts" ON public."eld_accounts" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read eld_accounts" ON public."eld_accounts" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update eld_accounts" ON public."eld_accounts" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert onboarding_tokens" ON public."onboarding_tokens" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read onboarding_tokens" ON public."onboarding_tokens" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update onboarding_tokens" ON public."onboarding_tokens" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Authenticated users can insert push_tokens" ON public."push_tokens" WITH CHECK (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Tenant users can delete push_tokens" ON public."push_tokens" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read push_tokens" ON public."push_tokens" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete driver_locations" ON public."driver_locations" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert driver_locations" ON public."driver_locations" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read driver_locations" ON public."driver_locations" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update driver_locations" ON public."driver_locations" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Authenticated users can delete brokers" ON public."brokers" USING (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Authenticated users can insert brokers" ON public."brokers" WITH CHECK (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Authenticated users can read brokers" ON public."brokers" USING (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Authenticated users can update brokers" ON public."brokers" USING (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Tenant users can delete eld_vehicle_map" ON public."eld_vehicle_map" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert eld_vehicle_map" ON public."eld_vehicle_map" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read eld_vehicle_map" ON public."eld_vehicle_map" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update eld_vehicle_map" ON public."eld_vehicle_map" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Master admin can manage plan configs" ON public."plan_configs" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "Authenticated users can read meeting_requests" ON public."meeting_requests" USING (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Master admin can manage meeting_requests" ON public."meeting_requests" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "tenant_read" ON public."whatsapp_message_history" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "staff_read" ON public."driver_hos_clocks" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role)) OR (SELECT has_role(auth.uid(), 'dispatcher'::app_role))))));
ALTER POLICY "admin_read" ON public."driver_eld_connections" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND (SELECT has_role(auth.uid(), 'admin'::app_role)))));
ALTER POLICY "Tenant users can delete driver leasing agreements" ON public."driver_leasing_agreements" USING ((driver_id IN ( SELECT drivers.id
   FROM drivers
  WHERE (drivers.tenant_id = ( SELECT profiles.tenant_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "Tenant users can read driver leasing agreements" ON public."driver_leasing_agreements" USING ((EXISTS ( SELECT 1
   FROM drivers d
  WHERE ((d.id = driver_leasing_agreements.driver_id) AND ((d.tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid())))))));
ALTER POLICY "Tenant users can update driver leasing agreements" ON public."driver_leasing_agreements" USING ((driver_id IN ( SELECT drivers.id
   FROM drivers
  WHERE (drivers.tenant_id = ( SELECT profiles.tenant_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "tenant_read_leasing" ON public."driver_leasing_agreements" USING ((driver_id IN ( SELECT drivers.id
   FROM drivers
  WHERE (drivers.tenant_id = ( SELECT profiles.tenant_id
           FROM profiles
          WHERE (profiles.id = (SELECT auth.uid())))))));
ALTER POLICY "tenant_read" ON public."load_email_threads" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_access" ON public."truck_variable_costs" USING ((tenant_id = (SELECT get_user_tenant_id(auth.uid())))) WITH CHECK ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))));
ALTER POLICY "Tenant users can delete companies" ON public."companies" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can insert companies" ON public."companies" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can read companies" ON public."companies" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can update companies" ON public."companies" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_read" ON public."whatsapp_leads" USING (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "Tenant insert daily_search_status" ON public."daily_search_status" WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant read daily_search_status" ON public."daily_search_status" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant update daily_search_status" ON public."daily_search_status" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "Tenant users can delete dispatch clients" ON public."dispatch_service_clients" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Tenant users can insert dispatch clients" ON public."dispatch_service_clients" WITH CHECK ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Tenant users can read dispatch clients" ON public."dispatch_service_clients" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Tenant users can update dispatch clients" ON public."dispatch_service_clients" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "Admins can update own tenant" ON public."tenants" USING ((id = (SELECT get_user_tenant_id(auth.uid()))));
ALTER POLICY "Master admin can do all on tenants" ON public."tenants" USING ((SELECT is_master_admin(auth.uid())));
ALTER POLICY "Users can view own tenant" ON public."tenants" USING ((id = (SELECT get_user_tenant_id(auth.uid()))));
ALTER POLICY "tenant_read" ON public."broker_email_queue" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_all" ON public."load_routes" USING (((SELECT auth.uid()) IS NOT NULL)) WITH CHECK (((SELECT auth.uid()) IS NOT NULL));
ALTER POLICY "tenant_read" ON public."profit_config_history" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_isolation" ON public."expense_categories" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tenant_insert" ON public."rate_adjustments" WITH CHECK ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "tenant_isolation" ON public."rate_adjustments" USING ((tenant_id = ( SELECT profiles.tenant_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));
ALTER POLICY "staff_read" ON public."load_rc_signed" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role)) OR (SELECT has_role(auth.uid(), 'dispatcher'::app_role))))));
ALTER POLICY "tenant_all" ON public."crm_notes" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid())))) WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tenant_all" ON public."crm_contacts" USING (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid())))) WITH CHECK (((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) OR (SELECT is_master_admin(auth.uid()))));
ALTER POLICY "tax_admin_accounting" ON public."payee_tax_info" USING (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role)))))) WITH CHECK (((SELECT is_master_admin(auth.uid())) OR ((tenant_id = (SELECT get_user_tenant_id(auth.uid()))) AND ((SELECT has_role(auth.uid(), 'admin'::app_role)) OR (SELECT has_role(auth.uid(), 'accounting'::app_role))))));
commit;
