-- =============================================================================
-- Cruci-Track: Automated Weekly Report Generator
-- Migration: 0001_weekly_report_cron.sql
-- =============================================================================
--
-- PREREQUISITE: pg_cron must be enabled in Supabase Dashboard.
--   Dashboard → Database → Extensions → Search "pg_cron" → Enable
--   (Requires Pro plan or self-hosted. Do NOT run the CREATE EXTENSION below
--    manually — Supabase manages the extension installation.)
--
-- Schedule: Every Friday at 22:00 UTC = 19:00hs ART (UTC-3)
-- Cron expr: 0 22 * * 5
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Function: public.generar_informe_semanal_automatico()
--
-- Calculates KPIs for the last 7 days and inserts a row into
-- reportes_generados with tipo = 'AUTOMATICO'.
--
-- Rules:
--   - Efficiency threshold: 60% (UMBRAL_EFICIENCIA)
--   - No upper date cap — runs at end-of-week so v_fin = current_date
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.generar_informe_semanal_automatico()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio     date    := current_date - interval '7 days';
  v_fin        date    := current_date;
  v_total      int;
  v_entrantes  int;
  v_salientes  int;
  v_atendidas  int;
  v_eficiencia int;
  v_resumen    text;
begin

  -- Total interactions in window
  select count(*)
    into v_total
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz;

  -- Incoming calls
  select count(*)
    into v_entrantes
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz
     and upper(tipo_llamada) = 'ENTRANTE';

  v_salientes := v_total - v_entrantes;

  -- Attended calls
  select count(*)
    into v_atendidas
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz
     and upper(estado) = 'ATENDIDA';

  -- Efficiency ratio (integer %)
  v_eficiencia := case
    when v_total > 0 then round((v_atendidas::numeric / v_total) * 100)
    else 0
  end;

  -- Executive summary text (mirrors generarResumenEjecutivo in src/lib/kpi.ts)
  v_resumen := format(
    E'INFORME DE AUDITORIA DE RED CRUCIANELLI\n'
    '---------------------------------------\n'
    'PERIODO ANALIZADO: %s HASTA %s.\n\n'
    'RESULTADOS OPERATIVOS:\n'
    'SE HAN PROCESADO UN TOTAL DE %s INTERACCIONES EN LA RED.\n'
    'DESGLOSE TECNICO: %s LLAMADAS ENTRANTES Y %s SALIENTES.\n\n'
    'EFICIENCIA DE ATENCION:\n'
    'EL RATIO DE RESPUESTA ALCANZADO ES DEL %s%%.\n'
    '%s',
    to_char(v_inicio, 'DD/MM/YYYY'),
    to_char(v_fin,    'DD/MM/YYYY'),
    v_total,
    v_entrantes,
    v_salientes,
    v_eficiencia,
    case
      when v_eficiencia >= 60
        then 'ESTADO OPTIMO: EL EQUIPO MANTIENE UN NIVEL DE RESPUESTA SATISFACTORIO.'
        else 'ALERTA: SE DETECTA UN NIVEL DE PERDIDA DE LLAMADAS POR ENCIMA DEL UMBRAL PERMITIDO. SE RECOMIENDA REVISAR LA DISPONIBILIDAD DE LAS TERMINALES.'
    end
  );

  -- Persist report
  insert into reportes_generados (
    titulo,
    rango_inicio,
    rango_fin,
    metricas,
    resumen_escrito,
    tipo
  ) values (
    'REPORTE SEMANAL AUTOMATICO ' || to_char(current_date, 'DD/MM/YYYY'),
    v_inicio,
    v_fin,
    jsonb_build_object(
      'total',      v_total,
      'entrantes',  v_entrantes,
      'salientes',  v_salientes,
      'atendidas',  v_atendidas,
      'eficiencia', v_eficiencia
    ),
    v_resumen,
    'AUTOMATICO'
  );

end;
$$;

-- Grant execute to the postgres role (used by pg_cron internally)
grant execute on function public.generar_informe_semanal_automatico() to postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cron schedule
--
-- To register, run this in the Supabase SQL Editor after enabling pg_cron:
--
--   select cron.schedule(
--     'weekly-crucitrack-report',    -- job name (unique)
--     '0 22 * * 5',                  -- every Friday 22:00 UTC = 19:00 ART
--     $$ select public.generar_informe_semanal_automatico(); $$
--   );
--
-- To view scheduled jobs:   select * from cron.job;
-- To unschedule:             select cron.unschedule('weekly-crucitrack-report');
-- ─────────────────────────────────────────────────────────────────────────────
