-- =============================================================================
-- Cruci-Track: vincular llamadas históricas que quedaron sin concesionario
-- Migration: 0010_revincular_llamadas_historicas.sql
-- =============================================================================
--
-- Con la comparación normalizada de 0009, las llamadas sin concesionario cuyo
-- número está en la agenda en otro formato se pueden vincular (147 al
-- 2026-10-13). Solo toca llamadas con concesionario_id null, y solo números que
-- en la agenda apuntan a un único concesionario. Las llamadas ya vinculadas no
-- se modifican.
-- =============================================================================

update public.llamadas l
   set concesionario_id = a.concesionario_id
  from (
    select numero_normalizado, (array_agg(concesionario_id))[1] as concesionario_id
      from public.concesionario_telefonos
     where numero_normalizado <> '' and concesionario_id is not null
     group by numero_normalizado
    having count(distinct concesionario_id) = 1
  ) a
 where l.concesionario_id is null
   and l.numero_normalizado = a.numero_normalizado;
