-- =============================================================================
-- Cruci-Track: un número = una entrada en la agenda
-- Migration: 0012_agenda_sin_duplicados.sql
-- =============================================================================
--
-- Con numero_normalizado (0009) aparecieron 30 números repetidos en distinto
-- formato. Aprobado por el usuario el 2026-10-13:
--
-- 1. 3471343991 estaba en FABRICA (Principal) y en DISTRIBUIDORA Z: es de
--    FABRICA. Se borra la entrada de DISTRIBUIDORA Z y su única llamada pasa a
--    FABRICA.
-- 2. Los otros 29 repetidos son del mismo concesionario (32 filas de más): se
--    conserva la marcada "Principal" o, si no hay, la primera en formato +54.
-- 3. Índice único sobre numero_normalizado para que no vuelva a pasar.
-- =============================================================================

-- 1. Duplicado cruzado: el número es de FABRICA
update public.llamadas
   set concesionario_id = '90ca3fca-fcee-4b81-afa2-297ec36c386f'          -- FABRICA
 where numero_normalizado = '3471343991'
   and concesionario_id   = 'e22904c3-1b91-4f8d-96b2-988ce48e842e';       -- DISTRIBUIDORA Z

delete from public.concesionario_telefonos
 where id = 'e60900aa-5b31-498a-883c-876714be9cd6';                       -- 3471343991 en DISTRIBUIDORA Z

-- 2. Duplicados dentro del mismo concesionario
delete from public.concesionario_telefonos t
 using (
   select id,
          row_number() over (
            partition by numero_normalizado
            order by (nombre_referencia = 'Principal') desc, numero_telefono
          ) as rn
     from public.concesionario_telefonos
    where numero_normalizado <> ''
 ) d
 where t.id = d.id
   and d.rn > 1;

-- 3. Que no vuelva a pasar
create unique index if not exists concesionario_telefonos_numero_normalizado_key
  on public.concesionario_telefonos (numero_normalizado)
  where numero_normalizado <> '';
