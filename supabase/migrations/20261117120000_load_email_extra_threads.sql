-- Hilos de Gmail adicionales de una carga (además del principal, que se detecta solo)
alter table public.load_email_threads
  add column if not exists extra_threads jsonb not null default '[]'::jsonb;
