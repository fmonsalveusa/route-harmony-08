-- Cerrar lecturas de más: drivers e investors veían (por la API) datos de toda la empresa
-- (notificaciones, gastos, cola de emails, investors, ubicaciones, paradas, fotos, ajustes, perfiles).
-- Staff (admin, accounting, dispatcher, master) sigue viendo todo su tenant como antes.
-- Drivers/investors: solo lo suyo (las paradas, fotos y ajustes se filtran por las cargas/pagos
-- que ya pueden ver según el RLS de loads y payments).
begin;

create or replace function public.is_tenant_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_master_admin(_user_id)
      or exists (select 1 from user_roles r where r.user_id = _user_id and r.role in ('admin', 'accounting', 'dispatcher'))
$$;

-- Investor del usuario (por su email, dentro de su tenant)
create or replace function public.get_user_investor_id(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select i.id from investors i join profiles p on p.id = _user_id
  where lower(i.email) = lower(p.email) and i.tenant_id = p.tenant_id limit 1
$$;

grant execute on function public.is_tenant_staff(uuid), public.get_user_investor_id(uuid) to authenticated;

-- ── notifications: staff todo el tenant; driver solo las suyas ──
drop policy if exists "Tenant users can read notifications" on notifications;
create policy "Tenant users can read notifications" on notifications for select using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or driver_id = (select get_user_driver_id(auth.uid())))));
drop policy if exists "Tenant users can update notifications" on notifications;
create policy "Tenant users can update notifications" on notifications for update using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or driver_id = (select get_user_driver_id(auth.uid())))));
drop policy if exists "Tenant users can delete notifications" on notifications;
create policy "Tenant users can delete notifications" on notifications for delete using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

-- ── Tablas solo de staff: gastos ──
do $$ declare c text; begin
  foreach c in array array['select', 'update', 'delete'] loop
    execute format('drop policy if exists %I on expenses', 'Tenant users can ' || case c when 'select' then 'read' else c end || ' expenses');
    execute format('create policy %I on expenses for %s using ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))))',
      'Tenant users can ' || case c when 'select' then 'read' else c end || ' expenses', c);
  end loop;
end $$;
drop policy if exists "Tenant users can insert expenses" on expenses;
create policy "Tenant users can insert expenses" on expenses for insert with check (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

-- ── dispatchers: lectura y escritura solo staff ──
do $$ declare c text; begin
  foreach c in array array['select', 'update', 'delete'] loop
    execute format('drop policy if exists %I on dispatchers', 'Tenant users can ' || case c when 'select' then 'read' else c end || ' dispatchers');
    execute format('create policy %I on dispatchers for %s using ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))))',
      'Tenant users can ' || case c when 'select' then 'read' else c end || ' dispatchers', c);
  end loop;
end $$;
drop policy if exists "Tenant users can insert dispatchers" on dispatchers;
create policy "Tenant users can insert dispatchers" on dispatchers for insert with check (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

-- ── investors: staff todo; el investor solo su ficha. Escritura solo staff ──
drop policy if exists "Tenant users can read investors" on investors;
create policy "Tenant users can read investors" on investors for select using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or id = (select get_user_investor_id(auth.uid())))));
do $$ declare c text; begin
  foreach c in array array['update', 'delete'] loop
    execute format('drop policy if exists %I on investors', 'Tenant users can ' || c || ' investors');
    execute format('create policy %I on investors for %s using ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))))',
      'Tenant users can ' || c || ' investors', c);
  end loop;
end $$;
drop policy if exists "Tenant users can insert investors" on investors;
create policy "Tenant users can insert investors" on investors for insert with check (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

-- ── broker_email_queue: staff; el driver solo lo de sus cargas (la app revisa si ya se envió) ──
drop policy if exists "tenant_read" on broker_email_queue;
create policy "tenant_read" on broker_email_queue for select using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or load_id in (select id from loads))));

-- ── driver_locations: staff; el driver solo la suya ──
drop policy if exists "Tenant users can read driver_locations" on driver_locations;
create policy "Tenant users can read driver_locations" on driver_locations for select using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or driver_id::text = (select get_user_driver_id(auth.uid()))::text)));
drop policy if exists "Tenant users can update driver_locations" on driver_locations;
create policy "Tenant users can update driver_locations" on driver_locations for update using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or driver_id::text = (select get_user_driver_id(auth.uid()))::text)));
drop policy if exists "Tenant users can insert driver_locations" on driver_locations;
create policy "Tenant users can insert driver_locations" on driver_locations for insert with check (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or driver_id::text = (select get_user_driver_id(auth.uid()))::text)));
drop policy if exists "Tenant users can delete driver_locations" on driver_locations;
create policy "Tenant users can delete driver_locations" on driver_locations for delete using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

-- ── load_stops y pod_documents: staff; los demás solo los de las cargas que pueden ver ──
do $$ declare t text; c text; begin
  foreach t in array array['load_stops', 'pod_documents'] loop
    foreach c in array array['select', 'update', 'delete'] loop
      execute format('drop policy if exists %I on %I', 'Tenant users can ' || case c when 'select' then 'read' else c end || ' ' || t, t);
      execute format('create policy %I on %I for %s using ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and ((select is_tenant_staff(auth.uid())) or load_id in (select id from loads))))',
        'Tenant users can ' || case c when 'select' then 'read' else c end || ' ' || t, t, c);
    end loop;
    execute format('drop policy if exists %I on %I', 'Tenant users can insert ' || t, t);
    execute format('create policy %I on %I for insert with check ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and ((select is_tenant_staff(auth.uid())) or load_id in (select id from loads))))',
      'Tenant users can insert ' || t, t);
  end loop;
end $$;

-- ── payment_adjustments: staff; los demás solo los de sus pagos. Escritura solo staff ──
drop policy if exists "Tenant users can read payment_adjustments" on payment_adjustments;
create policy "Tenant users can read payment_adjustments" on payment_adjustments for select using (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid()))
    and ((select is_tenant_staff(auth.uid())) or payment_id in (select id from payments))));
do $$ declare c text; begin
  foreach c in array array['update', 'delete'] loop
    execute format('drop policy if exists %I on payment_adjustments', 'Tenant users can ' || c || ' payment_adjustments');
    execute format('create policy %I on payment_adjustments for %s using ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))))',
      'Tenant users can ' || c || ' payment_adjustments', c);
  end loop;
end $$;
drop policy if exists "Tenant users can insert payment_adjustments" on payment_adjustments;
create policy "Tenant users can insert payment_adjustments" on payment_adjustments for insert with check (
  (select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

-- ── profiles y user_roles: cada uno el suyo; staff todos los de su tenant ──
drop policy if exists "Users can view own profile and tenant" on profiles;
create policy "Users can view own profile and tenant" on profiles for select using (
  id = (select auth.uid()) or (select is_master_admin(auth.uid()))
  or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));
drop policy if exists "Users can view roles in their tenant" on user_roles;
create policy "Users can view roles in their tenant" on user_roles for select using (
  user_id = (select auth.uid())
  or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select is_tenant_staff(auth.uid()))));

commit;
