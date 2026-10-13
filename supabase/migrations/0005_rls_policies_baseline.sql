-- =============================================================================
-- Cruci-Track: estado de RLS en producción al 2026-10-13
-- Migration: 0005_rls_policies_baseline.sql
-- =============================================================================
--
-- YA APLICADO en producción. Esto vuelca al repo lo que se creó desde el dashboard
-- de Supabase (entre otras, la migración remota 20260623155736_enable_rls_and_policies),
-- para que las policies sean auditables y reproducibles. Es idempotente: correrlo
-- sobre la base actual no cambia nada.
--
-- El paso siguiente (0006) cierra la lectura anónima.
-- =============================================================================

alter table public.llamadas                enable row level security;
alter table public.concesionarios          enable row level security;
alter table public.concesionario_telefonos enable row level security;
alter table public.dispositivo_alias       enable row level security;
alter table public.reportes_generados      enable row level security;
alter table public.terminal_status         enable row level security;
alter table public.terminal_status_history enable row level security;

-- ── llamadas ────────────────────────────────────────────────────────────────
-- La app Android escribe con la anon key (INSERT con Prefer: return=minimal).
drop policy if exists "Enable realtime for all"     on public.llamadas;
drop policy if exists "Permitir Lectura Anonima"    on public.llamadas;
drop policy if exists "Permitir Insercion Anonima"  on public.llamadas;
create policy "Enable realtime for all"    on public.llamadas for select to public using (true);
create policy "Permitir Lectura Anonima"   on public.llamadas for select to anon   using (true);
create policy "Permitir Insercion Anonima" on public.llamadas for insert to anon   with check (true);

-- ── concesionarios ──────────────────────────────────────────────────────────
drop policy if exists concesionarios_select_all           on public.concesionarios;
drop policy if exists concesionarios_insert_authenticated on public.concesionarios;
drop policy if exists concesionarios_update_authenticated on public.concesionarios;
drop policy if exists concesionarios_delete_authenticated on public.concesionarios;
create policy concesionarios_select_all           on public.concesionarios for select to public        using (true);
create policy concesionarios_insert_authenticated on public.concesionarios for insert to authenticated with check (true);
create policy concesionarios_update_authenticated on public.concesionarios for update to authenticated using (true) with check (true);
create policy concesionarios_delete_authenticated on public.concesionarios for delete to authenticated using (true);

-- ── concesionario_telefonos ─────────────────────────────────────────────────
drop policy if exists concesionario_telefonos_select_all           on public.concesionario_telefonos;
drop policy if exists concesionario_telefonos_insert_authenticated on public.concesionario_telefonos;
drop policy if exists concesionario_telefonos_update_authenticated on public.concesionario_telefonos;
drop policy if exists concesionario_telefonos_delete_authenticated on public.concesionario_telefonos;
create policy concesionario_telefonos_select_all           on public.concesionario_telefonos for select to public        using (true);
create policy concesionario_telefonos_insert_authenticated on public.concesionario_telefonos for insert to authenticated with check (true);
create policy concesionario_telefonos_update_authenticated on public.concesionario_telefonos for update to authenticated using (true) with check (true);
create policy concesionario_telefonos_delete_authenticated on public.concesionario_telefonos for delete to authenticated using (true);

-- ── dispositivo_alias ───────────────────────────────────────────────────────
drop policy if exists dispositivo_alias_select_all           on public.dispositivo_alias;
drop policy if exists dispositivo_alias_insert_authenticated on public.dispositivo_alias;
drop policy if exists dispositivo_alias_update_authenticated on public.dispositivo_alias;
drop policy if exists dispositivo_alias_delete_authenticated on public.dispositivo_alias;
create policy dispositivo_alias_select_all           on public.dispositivo_alias for select to public        using (true);
create policy dispositivo_alias_insert_authenticated on public.dispositivo_alias for insert to authenticated with check (true);
create policy dispositivo_alias_update_authenticated on public.dispositivo_alias for update to authenticated using (true) with check (true);
create policy dispositivo_alias_delete_authenticated on public.dispositivo_alias for delete to authenticated using (true);

-- ── reportes_generados ──────────────────────────────────────────────────────
-- Los crons escriben con service role (bypass de RLS).
drop policy if exists reportes_generados_all_authenticated on public.reportes_generados;
create policy reportes_generados_all_authenticated on public.reportes_generados for all to authenticated using (true) with check (true);

-- ── terminal_status ─────────────────────────────────────────────────────────
-- Heartbeat de la app: upsert (ON CONFLICT DO UPDATE) con la anon key.
drop policy if exists terminal_status_select_all on public.terminal_status;
drop policy if exists terminal_status_insert_all on public.terminal_status;
drop policy if exists terminal_status_update_all on public.terminal_status;
create policy terminal_status_select_all on public.terminal_status for select to public using (true);
create policy terminal_status_insert_all on public.terminal_status for insert to public with check (true);
create policy terminal_status_update_all on public.terminal_status for update to public using (true) with check (true);

-- ── terminal_status_history ─────────────────────────────────────────────────
-- Lo escribe el trigger log_terminal_status_change (SECURITY DEFINER).
drop policy if exists terminal_status_history_select_authenticated on public.terminal_status_history;
create policy terminal_status_history_select_authenticated on public.terminal_status_history for select to authenticated using (true);
