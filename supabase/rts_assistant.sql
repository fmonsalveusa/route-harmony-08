-- Asistente de factoring RTS (extensión de Chrome sobre el portal de RTS)
-- Claves de integración por tenant: solo admins las ven. La extensión manda la clave a la
-- función rts-assistant, que entrega las cargas a facturar y sus documentos.
create table if not exists integration_keys (
  tenant_id uuid not null references tenants(id) on delete cascade,
  kind text not null,                  -- 'rts_assistant'
  key text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  primary key (tenant_id, kind)
);
alter table integration_keys enable row level security;
drop policy if exists "admin_manage" on integration_keys;
create policy "admin_manage" on integration_keys for all
  using ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select has_role(auth.uid(), 'admin'::app_role))))
  with check ((select is_master_admin(auth.uid())) or (tenant_id = (select get_user_tenant_id(auth.uid())) and (select has_role(auth.uid(), 'admin'::app_role))));
grant select, insert, update, delete on integration_keys to authenticated;
grant all on integration_keys to service_role;

-- Cuándo se mandó la carga a RTS desde el asistente
alter table loads add column if not exists rts_submitted_at timestamptz;
