-- Notificaciones del TMS: se borran al pasar 24 horas de emitidas (cada hora, al minuto 30).
-- Lo más largo que el sistema mira hacia atrás es 12 h (para no repetir avisos), así que no afecta nada.
select cron.unschedule('notifications-cleanup') where exists (select 1 from cron.job where jobname = 'notifications-cleanup');
select cron.schedule('notifications-cleanup', '30 * * * *',
  $$ delete from public.notifications where created_at < now() - interval '24 hours' $$);
delete from public.notifications where created_at < now() - interval '24 hours';
