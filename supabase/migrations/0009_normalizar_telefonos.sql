-- =============================================================================
-- Cruci-Track: comparar teléfonos por número nacional normalizado
-- Migration: 0009_normalizar_telefonos.sql
-- =============================================================================
--
-- El mismo número argentino llega en varios formatos: +543471343991,
-- +5493471343991 (con el 9 de celular), 3471343991 y 03471343991. Como la
-- vinculación comparaba el string exacto, 147 llamadas quedaban sin concesionario
-- y la agenda acumuló 30 números repetidos en distinto formato.
--
-- No se reescriben los números originales: se agrega una columna calculada con
-- el número nacional de 10 dígitos y la vinculación compara por ella. La web
-- replica la misma regla en web/src/lib/telefono.ts — mantenerlas iguales.
-- =============================================================================

create or replace function public.normalizar_telefono(numero text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when d ~ '^549\d{10}$' then substr(d, 4)   -- +54 9 3471 343991 (celular internacional)
    when d ~ '^54\d{10}$'  then substr(d, 3)   -- +54 3471 343991
    when d ~ '^0\d{10}$'   then substr(d, 2)   -- 0 3471 343991
    else d                                     -- 10 dígitos, extranjeros, códigos cortos
  end
  from (select regexp_replace(coalesce(numero, ''), '\D', '', 'g') as d) s
$$;

alter table public.llamadas
  add column if not exists numero_normalizado text
  generated always as (public.normalizar_telefono(numero_telefono)) stored;

alter table public.concesionario_telefonos
  add column if not exists numero_normalizado text
  generated always as (public.normalizar_telefono(numero_telefono)) stored;

create index if not exists llamadas_numero_normalizado_idx
  on public.llamadas (numero_normalizado);
create index if not exists concesionario_telefonos_numero_normalizado_idx
  on public.concesionario_telefonos (numero_normalizado);

-- ── Vinculación de llamadas nuevas ──────────────────────────────────────────
-- BEFORE INSERT: la columna generada todavía no está calculada en NEW, por eso
-- se normaliza NEW.numero_telefono acá.
create or replace function public.vincular_por_agenda_completa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select concesionario_id into new.concesionario_id
    from public.concesionario_telefonos
   where numero_normalizado = public.normalizar_telefono(new.numero_telefono)
     and numero_normalizado <> ''
   limit 1;
  return new;
end;
$$;

-- ── Retro-vinculación al agregar un número a la agenda ──────────────────────
-- AFTER INSERT: acá NEW.numero_normalizado ya está calculada.
create or replace function public.limpiar_historial_por_nuevo_numero()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.llamadas
     set concesionario_id = new.concesionario_id
   where numero_normalizado = new.numero_normalizado
     and new.numero_normalizado <> '';
  return new;
end;
$$;

-- tr_vincular_llamada (vincular_llamada_automatica) corría antes que
-- tr_vincular_llamada_nueva y su resultado siempre se pisaba: no tenía efecto.
drop trigger if exists tr_vincular_llamada on public.llamadas;
