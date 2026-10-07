# Changelog — Ágora Plus SaaS

Todas las versiones notables del proyecto Ágora Plus están documentadas aquí.

## [5.3.0] — 2026-10-07 💳 Stripe Webhooks & Ciclo Completo de Correos Transaccionales (Resend)

### 🐛 Fixed & Diagnosed
- **Stripe Webhook Inactivo en Producción** — El destino de webhook `agora-produccion` (`https://www.agora-lexlatin.com/api/webhook`) en la cuenta Stripe de LexLatin (`acct_1NvmaWA8zDaMc9Ma`) estaba marcado como *Deshabilitado*. La URL sin `www.` devolvía `HTTP 308` (redirección no soportada por Stripe). Se habilitó el webhook con `www.` y se actualizó `STRIPE_WEBHOOK_SECRET` en Vercel.
- **Supabase Auth Redirect URL Desfasado** — La configuración de Supabase Auth tenía `Site URL = https://agora-saas-plus.vercel.app`, lo que causaba redirecciones fallidas y error `otp_expired`. Se actualizó el Site URL a `https://www.agora-lexlatin.com` y se agregaron las URLs permitidas en Redirect URLs.
- **Doble soporte en Auth Callback (`/auth/callback`)** — Se actualizó el endpoint para soportar tanto el intercambio de código PKCE (`exchangeCodeForSession(code)`) como la verificación de OTP por hash (`verifyOtp({ token_hash, type })`), garantizando inicio de sesión instantáneo desde enlaces de correo en móvil y escritorio.

### ✨ Added
- **6 Plantillas Dinámicas de Correo Transaccional (`EmailTemplate` model)**:
  1. `WELCOME`: Bienvenida con enlace mágico de acceso directo al Dashboard tras checkout de prueba de 15 días.
  2. `REMINDER_TRIAL`: Aviso preventivo enviado automáticamente 3 días antes de finalizar la prueba gratuita con enlace a `/billing`.
  3. `TRIAL_CANCELLED`: Confirmación formal de cancelación con "Garantía de Cero Cargos", confirmando que no se realizó ni realizará cobro alguno.
  4. `PAYMENT_SUCCESS`: Confirmación de cobro exitoso al pasar a PRO, bienvenida formal y detalle de beneficios activos.
  5. `DUNNING`: Alerta inmediata de cobro fallido/tarjeta rechazada con enlace directo al Portal de Clientes de Stripe.
  6. `UPCOMING_RENEWAL`: Notificación 3 días antes de cada renovación mensual recurrente.
- **Editor Admin Tabulado en `/dashboard/admin/smtp`**: Panel con 6 pestañas interactivas, guía de variables dinámicas (`{{userFirstname}}`, `{{dashboardUrl}}`) y guardado directo en PostgreSQL.
- **Flujo de Dunning y Recuperación**: Banner persistente de alerta roja (`DunningBanner.tsx`) cuando el estado es `PAST_DUE`, integración con Stripe Billing Portal (`/api/portal`) y reactivación automática a `ACTIVE` con correo de confirmación al recibir `invoice.payment_succeeded`.
- **Scripts de Soporte**:
  - `scripts/seed-email-templates.ts`: Inicialización de plantillas en PostgreSQL.
  - `scripts/rescue-user.ts`: Provisionamiento manual de usuarios de prueba.
  - `scripts/delete-test-user.ts`: Depuración atómica de usuarios en Prisma y Supabase Auth para pruebas limpias.

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
