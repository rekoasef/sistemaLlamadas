-- =============================================================================
-- Cruci-Track: token por dispositivo para la ingesta de la app Android
-- Migration: 0011_dispositivo_tokens.sql
-- =============================================================================
--
-- La app escribía directo en Supabase con la anon key, que es pública: cualquiera
-- podía cargar llamadas falsas o cambiar el estado de una terminal. Desde la v2
-- la app manda todo a /api/ingest/* con un token propio de cada teléfono, y el
-- servidor decide el dispositivo_id a partir del token (no se puede falsificar).
--
-- Solo se guarda el SHA-256 del token. Los tokens se generan desde la web
-- (Dispositivos → Generar token) y regenerar uno revoca el anterior.
--
-- RLS activo y sin policies: solo el service role (route handlers) la lee.
-- =============================================================================

create table if not exists public.dispositivo_tokens (
  dispositivo_id text        primary key,
  token_hash     text        not null unique,
  creado_at      timestamptz not null default now(),
  ultimo_uso_at  timestamptz
);

alter table public.dispositivo_tokens enable row level security;

revoke all on public.dispositivo_tokens from anon, authenticated;
