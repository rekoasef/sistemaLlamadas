-- =============================================================================
-- Cruci-Track: el teléfono principal siempre está en la agenda
-- Migration: 0013_telefono_principal_en_agenda.sql
-- =============================================================================
--
-- La vinculación de llamadas solo mira concesionario_telefonos. Los
-- concesionarios creados desde "Editar concesionario" guardaban el teléfono
-- principal solo en concesionarios.telefono_principal, así que sus llamadas no
-- se vinculaban (26 concesionarios y 25 llamadas al 2026-10-13).
--
-- 1. Trigger: al crear un concesionario o cambiarle el teléfono principal, el
--    número se agrega a la agenda como "Principal" (si ya está en la agenda de
--    alguien, no se toca).
-- 2. Backfill de los que faltan. El trigger tr_limpiar_historial_numero de la
--    agenda vincula sus llamadas históricas.
-- =============================================================================

create or replace function public.agregar_telefono_principal_a_agenda()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.normalizar_telefono(new.telefono_principal) <> '' then
    insert into public.concesionario_telefonos (concesionario_id, numero_telefono, nombre_referencia)
    values (new.id, new.telefono_principal, 'Principal')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.agregar_telefono_principal_a_agenda() from public, anon, authenticated;

drop trigger if exists tr_agregar_principal_a_agenda on public.concesionarios;
create trigger tr_agregar_principal_a_agenda
  after insert or update of telefono_principal on public.concesionarios
  for each row execute function public.agregar_telefono_principal_a_agenda();

-- Backfill
insert into public.concesionario_telefonos (concesionario_id, numero_telefono, nombre_referencia)
select c.id, c.telefono_principal, 'Principal'
  from public.concesionarios c
 where public.normalizar_telefono(c.telefono_principal) <> ''
   and not exists (
     select 1 from public.concesionario_telefonos t
      where t.numero_normalizado = public.normalizar_telefono(c.telefono_principal)
   )
on conflict do nothing;
