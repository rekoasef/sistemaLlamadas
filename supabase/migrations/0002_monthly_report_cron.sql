-- =============================================================================
-- Cruci-Track: Automated Monthly Report Generator
-- Migration: 0002_monthly_report_cron.sql
-- =============================================================================
--
-- Schedule: Last day of each month at 22:00 UTC = 19:00hs ART (UTC-3)
-- Cron expr: 0 22 28-31 * *  (runs on days 28-31, checks if last day of month)
--
-- Also updates the weekly function to use the Gestión Proactiva efficiency formula
-- (matches the TypeScript calcularKPIs logic):
--   Puntos Positivos    = Entrantes Atendidas + Todas las Salientes
--   Total Interacciones = Total Entrantes     + Todas las Salientes
--   Eficiencia          = (Puntos Positivos / Total Interacciones) × 100
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Update weekly function to use corrected Gestión Proactiva formula
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.generar_informe_semanal_automatico()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio              date    := current_date - interval '7 days';
  v_fin                 date    := current_date;
  v_total               int;
  v_entrantes           int;
  v_salientes           int;
  v_entrantes_atendidas int;
  v_eficiencia          int;
  v_resumen             text;
begin

  select count(*)
    into v_total
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz;

  select count(*)
    into v_entrantes
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz
     and upper(tipo_llamada) = 'ENTRANTE';

  v_salientes := v_total - v_entrantes;

  -- Entrantes atendidas (for Gestión Proactiva formula)
  select count(*)
    into v_entrantes_atendidas
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz
     and upper(tipo_llamada) = 'ENTRANTE'
     and upper(estado)       = 'ATENDIDA';

  -- Gestión Proactiva: (entrantes_atendidas + salientes) / (entrantes + salientes) × 100
  v_eficiencia := case
    when v_total > 0
      then round(((v_entrantes_atendidas + v_salientes)::numeric / v_total) * 100)
    else 0
  end;

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
    v_total, v_entrantes, v_salientes, v_eficiencia,
    case
      when v_eficiencia >= 80
        then 'ESTADO OPTIMO: EL EQUIPO MANTIENE UN NIVEL DE RESPUESTA SATISFACTORIO PARA LOS ESTANDARES DE LA RED.'
        else 'ALERTA: SE DETECTA UN NIVEL DE PERDIDA DE LLAMADAS POR ENCIMA DEL UMBRAL PERMITIDO. SE RECOMIENDA REVISAR LA DISPONIBILIDAD DE LAS TERMINALES.'
    end
  );

  insert into reportes_generados (titulo, rango_inicio, rango_fin, metricas, resumen_escrito, tipo)
  values (
    'REPORTE SEMANAL AUTOMATICO ' || to_char(current_date, 'DD/MM/YYYY'),
    v_inicio, v_fin,
    jsonb_build_object(
      'total',      v_total,
      'entrantes',  v_entrantes,
      'salientes',  v_salientes,
      'atendidas',  v_entrantes_atendidas + v_salientes,
      'eficiencia', v_eficiencia
    ),
    v_resumen,
    'AUTOMATICO'
  );

end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- New: Monthly report function
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.generar_informe_mensual_automatico()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio              date;
  v_fin                 date;
  v_total               int;
  v_entrantes           int;
  v_salientes           int;
  v_entrantes_atendidas int;
  v_eficiencia          int;
  v_resumen             text;
begin

  -- Only run on the actual last day of the month
  if current_date <> (date_trunc('month', current_date) + interval '1 month - 1 day')::date then
    return;
  end if;

  v_inicio := date_trunc('month', current_date)::date;
  v_fin    := current_date;

  select count(*)
    into v_total
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz;

  select count(*)
    into v_entrantes
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz
     and upper(tipo_llamada) = 'ENTRANTE';

  v_salientes := v_total - v_entrantes;

  select count(*)
    into v_entrantes_atendidas
    from llamadas
   where fecha_llamada >= v_inicio::timestamptz
     and fecha_llamada <  (v_fin + interval '1 day')::timestamptz
     and upper(tipo_llamada) = 'ENTRANTE'
     and upper(estado)       = 'ATENDIDA';

  v_eficiencia := case
    when v_total > 0
      then round(((v_entrantes_atendidas + v_salientes)::numeric / v_total) * 100)
    else 0
  end;

  v_resumen := format(
    E'INFORME MENSUAL DE AUDITORIA DE RED CRUCIANELLI\n'
    '------------------------------------------------\n'
    'PERIODO ANALIZADO: %s HASTA %s.\n\n'
    'RESULTADOS OPERATIVOS:\n'
    'SE HAN PROCESADO UN TOTAL DE %s INTERACCIONES EN LA RED DURANTE EL MES.\n'
    'DESGLOSE TECNICO: %s LLAMADAS ENTRANTES Y %s SALIENTES.\n\n'
    'EFICIENCIA DE ATENCION:\n'
    'EL RATIO DE RESPUESTA ALCANZADO ES DEL %s%%.\n'
    '%s',
    to_char(v_inicio, 'DD/MM/YYYY'),
    to_char(v_fin,    'DD/MM/YYYY'),
    v_total, v_entrantes, v_salientes, v_eficiencia,
    case
      when v_eficiencia >= 80
        then 'ESTADO OPTIMO: EL EQUIPO MANTIENE UN NIVEL DE RESPUESTA SATISFACTORIO PARA LOS ESTANDARES DE LA RED.'
        else 'ALERTA: SE DETECTA UN NIVEL DE PERDIDA DE LLAMADAS POR ENCIMA DEL UMBRAL PERMITIDO. SE RECOMIENDA REVISAR LA DISPONIBILIDAD DE LAS TERMINALES.'
    end
  );

  insert into reportes_generados (titulo, rango_inicio, rango_fin, metricas, resumen_escrito, tipo)
  values (
    'REPORTE MENSUAL AUTOMATICO ' || to_char(v_inicio, 'MM/YYYY'),
    v_inicio, v_fin,
    jsonb_build_object(
      'total',      v_total,
      'entrantes',  v_entrantes,
      'salientes',  v_salientes,
      'atendidas',  v_entrantes_atendidas + v_salientes,
      'eficiencia', v_eficiencia
    ),
    v_resumen,
    'AUTOMATICO'
  );

end;
$$;

grant execute on function public.generar_informe_mensual_automatico() to postgres;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cron schedule for monthly report
--
-- Run in Supabase SQL Editor after enabling pg_cron:
--
--   select cron.schedule(
--     'monthly-crucitrack-report',
--     '0 22 28-31 * *',
--     $$ select public.generar_informe_mensual_automatico(); $$
--   );
-- ─────────────────────────────────────────────────────────────────────────────
