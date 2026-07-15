# 📘 Documentación Técnica — Ágora Plus SaaS v6.0

> **Última actualización:** 15 de julio de 2026  
> **Versión:** 6.0 — Server-Side API Architecture  
> **Dominio:** [agora-lexlatin.com](https://agora-lexlatin.com)  
> **Repositorio:** [github.com/mov1datc1/agora_saas_plus](https://github.com/mov1datc1/agora_saas_plus)

---

## 1. Arquitectura General de la Plataforma

Ágora Plus es una plataforma SaaS B2B de inteligencia transaccional para el mercado legal latinoamericano. Ingesta datos desde el CMS Drupal de LexLatin, los clasifica mediante un motor de 5 fases, y los expone a través de APIs REST server-side optimizadas para alta concurrencia.

![Arquitectura General de Ágora Plus](docs/architecture_v6.png)

### 1.1 Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.2.9 |
| **UI** | React | 19.2.4 |
| **Estilos** | Tailwind CSS v4 + Framer Motion | — |
| **ORM** | Prisma + @prisma/adapter-pg | 7.8.0 |
| **Base de Datos** | PostgreSQL (Supabase) | 15.x |
| **Autenticación** | Supabase Auth (@supabase/ssr) | — |
| **Gráficos** | Recharts + react-simple-maps + d3-scale | 3.8.1 |
| **IA** | Vercel AI SDK + OpenAI GPT-4o-mini | 3.x |
| **Pagos** | Stripe (Webhooks + Checkout) | — |
| **Email** | Resend + React Email | — |
| **Hosting** | Vercel (Serverless + Edge) | Pro |
| **Data Source** | Drupal JSON:API (LexLatin CMS) | — |

### 1.2 Flujo de Despliegue (Git → Producción)

```
dev branch → Pull Request → main branch → Vercel Auto-Deploy → agora-lexlatin.com
```

- **`dev`**: Entorno de desarrollo y pruebas
- **`main`**: Producción (auto-deploy en Vercel)
- Push a ambas ramas en cada release

---

## 2. Pipeline ETL: Sincronización Drupal → Supabase

El corazón de la plataforma es el pipeline ETL que extrae transacciones del CMS Drupal de LexLatin y las transforma usando un motor de clasificación de 5 fases.

![Pipeline ETL de Ágora Plus](docs/etl_pipeline_v6.png)

### 2.1 Cron Job de Sincronización

| Parámetro | Valor |
|-----------|-------|
| **Endpoint** | `POST /api/sync-drupal` |
| **Frecuencia** | Diaria: `0 9 * * *` (9:00 AM UTC = 3:00 AM CST México) |
| **Configuración** | `vercel.json` → `crons[]` |
| **Autenticación** | `Bearer CRON_SECRET` (env var) |
| **Batch Size** | 5 posts por ejecución (límite PHP de Cloudways) |
| **Orden** | `sort=-created` (más recientes primero) |
| **Modo** | `UPSERT` — actualiza existentes, crea nuevos |

### 2.2 Motor de Clasificación de 5 Fases

Cada transacción pasa por un pipeline determinístico que clasifica el tipo de operación:

| Fase | Nombre | Lógica | Prioridad |
|------|--------|--------|-----------|
| **0** | Noise Filter | Rechaza noticias corporativas/legales que no son transacciones | Máxima |
| **1** | Determinístico | Mapea `field_ae` (Áreas de práctica) → `M&A`, `Emisiones`, `Financiamientos` | Alta |
| **2** | Heurístico | 100+ keywords con peso (título 2x) → scoring por familia | Media |
| **3** | Role-based | Confirma tipo por roles de empresas (Adquirente, Emisor, etc.) | Media |
| **4** | Strict Fallback | Requiere `score >= 3` para clasificar; si no → `Operación General` | Baja |

**Mapeo Determinístico (Phase 1):**
```
"corporativo - adquisiciones"        → M&A
"corporativo - fusiones"             → M&A
"banca y finanzas"                   → Financiamientos
"mercado de capitales - emisiones"   → Emisiones
```

**Override Manual:** El campo `typeOverride` en la tabla `Transaction` persiste a través de re-sincronizaciones.

### 2.3 Clasificación de Industrias

Si Drupal no provee industria (`field_industrias_asociadas`), se aplica un clasificador de industrias por keywords (16 clusters: Energía, Banca, Informática, Salud, etc.) con ponderación por frecuencia en título vs. cuerpo del artículo.

### 2.4 Segundo Cron: Suscripciones

| Parámetro | Valor |
|-----------|-------|
| **Endpoint** | `GET /api/cron/check-subscriptions` |
| **Frecuencia** | Diaria: `0 8 * * *` (8:00 AM UTC) |
| **Función** | Expira trials vencidos, actualiza estados de suscripción |

---

## 3. Modelo de Datos (Prisma Schema)

```
┌──────────────────────────────────────────────────────────────────┐
│                        Transaction                               │
│  id (UUID, PK)  │  title  │  type  │  value (Decimal)           │
│  country  │  industryId (FK)  │  dateAnnounced  │  dateClosed   │
│  practiceArea  │  typeOverride  │  isPublished  │  link         │
├──────────────────────────────────────────────────────────────────┤
│  ↓ advisors[]          ↓ companies[]         ↓ lawyers[]        │
│  TransactionAdvisor    TransactionCompany     TransactionLawyer  │
│  (firmId, role)        (companyId, role)      (lawyerId, role)   │
└──────────────────────────────────────────────────────────────────┘
         ↓                     ↓                      ↓
    ┌─────────┐          ┌──────────┐           ┌──────────┐
    │  Firm   │          │ Company  │           │  Lawyer  │
    │ id,name │          │ id,name  │           │ id,name  │
    └─────────┘          └──────────┘           └──────────┘

┌───────────────┐     ┌────────────────┐     ┌───────────────┐
│   Industry    │     │      User      │     │ Subscription  │
│ id, name      │     │ id, email, role│     │ status, stripe│
│ transactions[]│     │ accountType    │     │ trialEndsAt   │
└───────────────┘     └────────────────┘     └───────────────┘
```

**Relaciones clave:**
- `Transaction` → `Industry` (FK: `industryId`)
- `Transaction` ↔ `Firm` (bridge: `TransactionAdvisor`, compound key: `transactionId_firmId_role`)
- `Transaction` ↔ `Company` (bridge: `TransactionCompany`, compound key)
- `Transaction` ↔ `Lawyer` (bridge: `TransactionLawyer`, compound key)
- `User` → `Subscription` (1:1)
- `User` → `User` (self-relation: Corporate teams via `parentId`)

---

## 4. Arquitectura de APIs Server-Side (v6.0)

La versión 6.0 migró toda la lógica de procesamiento y agregación del cliente al servidor, eliminando payloads de 5MB+ y reduciendo tiempos de carga de ~7s a <1s.

![API Architecture v6.0](docs/api_architecture_v6.png)

### 4.1 Contrato de Respuesta Unificado

Todas las APIs de métricas siguen el mismo contrato JSON:

```json
{
  "data": [{ /* paginated rows */ }],
  "metadata": {
    "page": 1,
    "limit": 50,
    "totalCount": 2157,
    "totalPages": 44
  },
  "stats": { /* KPI aggregations */ },
  "ranking": [{ /* top N for sidebar cards */ }]
}
```

### 4.2 Referencia Completa de Endpoints

#### `GET /api/operations`
Tabla principal de operaciones con paginación server-side.

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | int | 1 | Página actual |
| `limit` | int | 50 | Items por página |
| `type` | string | — | `M&A`, `Emisiones`, `Financiamientos` |
| `country` | string | — | Filtro por país (contains) |
| `search` | string | — | Búsqueda en título (insensitive) |
| `dateStart` | date | — | Fecha inicio (`YYYY-MM-DD`) |
| `dateEnd` | date | — | Fecha fin (`YYYY-MM-DD`) |
| `amountMin` | number | — | Monto mínimo USD |
| `amountMax` | number | — | Monto máximo USD |
| `firmId` | string | — | Filtro por firma asesora |
| `industryId` | string | — | Filtro por industria |
| `sort` | string | dateDesc | Ordenamiento |

#### `GET /api/operations/filters`
Opciones para dropdowns (cached 5min con `Cache-Control`).

**Response:** `{ types[], countries[], firms[], industries[] }`

#### `GET /api/metrics/firms`
Ranking de firmas asesoras con stats agregadas.

| Param | Tipo | Descripción |
|-------|------|-------------|
| `type` | string | Filtro por tipo de operación |
| `country` | string | Filtro por país |
| `search` | string | Búsqueda en nombre de firma |
| `dateStart/dateEnd` | date | Rango de fechas |

**Stats:** `{ totalValue, totalFirms }`

#### `GET /api/metrics/industries`
Agrupación por industria con volumen y conteo.

| Param | Tipo | Descripción |
|-------|------|-------------|
| `type` | string | Filtro por tipo |
| `country` | string | Filtro por país |
| `search` | string | Búsqueda en nombre de industria |

**Stats:** `{ totalValue, totalIndustries }`  
**Extra:** `countries[]` — lista de países para dropdown

#### `GET /api/metrics/countries`
Agrupación geográfica con mapa interactivo.

| Param | Tipo | Descripción |
|-------|------|-------------|
| `type` | string | Filtro por tipo |
| `search` | string | Búsqueda por nombre de país |
| `dateStart/dateEnd` | date | Rango de fechas |

**Stats:** `{ totalValue, totalCountries }`

### 4.3 Patrón de Consumo en Frontend

```tsx
// 1. Build dynamic URL from filters
const apiUrl = useMemo(() => {
  const p = new URLSearchParams()
  p.set('page', String(currentPage))
  p.set('limit', '50')
  if (filterType !== 'Todas') p.set('type', filterType)
  if (debouncedSearch) p.set('search', debouncedSearch)
  return `/api/metrics/firms?${p.toString()}`
}, [currentPage, filterType, debouncedSearch])

// 2. SWR with keepPreviousData for instant UX
const { data } = useSWR(apiUrl, fetcher, { keepPreviousData: true })

// 3. Consume server-aggregated data directly
const tableData = data?.data || []
const totalCount = data?.metadata?.totalCount || 0
const ranking = data?.ranking || []
```

**Key patterns:**
- `useDebounce(searchQuery, 400)` — evita API thrashing
- `useSWR` con `keepPreviousData` — smooth transitions
- `useMemo` para URL — solo re-fetches cuando cambian filtros

---

## 5. Dashboard Global

### 5.1 KPI Cards (Server-Side)

Las 4 cards del dashboard principal ejecutan queries `COUNT` directamente en PostgreSQL con filtro de fecha `≤ hoy`:

```sql
-- Solo transacciones clasificadas con fecha válida
WHERE type IN ('M&A', 'Emisiones', 'Financiamientos')
  AND dateAnnounced >= '1990-01-01'
  AND dateAnnounced <= NOW()
```

| Card | Query |
|------|-------|
| Operaciones Registradas | `transaction.count(where: txWhere)` |
| Firmas Participantes | `firm.count(where: { transactions: { some: { transaction: txWhere } } })` |
| Empresas Participantes | `company.count(...)` |
| Abogados Participantes | `lawyer.count(...)` |

### 5.2 Gráfico Volumen Transaccional Histórico

- Agrupa por mes/año usando `dateAnnounced`
- Filtra `dateAnnounced ≤ hoy` para excluir datos de staging/futuro
- Excluye `Operación General` del conteo

### 5.3 Top Industrias Activas

- Horizontal bar chart por conteo de deals
- Excluye `Operación General`

---

## 6. Sistema RBAC y Suscripciones

### 6.1 Roles

| Rol | Permisos |
|-----|---------|
| `USER` | Dashboard, Operaciones (con paywall), Copilot (limitado) |
| `ADMIN` | Todo + Panel Admin (ver/editar usuarios) |
| `SUPERADMIN` | Todo + Config SMTP, System Config, Eliminar usuarios |

### 6.2 Account Types

| Tipo | Descripción |
|------|-------------|
| `INDIVIDUAL` | Cuenta personal (1 usuario) |
| `CORPORATE` | Cuenta empresa (team management via `parentId`) |

### 6.3 Restricciones de Trial

- **Consultas diarias:** Limitadas por `DailyUsage` table
- **Descargas Excel:** Solo con suscripción activa
- **Copilot AI:** Queries mensuales limitadas por `CopilotUsage`

---

## 7. Módulos de la Plataforma

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard Global | `/dashboard` | KPIs, gráfico histórico, top industrias |
| Operaciones | `/dashboard/operations` | Tabla de deals con filtros avanzados |
| Firmas Asesoras | `/dashboard/metrics/firms` | Ranking y stats de firmas |
| Industrias | `/dashboard/metrics/industries` | Distribución sectorial |
| Jurisdicciones | `/dashboard/metrics/countries` | Mapa geográfico interactivo |
| Ágora Copilot | `/dashboard/copilot` | Asistente IA para consultas |
| Suscripción | `/dashboard/subscription` | Stripe Checkout + gestión |
| Administración | `/dashboard/admin` | CRUD de usuarios (ADMIN+) |
| Config SMTP | `/dashboard/smtp-config` | Plantillas email (SUPERADMIN) |

---

## 8. Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx

# Drupal ETL
DRUPAL_API_URL=https://lexlatin.com/jsonapi
DRUPAL_API_USER=agora_api_user
DRUPAL_API_PASS=xxxxx

# AI & Email
OPENAI_API_KEY=sk-xxx
RESEND_API_KEY=re_xxx

# Cron Security
CRON_SECRET=xxxxx
```

---

## 9. Historial de Versiones

| Versión | Fecha | Cambios Principales |
|---------|-------|---------------------|
| **v6.0** | Jul 15, 2026 | Server-side API architecture, SWR migration, date boundary filters, mobile-ready APIs |
| **v5.0** | Jul 14, 2026 | Motor de clasificación 5 fases, filtro ruido editorial, industry classifier |
| **v4.0** | Jul 10, 2026 | ETL re-sync completo, Google Tag Manager, dashboard fixes |
| **v3.0** | Jul 8, 2026 | Resend email integration, Stripe checkout fix, CRM dashboard |
| **v2.0** | Jun 30, 2026 | Operations module, Analytics charts, Recharts integration |
| **v1.0** | Jun 2026 | Initial SaaS launch, Auth, basic dashboard |

---

> **Documento generado automáticamente.** Para preguntas técnicas, contactar al equipo de desarrollo.
