-- =============================================================================
-- Cruci-Track: un solo reporte semanal
-- Migration: 0007_unschedule_informe_viernes.sql
-- =============================================================================
--
-- El pg_cron 'informe-viernes' (viernes 19:00 UTC, generar_informe_semanal_automatico)
-- duplicaba el reporte semanal que ya genera el cron de Vercel
-- (/api/cron/weekly-report), con otro rango de fechas. Aplicado el 2026-10-13.
--
-- La función SQL queda en la base sin uso; borrarla si nadie la necesita.
-- =============================================================================

select cron.unschedule(jobid) from cron.job where jobname = 'informe-viernes';
