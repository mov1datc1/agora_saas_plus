# Changelog — Ágora Plus SaaS

Todas las versiones notables del proyecto Ágora Plus están documentadas aquí.

---

## [5.2.0] — 2026-09-03 🧹 Sincronización Destructiva y Purga de Nodos Eliminados / 'None'

### 🐛 Fixed
- **Notas eliminadas en Drupal persistían en Ágora (Nodos 404)** — Los nodos eliminados en Drupal (ej. 132999 Mercado Pago, 133004 Chubut, 133243 Banco Provincia Buenos Aires, 133487 Banco Comafi) dejaban de ser devueltos por la API REST de Drupal. Ágora solo realizaba `upsert`, por lo que nunca los eliminaba de Supabase.
- **Notas principales con `None` aparecían indebidamente** — En operaciones múltiples consolidadas con clones, la nota principal tiene `field_tipo_de_noticia = null` (`- None -`). `sync-drupal/route.ts` saltaba el post pero nunca lo borraba si ya existía en la BD. En `mysql-sync/route.ts` y `scripts/sync-mysql-hybrid.js`, la condición `if (p.tipo && p.tipo !== 'Transacción')` evaluaba `null` como falso e importaba los registros.

### ✨ Added
- **Sincronización destructiva activa en `sync-drupal/route.ts`**: Cuando un post viene en `None`, sin evidencia transaccional, o como portal original (2+ áreas), se elimina automáticamente en cascada de Ágora si ya existía.
- **Herramienta de Purga en UI (`MassiveSyncClient.tsx`) y Server Action (`sync-actions.ts`)**: Botón *"Purgar Eliminadas/None"* en Configuración Admin para limpiar notas eliminadas en Drupal y notas en `None`.
- **Script autónomo de mantenimiento (`scripts/purge-deleted-and-none.ts`)**: Depuración directa y segura de registros obsoletos y huérfanos.

### 📊 Resultados de la Purga
- 68 transacciones obsoletas / eliminadas removidas de la base de datos de producción.
- 177 relaciones de asesores, 486 de abogados y 254 de empresas eliminadas en cascada.
- Clones legítimos con montos específicos (ej. 134459, 134460, 134461) preservados intactos.

---

## [5.1.0] — 2026-08-05 🏢 Companies Fix

### 🐛 Fixed
- **Companies endpoint returning empty arrays** — Root cause: Drupal's `loadCompaniesWithRoles()` had LEFT JOINs to `paragraph__field_rol_arrendamientos` which **doesn't exist** in the database. The `SQLSTATE[42S02]` error was caught silently by try/catch → returned `[]` for all companies.
- Fixed by Drupal team (Editorial Group) removing non-existent table references from `$roleTables` array and the COALESCE role resolution.

### 📊 Post-Fix Verification
| Metric | Value |
|---|---|
| Transacciones totales | 18,751 |
| Empresas únicas | 46,924 |
| Links transacción↔empresa | 66,742 |
| Cobertura | **91%** (17,129/18,751) |
| Top empresa | Banco Itaú BBA S.A. (966 tx) |

### 📋 Top Roles
- Colocador/Estructurador: 10,974
- Comprador: 9,236
- Emisor: 7,102
- Prestamista: 6,576
- Vendedor: 6,496
- Target: 5,710

### 📝 Documentation
- Created `FIX_EMPRESAS_DRUPAL_v2.md` — technical spec for Drupal team
- Created `MENSAJE_DRUPAL_FIX_EMPRESAS.md` — communication doc
- Created `FIX_FINAL_EMPRESAS.md` — root cause and resolution
- Documented Drupal 3-tier paragraph schema: Node → Paragraph → Company Node
- Mapped all role tables: `paragraph__field_rol_fusiones_y_adquisicion`, `paragraph__field_rol_em`, `paragraph__field_rol_financiamiento`, `paragraph__field_tipo_de_operacion`

### ⚠️ Known Issue
- `paragraph__field_rol_arrendamientos` — Still referenced in some Drupal watchdog logs. Drupal team should clean up the reference to prevent log noise.

---

## [5.0.0] — 2026-07-21 🔄 Custom REST API Migration

### Added
- Custom Drupal REST API module (`agora_api`) at `/api/agora/transactions`
- Token auth via `X-Agora-Token` header (replaces Basic Auth)
- Pre-joined data with all relationships resolved (firms, lawyers, companies, monetary)
- CronLog audit system with date-filterable admin panel
- Repair Excerpts fast-path tool (200 records/call)
- MassiveSyncClient with offset tracking and retry logic

### Changed
- Migrated from Drupal JSON:API to Custom REST API
- HTML-preserving body rendering with sanitized tags
- UTC date boundary fix across all metrics APIs
- MassiveSyncClient offset counter fix (was inflating 10:1)

### Removed
- JSON:API includes parsing
- Basic Auth credential management
- PHP Proxy (`agora-bulk-export.php`) — deprecated, returns 404

---

## [4.1.0] — 2026-06-26 🔐 RBAC v4.1

### Added
- SUPERADMIN role (3-tier: USER/ADMIN/SUPERADMIN)
- B2B account types (INDIVIDUAL/CORPORATE)
- Admin Control Panel with conditional rendering
- Server Action role protections

---

## [4.0.0] — 2026-06-22 🚀 Enterprise SaaS Launch

### Added
- Stripe Billing with subscription management
- Agentic AI Copilot (Vercel AI SDK + OpenAI)
- Resend transactional emails
- Operations and Analytics modules (Recharts, React Simple Maps)
- Excel export for Operations (SaaS users)
- Marketing tracking (GA4 + Meta Pixel)
