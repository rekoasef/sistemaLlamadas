# Cruci-Track — Pendientes

> Última actualización: 2026-08-31
> Próxima sesión: 2026-09-01 — revisión de código para mejorar la plataforma.

---

## Estado de la sesión del 2026-08-26

Se arregló el error **"Error al procesar la vinculación"** al vincular un llamado a un
concesionario. La causa raíz no era el modal: **RLS rechazaba todas las escrituras**
porque el cliente de datos nunca llevaba la sesión del usuario y salía como rol `anon`.

Detalle técnico completo en [`KB.md` §11 — RLS y Clientes Supabase](./KB.md#11-rls-y-clientes-supabase).

### Archivos tocados (sin commitear)

| Archivo | Cambio |
|---------|--------|
| `web/src/lib/supabase.ts` | Usa `createBrowserClient` en browser (sesión desde cookies); cae al cliente `anon` en servidor |
| `web/src/lib/supabase-admin.ts` | **Nuevo.** Cliente service-role, lazy + cacheado, solo servidor |
| `web/src/services/reportes.service.ts` | `insertReporte()` acepta cliente opcional |
| `web/src/services/llamadas.service.ts` | `fetchLlamadasByRange()` acepta cliente opcional |
| `web/src/app/api/cron/weekly-report/route.ts` | Usa `getSupabaseAdmin()` |
| `web/src/app/api/cron/monthly-report/route.ts` | Usa `getSupabaseAdmin()` |
| `web/src/components/ModalVincular.tsx` | El `catch` muestra `err.message` en vez del genérico |
| `web/.env.local` | Línea comentada `SUPABASE_SERVICE_ROLE_KEY=` |
| `docs/KB.md` | Nueva §11 + tabla de auth ampliada |

`npx tsc --noEmit` y `npx next build` pasan. Verificado que la service-role key no
entra al bundle del cliente.

---

## Por qué "antes andaba y ahora no"

Respondido el 2026-08-31 con el MCP. **El código no se tocó: cambió la base.**

La migración `20260623155736_enable_rls_and_policies`, aplicada desde el dashboard el
**2026-06-23 15:57 UTC**, empieza con `-- Enable RLS on all 6 unprotected tables`. Hasta
ese momento `concesionarios`, `concesionario_telefonos`, `dispositivo_alias`,
`reportes_generados`, `terminal_status` y `terminal_status_history` tenían RLS **apagado**:
sin RLS no había nada que chequear y el cliente `anon` escribía sin problema. El bug del
cliente sin sesión existía desde siempre, pero estaba dormido.

Llegó en un lote de 4 migraciones en 2 minutos (`fix_functions_search_path_and_security`,
`enable_rls_and_policies`, `fix_security_definer_view`, `revoke_trigger_functions_from_public`):
es el set de remediación del **Security Advisor** de Supabase. Los cambios estaban bien;
el efecto colateral fue romper todas las escrituras de la web.

**Alcance:** desde el 2026-06-23 no entró ni un concesionario nuevo (0 filas con
`created_at` posterior; el último es del 2026-04-29). Toda escritura desde la web falló
en silencio durante ~2 meses.

**Lección:** ninguna de esas 4 migraciones está en `supabase/migrations/` — ver deuda nº5.
Si hubieran pasado por el repo, el cambio de RLS se habría visto en un diff.

---

## Bloqueantes — hacer primero

- [ ] **Cargar `SUPABASE_SERVICE_ROLE_KEY` en `web/.env.local`.**
      Supabase → Project Settings → API → `service_role`. La línea está comentada.
- [ ] **Cargar la misma var en Vercel** (Production + Preview). Sin esto los crons de
      reportes fallan con error explícito de key faltante.
- [x] ~~**Probar la vinculación logueado en la app.**~~ **Resuelto el 2026-08-31 vía MCP
      de Supabase.** Las policies de INSERT/UPDATE/DELETE para `authenticated` **existen y
      están bien** en `concesionarios`, `concesionario_telefonos` y `dispositivo_alias`
      (`with_check = true`). Probe directo: `authenticated` inserta OK, `anon` da `42501`.
      No hay nada que crear en la base.

- [ ] **Commitear y deployear el fix del cliente.** Es lo único que falta para que la
      vinculación ande. El `42501` del 2026-08-31 18:27 salió de
      `https://sistema-llamadas.vercel.app/` (edge_logs, POST `/rest/v1/concesionario_telefonos`,
      401): Vercel corre `43e113f`, donde `lib/supabase.ts` todavía es el `createClient`
      con `persistSession: false`. El `createBrowserClient` está solo en el working tree.

---

## Verificar en la revisión de mañana

Estas escrituras estaban rotas por la misma causa y deberían andar ya, pero **ninguna
se probó end-to-end**:

- [ ] Crear concesionario nuevo (`ModalEditarConcesionario.tsx:108`)
- [ ] Editar concesionario (`ModalEditarConcesionario.tsx:128`)
- [ ] Agregar teléfono adicional (`ModalEditarConcesionario.tsx:165`)
- [ ] Borrar teléfono (`ModalEditarConcesionario.tsx:179`)
- [ ] Borrar concesionario (`concesionarios/page.tsx:61`)
- [ ] Renombrar dispositivo / alias (`dispositivos/page.tsx:243`, `alias.service.ts:41`)
- [ ] Guardar y borrar reportes (`reportes.service.ts`)

---

## Bugs conocidos sin arreglar

### 1. Chequeo de duplicados falla por formato de teléfono

`web/src/components/ModalVincular.tsx:34` — `verificarDuplicado()` compara
`numero_telefono` como string exacto, pero en la tabla conviven los dos formatos:

```
543471256474     ← sin +
+543471343991    ← con +
```

Un mismo teléfono guardado en ambos formatos pasa el chequeo y se duplica en la agenda.
**Fix probable:** normalizar a E.164 al escribir, y migrar las filas existentes.
Conviene revisar también con qué formato llega `numero` desde la app mobile.

### 2. `maybeSingle()` sobre posibles duplicados

Misma función, `ModalVincular.tsx:39`. Si el número ya está duplicado en la tabla,
`.maybeSingle()` devuelve error en vez de fila, `data` queda `null`, el chequeo pasa
y se inserta un tercer duplicado. Depende del bug 1.

### 3. El dashboard recorta la lista a 200 registros con el tiempo

**Síntoma (reportado por el usuario):** el panel arranca mostrando los ~900+ registros,
pero después de un rato baja a 200. Recargando la página vuelve a la normalidad.

**Causa (identificada, sin arreglar):** `web/src/app/page.tsx:154`

```typescript
return [fullRow, ...prev].slice(0, 200)
```

El handler de realtime, cada vez que llega una llamada **nueva** (no un update),
antepone la fila y trunca el array a 200. La carga inicial trae hasta 2000
(`DASHBOARD_ROW_LIMIT`, `llamadas.service.ts:65`), así que la lista completa sobrevive
hasta el primer INSERT por realtime — ahí se recorta y se queda en 200. El reload
vuelve a hacer el fetch completo, por eso "se arregla solo".

"Pasa mucho tiempo" = tiempo suficiente para que entre al menos una llamada nueva.

**A decidir mañana:** el `200` parece un tope de seguridad para el payload de realtime,
pero está desalineado con el `DASHBOARD_ROW_LIMIT = 2000` del fetch inicial. Lo más
probable es que deba usar la misma constante. Ojo que el recorte también falsea los
KPIs: `stats` se calcula sobre `filtradas`, que sale de `llamadasRaw` ya truncado.

---

### 4. ~~`llamadas` no tiene policy de UPDATE~~ — descartado

Verificado el 2026-08-31: **no es un problema.** El UPDATE de `llamadas.concesionario_id`
lo hace el trigger `tr_limpiar_historial_numero` sobre `concesionario_telefonos`, cuya
función `limpiar_historial_por_nuevo_numero()` es `SECURITY DEFINER` y pertenece a
`postgres` (`rolbypassrls = true`). Saltea RLS, así que no necesita policy. Es el trigger
que retro-vincula las llamadas históricas al agregar un número a la agenda.

---

### 5. Deuda: no hay migraciones de RLS en el repo

`supabase/migrations/` solo tiene cron y terminal status. Las policies de RLS viven
únicamente en el dashboard de Supabase, así que no son reproducibles ni auditables.
Valdría la pena volcarlas a una migración.

---

## Ideas para la revisión de código

- El `catch` genérico que tapaba el error real en `ModalVincular` probablemente se
  repite en otros modales — buscar `alert("Error` y revisar que todos muestren
  `err.message`.
- `web/src/lib/supabase.ts` sigue exportando un cliente `anon` para el server. Si algún
  día un Server Component necesita leer datos con la sesión del usuario, va a leer como
  `anon` en silencio. Hoy no pasa, pero es una trampa.
