-- =============================================================================
-- Cruci-Track: marcar terminales OFFLINE (reemplaza el cron de 0003)
-- Migration: 0008_mark_offline_terminals.sql
-- =============================================================================
--
-- El job 'mark-offline-terminals' de 0003 no existía en producción (verificado el
-- 2026-10-13: cron.job vacío), así que ninguna terminal pasaba a OFFLINE y nunca
-- salía la alerta de "sin conexión".
--
-- Cambios respecto de 0003:
-- - Umbral de 60 min en vez de 20: Android demora los workers (Doze) y había
--   terminales activas con 27–39 min sin heartbeat; con 20 min habría alertas
--   falsas en ida y vuelta.
-- - Solo en horario laboral: cada 10 min, lunes a viernes 11:00–21:50 UTC
--   (08:00–18:50 ART), para no alertar por teléfonos apagados de noche.
--
-- Cada cambio de estado lo registra trg_log_terminal_status_change en
-- terminal_status_history, y trg_notify_terminal_status_change llama a
-- /api/terminal-alert, que manda el mail a ALERT_RECIPIENTS.
-- =============================================================================

select cron.unschedule(jobid) from cron.job where jobname = 'mark-offline-terminals';

select cron.schedule(
  'mark-offline-terminals',
  '*/10 11-21 * * 1-5',
  $$
    update public.terminal_status
       set status = 'OFFLINE'
     where status = 'ONLINE'
       and last_seen < now() - interval '60 minutes';
  $$
);
