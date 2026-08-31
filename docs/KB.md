# Cruci-Track — Knowledge Base Técnica

> **Versión:** 2.2 · **Última actualización:** 2026-08-26
> **Stack:** Next.js 13.5 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Realtime)

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Flujo de Autenticación](#2-flujo-de-autenticación)
3. [Motor de Informes](#3-motor-de-informes)
4. [Capa de Servicios](#4-capa-de-servicios)
5. [Lógica de Negocio (KPI Engine)](#5-lógica-de-negocio-kpi-engine)
6. [Realtime & Dashboard](#6-realtime--dashboard)
7. [PDF Engine](#7-pdf-engine)
8. [Automatización (pg_cron)](#8-automatización-pg_cron)
9. [Guía de Onboarding](#9-guía-de-onboarding)
10. [FAQ & Troubleshooting](#10-faq--troubleshooting)
11. [RLS y Clientes Supabase](#11-rls-y-clientes-supabase)

---

## 1. Arquitectura General

### Capas de la aplicación

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (React, Client Components)                        │
│  src/app/**/page.tsx  ·  src/components/**                  │
├─────────────────────────────────────────────────────────────┤
│  Business Logic (Pure Functions, no React deps)             │
│  src/lib/kpi.ts  ·  src/lib/pdf.ts                          │
├─────────────────────────────────────────────────────────────┤
│  Service Layer (Supabase API calls)                         │
│  src/services/llamadas.service.ts                           │
│  src/services/alias.service.ts                              │
│  src/services/reportes.service.ts                           │
├─────────────────────────────────────────────────────────────┤
│  Auth Layer                                                  │
│  src/middleware.ts  ·  src/lib/supabase-browser.ts          │
│  src/lib/supabase-server.ts                                 │
├─────────────────────────────────────────────────────────────┤
│  Database (Supabase / PostgreSQL)                           │
│  Project ID: luohkbuyzxcgtbuehjup                           │
└─────────────────────────────────────────────────────────────┘
```

### Esquema de base de datos

| Tabla                  | Propósito                                          | Clave Notable               |
|------------------------|----------------------------------------------------|-----------------------------|
| `llamadas`             | Registro de cada llamada telefónica                | FK → `concesionarios`       |
| `concesionarios`       | Directorio de concesionarios Crucianelli           | —                           |
| `concesionario_telefonos` | Teléfonos vinculados a cada concesionario       | FK → `concesionarios`       |
| `dispositivo_alias`    | Nombres humanizados para terminales (dispositivos) | Unique: `dispositivo_id`    |
| `reportes_generados`   | Archivo histórico de informes generados            | `metricas` JSONB            |

**Vista:** `reporte_semanal` — Agrega totales y tasa de efectividad por dispositivo.
**Función:** `generar_informe_semanal_automatico()` — Invocada por pg_cron cada viernes.

### Tipos TypeScript generados

Los tipos de la DB se generan con:
```bash
npx supabase gen types typescript --project-id luohkbuyzxcgtbuehjup > src/types/supabase.ts
```

Sobre esos tipos base se construyen los tipos de dominio en `src/types/domain.ts`.

---

## 2. Flujo de Autenticación

### Visión general

```
Browser                   Next.js Edge              Supabase Auth
   │                         │                           │
   │── GET /dashboard ───────▶│                           │
   │                         │── getSession() ───────────▶│
   │                         │◀── session=null ──────────│
   │◀── 302 /login?redirectTo=/dashboard ────────────────│
   │                         │                           │
   │── POST signInWithPassword ──────────────────────────▶│
   │◀────────────────────── Set-Cookie: sb-* ────────────│
   │                         │                           │
   │── GET /dashboard ───────▶│                           │
   │                         │── getSession() ───────────▶│
   │                         │◀── session=<valid> ────────│
   │◀── 200 Dashboard ────────│                           │
```

### Archivos involucrados

| Archivo                          | Rol                                                          |
|----------------------------------|--------------------------------------------------------------|
| `src/middleware.ts`              | Intercepta TODAS las rutas, verifica sesión via cookies      |
| `src/lib/supabase-server.ts`     | Cliente Supabase para Server Components (usa `next/headers`) |
| `src/lib/supabase-browser.ts`    | Cliente Supabase para Client Components (`@supabase/ssr`)    |
| `src/app/login/page.tsx`         | Formulario de login (solo email + password)                  |
| `src/components/Sidebar.tsx`     | Botón de logout — llama `supabase.auth.signOut()`            |
| `src/lib/supabase.ts`            | Cliente de **datos**; en browser lee la sesión de cookies    |
| `src/lib/supabase-admin.ts`      | Cliente **service-role**, SOLO servidor (crons)              |

> ⚠️ Ver [§11 RLS y Clientes Supabase](#11-rls-y-clientes-supabase): elegir el cliente
> equivocado es la causa raíz del error `42501` en todas las escrituras.

### Reglas del Middleware

```typescript
// src/middleware.ts — lógica de routing
if (!session && !isLoginPage)  → redirect('/login?redirectTo=<pathname>')
if (session && isLoginPage)    → redirect('/')
// else: pass through con cookie refreshed
```

### Gestión de cookies (`@supabase/ssr`)

`@supabase/ssr` almacena la sesión en cookies HTTP (no localStorage), lo que permite:
- Lectura en Server Components y middleware (Edge Runtime)
- Refresh automático del token sin intervención del usuario
- Logout efectivo al limpiar la cookie desde el servidor

### Alta de usuarios

No existe registro público. Para crear un nuevo usuario:
1. Ir al Supabase Dashboard → Authentication → Users → Invite User
2. O usar la Supabase Management API con la service role key

---

## 3. Motor de Informes

### Pipeline de generación (v2.1)

```
Rango de fechas (inicio, fin)
         │
         ▼
fetchLlamadasByRange()         ← llamadas.service.ts
         │
         ▼
calcularKPIs()                 ← lib/kpi.ts
         │
         ├── total, entrantes, salientes
         ├── atendidas (franja comercial)
         ├── eficiencia (%)
         └── perdidasComerciales
         │
         ▼
calcularFugasPorFranja()       ← lib/kpi.ts
         │
         ├── 07–10 hs: perdidas / total / porcentaje
         ├── 10–13 hs: perdidas / total / porcentaje
         ├── 13–16 hs: perdidas / total / porcentaje
         └── 16–19 hs: perdidas / total / porcentaje
         │
         ▼
generarResumenEjecutivo()      ← lib/kpi.ts
         │
         ├── Texto narrativo estructurado
         ├── Análisis condicional (eficiencia >= 60% → OK / ALERTA)
         └── Franja crítica identificada
         │
         ▼
insertReporte()                ← reportes.service.ts
         │
         └── reportes_generados: { titulo, rango, metricas{...franjas}, resumen, tipo }
```

### Estructura JSONB de `metricas`

```json
{
  "total": 342,
  "entrantes": 218,
  "salientes": 124,
  "atendidas": 290,
  "eficiencia": 84,
  "franjas": [
    { "label": "07–10 hs", "inicio": 7,  "fin": 10, "perdidas": 8,  "total": 62, "porcentaje": 13 },
    { "label": "10–13 hs", "inicio": 10, "fin": 13, "perdidas": 15, "total": 98, "porcentaje": 15 },
    { "label": "13–16 hs", "inicio": 13, "fin": 16, "perdidas": 22, "total": 97, "porcentaje": 23 },
    { "label": "16–19 hs", "inicio": 16, "fin": 19, "perdidas": 7,  "total": 85, "porcentaje": 8  }
  ]
}
```

> **Nota:** El campo `franjas` es opcional (backwards-compatible). Reportes anteriores a v2.1 no lo tendrán.

### Umbral de eficiencia

Definido en `src/lib/kpi.ts`:
```typescript
export const UMBRAL_EFICIENCIA = 60 // %
```
- ≥ 60% → Estado Óptimo (texto en resumen + celda verde en PDF)
- < 60% → ALERTA (texto rojo + recomendación de revisión)

---

## 4. Capa de Servicios

### `llamadas.service.ts`

| Función                  | Parámetros                   | Descripción                                           |
|--------------------------|------------------------------|-------------------------------------------------------|
| `fetchLlamadas`          | `FiltroLlamadas`             | Dashboard: 200 rows, filtrado por período             |
| `fetchLlamadaById`       | `id: string`                 | Realtime: hidrata el evento de cambio con join        |
| `fetchLlamadasByRange`   | `inicio, fin: string`        | Informes: sin límite, rango cerrado                   |
| `fetchTodasLasLlamadas`  | —                            | Analytics: carga completa (no realtime)               |

### `alias.service.ts`

| Función          | Descripción                                          |
|------------------|------------------------------------------------------|
| `fetchAliasMap`  | Fetch todos los alias → AliasMap (Record<id, alias>) |
| `buildAliasMap`  | Función pura: DispositivoAlias[] → AliasMap          |
| `upsertAlias`    | Crea o actualiza un alias por dispositivo_id         |

**Patrón clave:** El AliasMap se carga una vez por componente y se aplica en cliente para resolución de `dispositivo_id → nombre`. Esto evita un JOIN pesado en la query de llamadas, que está bajo suscripción Realtime.

### `reportes.service.ts`

| Función          | Descripción                                      |
|------------------|--------------------------------------------------|
| `fetchReportes`  | Lista todos los informes, más reciente primero   |
| `insertReporte`  | Persiste un nuevo informe (MANUAL o AUTOMATICO)  |
| `deleteReporte`  | Elimina un informe por ID (hard delete)          |

---

## 5. Lógica de Negocio (KPI Engine)

### Regla de horario comercial

```typescript
// src/lib/kpi.ts
const HORA_INICIO_COMERCIAL = 7   // 07:00 (inclusive)
const HORA_FIN_COMERCIAL    = 19  // 19:00 (exclusive)

function isHorarioComercial(fecha: string): boolean {
  return new Date(fecha).getHours() >= 7 && new Date(fecha).getHours() < 19
}
```

**¿Por qué?** Crucianelli audita la eficiencia únicamente durante el horario comercial. Una llamada perdida a las 23hs no penaliza el ratio.

### Algoritmo de eficiencia

```
Eficiencia = (atendidas_en_ventana_auditada / total_en_ventana_auditada) × 100

Ventana auditada incluye:
  ✓ Todas las llamadas entre 07–19hs (atendidas Y perdidas)
  ✓ Llamadas fuera de horario que SÍ fueron atendidas
  ✗ Llamadas fuera de horario que NO fueron atendidas (no se penalizan)
```

### Franjas de análisis

Las 4 franjas de 3 horas dentro del horario comercial:

| Franja   | Horas    | Contexto típico          |
|----------|----------|--------------------------|
| 07–10 hs | Mañana   | Apertura, llamadas urgentes |
| 10–13 hs | Media mañana | Pico de actividad     |
| 13–16 hs | Tarde    | Post-almuerzo, posible bajón |
| 16–19 hs | Tarde tardía | Cierre, última oportunidad |

---

## 6. Realtime & Dashboard

### Arquitectura del Dashboard

```
useEffect (mount)
    │
    ├── cargarDatos()
    │     ├── fetchLlamadas(filtro)     → rows[]
    │     └── fetchAliasMap()           → Record<id, alias>
    │
    └── supabase.channel('dashboard-realtime')
          .on('postgres_changes', { event: '*', table: 'llamadas' }, handler)
          .subscribe()

handler(payload):
    changedId = payload.new?.id ?? payload.old?.id
    fullRow   = await fetchLlamadaById(changedId)  // re-fetch con JOIN
    setLlamadasRaw(prev => upsert(prev, fullRow))
```

### Por qué re-fetchar en el handler

El evento de Postgres Change sólo incluye los campos de la fila modificada, no las relaciones. Para mostrar el nombre del concesionario (`concesionarios.nombre`), se hace un fetch completo de la fila por ID. Esta es la práctica recomendada por Supabase para realtime con joins.

### Filtrado cliente vs servidor

| Filtro              | Donde se aplica       | Justificación                                   |
|---------------------|-----------------------|--------------------------------------------------|
| Rango de fechas      | Servidor (Supabase)   | Reduce payload — hasta 200 rows por fetch        |
| `filtroDispositivo`  | Cliente (useMemo)     | Evita re-fetch en cambio de dispositivo; O(n)    |
| Cálculo de KPIs      | Cliente (useMemo)     | Reactivo a filtroDispositivo sin roundtrip       |

---

## 7. PDF Engine

### Estructura del PDF generado

```
┌──────────────────────────────────────────┐
│  ████████ CRUCI-TRACK  ████████████████  │ ← Header #DC2626
│  AUDITORÍA DE TELEMETRÍA · CRUCIANELLI   │
│  CLASIFICACIÓN: CONFIDENCIAL    EMITIDO  │
├──────────────────────────────────────────┤
│  TITULO DEL REPORTE                      │ ← Metadata
│  PERÍODO: DD/MM — DD/MM  TIPO: MANUAL    │
├──────────────────────────────────────────┤
│  MÉTRICA              │  VALOR           │ ← KPI Table (autoTable)
│  Total Interacciones  │  342             │
│  ...                  │  ...             │
├──────────────────────────────────────────┤
│  COMPARATIVA: ATENDIDAS vs PERDIDAS      │ ← Visual bars
│  ATENDIDAS  ████████████████████  290    │
│  PERDIDAS   ████                   52    │
├──────────────────────────────────────────┤
│  ANÁLISIS POR FRANJA HORARIA             │ ← Heatmap (if v2.1+)
│  [07-10] [10-13] [13-16] [16-19]        │
│   13%     15%     23%     8%             │
├──────────────────────────────────────────┤
│  RESUMEN EJECUTIVO Y AUDITORÍA           │ ← Texto narrativo
│  ...                                     │
├──────────────────────────────────────────┤
│  REPORT-ID: xxxx · INTEGRIDAD: yyyy      │ ← Footer / Firma digital
└──────────────────────────────────────────┘
```

### Dependencias

- `jspdf` (^4.2.0) — Generación de PDF en browser, sin canvas
- `jspdf-autotable` (^5.0.7) — Tablas con headers, alternating rows

---

## 8. Automatización (pg_cron)

### Setup

1. Habilitar extensión en Supabase Dashboard:
   `Database → Extensions → pg_cron → Enable`

2. Ejecutar en SQL Editor:
```sql
select cron.schedule(
  'weekly-crucitrack-report',
  '0 22 * * 5',   -- Viernes 22:00 UTC = 19:00hs ART (UTC-3)
  $$ select public.generar_informe_semanal_automatico(); $$
);
```

3. Verificar jobs activos:
```sql
select * from cron.job;
```

### Función SQL (`generar_informe_semanal_automatico`)

Calcula KPIs de los últimos 7 días e inserta en `reportes_generados` con:
- `tipo = 'AUTOMATICO'`
- `metricas` con `total, entrantes, salientes, atendidas, eficiencia`
- `resumen_escrito` con el análisis narrativo

El script SQL completo está en: `supabase/migrations/0001_weekly_report_cron.sql`

---

## 9. Guía de Onboarding

### Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=https://luohkbuyzxcgtbuehjup.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Comandos de desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Type-check sin compilar
npx tsc --noEmit

# Build de producción
npm run build

# Regenerar tipos de Supabase (tras cambios de esquema)
npx supabase gen types typescript --project-id luohkbuyzxcgtbuehjup > src/types/supabase.ts
```

### Alta de primer usuario

```bash
# Opción 1: Supabase Dashboard
# Authentication → Users → Invite User → email@crucianelli.com

# Opción 2: CLI
npx supabase auth admin create-user --email admin@crucianelli.com --password "SecurePass123!"
```

### Estructura de archivos clave

```
src/
├── app/
│   ├── layout.tsx              # Root layout (AppShell)
│   ├── login/page.tsx          # Login page (sin sidebar)
│   ├── page.tsx                # Dashboard (Realtime)
│   ├── analitica/page.tsx      # BI Analytics
│   ├── informes/page.tsx       # Centro de Informes
│   ├── dispositivos/page.tsx   # Gestión de terminales
│   └── concesionarios/         # CRUD concesionarios
├── components/
│   ├── AppShell.tsx            # Layout condicional (sidebar/login)
│   ├── Sidebar.tsx             # Nav + logout
│   ├── ErrorBoundary.tsx       # Error boundary
│   ├── ModalVincular.tsx       # Vincular teléfono a concesionario
│   ├── ModalEditarConcesionario.tsx
│   └── ui/SkeletonCard.tsx     # Skeleton loaders
├── hooks/
│   └── useAliasMap.ts          # Hook: device alias map
├── lib/
│   ├── supabase.ts             # Client data (no auth)
│   ├── supabase-server.ts      # Server auth client
│   ├── supabase-browser.ts     # Browser auth client
│   ├── kpi.ts                  # Business logic engine
│   └── pdf.ts                  # PDF generation
├── services/
│   ├── llamadas.service.ts
│   ├── alias.service.ts
│   └── reportes.service.ts
└── types/
    ├── supabase.ts             # Auto-generated DB types
    └── domain.ts               # Business domain types
```

---

## 10. FAQ & Troubleshooting

### ¿Por qué hay dos clientes de Supabase?

| Cliente                   | Archivo                    | Usa                  | Para                              |
|---------------------------|----------------------------|----------------------|-----------------------------------|
| Data client               | `src/lib/supabase.ts`      | `@supabase/supabase-js` | Queries de datos (no auth)     |
| Auth browser client       | `src/lib/supabase-browser.ts` | `@supabase/ssr`    | signIn, signOut en client side    |
| Auth server client        | `src/lib/supabase-server.ts`  | `@supabase/ssr`    | Leer sesión en Server Components  |

El data client tiene `persistSession: false` para no interferir con el auth client.

### La sesión expira aunque el usuario está activo

El middleware llama `supabase.auth.getSession()` en cada request, lo que automáticamente refresca el token si está cerca de expirar. Verifica que el `config.matcher` del middleware incluya la ruta que está fallando.

### Las llamadas en el Dashboard no se actualizan en tiempo real

1. Verificar en Supabase Dashboard → Database → Replication que `llamadas` tenga Realtime habilitado.
2. El canal se llama `dashboard-realtime` — asegurarse de que no haya otro cliente con el mismo nombre.
3. El handler re-fetcha por ID; si el error está en el join de concesionarios, verificar la FK.

### El PDF se genera vacío o sin franjas

Los reportes creados antes de v2.1 no tienen `metricas.franjas`. El PDF lo maneja con `if (franjas && franjas.length > 0)`. Para actualizar un reporte antiguo, regenerarlo manualmente.

### ¿Cómo agregar un nuevo dispositivo/terminal?

Los dispositivos se agregan automáticamente cuando insertan su primera llamada en la tabla `llamadas` con su `dispositivo_id`. Luego en `/dispositivos` se puede asignar un alias humano.

### Error `cookies() was called outside a request scope`

Este error ocurre si se llama `createSupabaseServerClient()` fuera de un Server Component o Route Handler. En middleware, usar siempre `request.cookies` directamente (ver `src/middleware.ts`).

---

*Documentación generada por el equipo de ingeniería de Cruci-Track.*
*Para actualizaciones o correcciones, abrir un issue en el repositorio.*

---

## 11. RLS y Clientes Supabase

> Añadido 2026-08-26 a raíz del bug "Error al procesar la vinculación".

### El problema que resuelve

Todas las tablas tienen RLS activo con políticas de **SELECT abiertas a `anon`** pero
**INSERT/UPDATE restringidas**. Si una query sale con el rol `anon`, las lecturas
funcionan y las escrituras fallan con:

```
401 {"code":"42501","message":"new row violates row-level security policy for table \"<tabla>\""}
```

Es un error engañoso: la pantalla carga bien (lecturas OK) y solo revienta al guardar.

Confirmado empíricamente el 2026-08-26 sobre el proyecto `luohkbuyzxcgtbuehjup`:
`concesionario_telefonos`, `concesionarios`, `dispositivo_alias` y `reportes_generados`
devuelven las cuatro `42501` en INSERT como `anon`.

### Los tres clientes

| Cliente | Archivo | Rol efectivo | Cuándo usarlo |
|---------|---------|--------------|---------------|
| **Datos (browser)** | `src/lib/supabase.ts` | `authenticated` | Todo el UI. Usa `createBrowserClient` de `@supabase/ssr`, que lee la sesión de las cookies del login. |
| **Auth** | `src/lib/supabase-browser.ts` | `authenticated` | Solo flujos de auth: `signIn`, `signOut`, `getUser`. |
| **Service role** | `src/lib/supabase-admin.ts` | bypass de RLS | Solo servidor sin sesión: route handlers de cron. **Nunca** importar desde un Client Component. |

`src/lib/supabase.ts` hace un switch por entorno: en el browser devuelve
`createBrowserClient` (sesión en cookies); en el servidor cae al cliente `anon` plano,
porque `createBrowserClient` depende de `document.cookie` y los route handlers lo
importan de forma transitiva vía la capa de servicios.

### Regla para la capa de servicios

Las funciones que los crons reutilizan aceptan un cliente opcional como último
parámetro, con default al compartido:

```typescript
export async function insertReporte(
  payload: ReporteInsert,
  client: Client = supabase   // los crons pasan getSupabaseAdmin()
): Promise<void>
```

Aplicado hoy en `insertReporte()` y `fetchLlamadasByRange()`. Si mañana otro cron
necesita una función de servicio, seguir el mismo patrón en vez de duplicar queries.

### Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=...        # público
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # público
SUPABASE_SERVICE_ROLE_KEY=...       # SECRETO — sin prefijo NEXT_PUBLIC_
```

`SUPABASE_SERVICE_ROLE_KEY` hace bypass total de RLS. El prefijo `NEXT_PUBLIC_` la
inyectaría en el bundle del cliente y quedaría expuesta a cualquier visitante.
Debe estar cargada tanto en `.env.local` como en las env vars de Vercel
(Production + Preview), o los crons fallan con un error explícito de key faltante.

Para verificar que no se filtró al bundle tras un build:

```bash
grep -rl "SUPABASE_SERVICE_ROLE_KEY\|supabase-admin" .next/static   # debe salir vacío
```

### Cómo diagnosticar un 42501

```bash
# Reproduce un INSERT como anon SIN escribir nada (FK inexistente → falla igual)
curl -s -X POST "$URL/rest/v1/<tabla>" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '[{"<fk>":"00000000-0000-0000-0000-000000000000"}]'
```

- `42501` → RLS. El cliente sale como `anon`, o la policy de INSERT no existe.
- `23503` (FK violation) → RLS pasó; el problema es otro.

---
