-- =============================================================================
-- Cruci-Track: la lectura de datos exige sesión
-- Migration: 0006_select_solo_authenticated.sql
-- =============================================================================
--
-- Hasta acá cualquiera con la anon key (que es pública: está en el APK y en el
-- repo) podía leer llamadas, concesionarios, teléfonos y alias sin loguearse.
-- Desde esta migración solo lee `authenticated`. La web lee con la sesión del
-- usuario y los crons/webhook con service role, así que ninguno depende de anon.
--
-- Qué NO cambia, a propósito:
-- - `llamadas` mantiene el INSERT de anon: la app Android escribe así, con
--   `Prefer: return=minimal`, que no necesita SELECT.
-- - `terminal_status` mantiene el SELECT público: el heartbeat de la app es un
--   upsert (ON CONFLICT DO UPDATE) y Postgres exige la policy de SELECT para eso.
--   Se cierra en la Fase 4, cuando la app escriba por un endpoint propio.
-- - Los triggers de vinculación de `llamadas` siguen andando: el que define el
--   resultado (`vincular_por_agenda_completa`) es SECURITY DEFINER.
-- =============================================================================

-- ── llamadas ────────────────────────────────────────────────────────────────
drop policy if exists "Enable realtime for all"  on public.llamadas;
drop policy if exists "Permitir Lectura Anonima" on public.llamadas;
drop policy if exists llamadas_select_authenticated on public.llamadas;
create policy llamadas_select_authenticated
  on public.llamadas for select to authenticated using (true);

-- ── concesionarios ──────────────────────────────────────────────────────────
drop policy if exists concesionarios_select_all           on public.concesionarios;
drop policy if exists concesionarios_select_authenticated on public.concesionarios;
create policy concesionarios_select_authenticated
  on public.concesionarios for select to authenticated using (true);

-- ── concesionario_telefonos ─────────────────────────────────────────────────
drop policy if exists concesionario_telefonos_select_all           on public.concesionario_telefonos;
drop policy if exists concesionario_telefonos_select_authenticated on public.concesionario_telefonos;
create policy concesionario_telefonos_select_authenticated
  on public.concesionario_telefonos for select to authenticated using (true);

-- ── dispositivo_alias ───────────────────────────────────────────────────────
drop policy if exists dispositivo_alias_select_all           on public.dispositivo_alias;
drop policy if exists dispositivo_alias_select_authenticated on public.dispositivo_alias;
create policy dispositivo_alias_select_authenticated
  on public.dispositivo_alias for select to authenticated using (true);
