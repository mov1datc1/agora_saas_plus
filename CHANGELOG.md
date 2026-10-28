# Changelog — Ágora Plus SaaS

Todas las versiones notables del proyecto Ágora Plus están documentadas aquí.

## [5.11.0] — 2026-10-28 🏭 Soporte Multi-Industria (N:M), Backfill Histórico y Organización Documental

### ✨ Added & Enhanced
- **Soporte Multi-Industria en Base de Datos (`TransactionIndustry` N:M)**:
  - Nuevo modelo puente `TransactionIndustry` (`transactionId`, `industryId` con índice único `@@unique([transactionId, industryId])`) en `prisma/schema.prisma`, permitiendo que una operación tenga múltiples industrias asociadas simultáneamente (comportamiento análogo a operaciones *Crossborder* por país), manteniendo `Transaction.industryId` por retrocompatibilidad.
- **Ingesta Completa de Industrias Asociadas en el ETL**:
  - Actualización de `src/app/api/sync-drupal/route.ts`, `src/app/api/admin/mysql-sync/route.ts` y `scripts/sync-mysql-hybrid.js` para iterar y vincular **todas** las industrias enviadas por Drupal en `post.industries[]` (eliminando el truncamiento previo que solo tomaba `post.industries[0]`).
  - Limpieza e inserción atómica de `TransactionIndustry` en cada re-sincronización y en las acciones administrativas de purga (`sync-actions.ts`, `/api/sync-drupal/reset`).
- **Filtro de Operaciones, Detalle, Exportación y Rankings Multi-Industria**:
  - **`GET /api/operations` y `GET /api/operations/filters`**: Al filtrar por una industria, ahora retorna toda operación que tenga dicha industria entre cualquiera de sus industrias asociadas (`industries.some`), devolviendo todas las industrias de la operación separadas por coma.
  - **Drawer de Detalle (`OperationsClient.tsx`) y Exportación PDF/Excel (`exportUtils.ts`)**: Despliegan la lista completa de industrias asociadas con viñetas.
  - **Métricas, Rankings y Copilot (`/api/metrics/industries`, `/api/metrics/countries`, `/api/metrics/firms`, `/dashboard`, `/api/chat`)**: Contabilizan cada industria asociada a la operación en los desgloses sectoriales.
- **Backfill Histórico desde el API de Drupal (`scripts/backfill-industries.js`)**:
  - Migración de `17,975` relaciones base y escaneo completo de las `25,400` publicaciones en el API de Drupal.
  - **`5,403` transacciones multi-industria actualizadas** en producción con **`6,327` nuevos vínculos de industria** (verificado con el caso *Tidewater* `drupal-131758`, ahora visible bajo *Gas Natural*, *Petróleo* y *Transporte y logística*).

### 🐛 Fixed
- **UX en Selector de Filtros (`SearchableSelect.tsx`)**:
  - Se amplió el ancho mínimo del menú desplegable (`sm:min-w-[380px]`) y se habilitó el salto de línea (`break-words`) con tooltip `title` para evitar que industrias con prefijos largos idénticos (*"Energía y recursos naturales | No Renovable - Carbón / Gas Natural / Petróleo"*) se vieran truncadas e indistinguibles en el listado.

### 📚 Documentation
- **Estructuración y Actualización de Documentación Maestra (`docs/`)**:
  - Creación de `docs/01_ARQUITECTURA_SOLUCION_AGORA_PLUS.md`, `docs/02_CONTRATO_API_DRUPAL.md` y `docs/03_REGLAS_NEGOCIO_Y_PIPELINE_ETL.md`.
  - Organización de documentos históricos, diagramas, reportes de auditoría y scripts auxiliares en subcarpetas dedicadas.

---

## [5.10.0] — 2026-10-24 🔒 Bloqueo Estricto Post-Cancelación, Candado Anti-Abuso y Enrutamiento al Checkout

### ✨ Added & Enforced
- **Revocación Estricta e Inmediata de Acceso (`DashboardLayout`)**:
  - Implementación de gatekeeper central en `src/app/dashboard/layout.tsx` para usuarios regulares (`USER`):
    - Bloqueo y redirección inmediata a `/deactivated` si `subscription.status === 'CANCELED'`.
    - Bloqueo por desactivación explícita (`user.isActive === false`).
    - Bloqueo por prueba vencida (`status === 'TRIAL'` con `trialEndsAt < now` sin conversión a plan activo).
    - Bloqueo en cuentas corporativas hijas si la cuenta matriz (`parentId`) está inactiva o cancelada.
    - Excepción de acceso total garantizada para administradores (`ADMIN` y `SUPERADMIN`).
- **Candado Anti-Abuso de Pruebas Gratuitas (1 Prueba por Correo de por Vida)**:
  - **En Registro (`/register`)**: Si un correo ya existía en la base de datos y utilizó o canceló una prueba previa, el sistema le impide registrarse gratis de nuevo y despliega un banner destacado: *"Este correo ya se registró para una prueba gratuita. Si deseas suscribirte a Ágora Plus, puedes ingresar al checkout para pagar tu plan oficial"* junto a un botón directo `Ir al Checkout y Pagar`.
  - **En Checkout Público e Interno (`/api/public-checkout` y `/api/checkout`)**: Detección inteligente por email o usuario autenticado. Si el usuario ya disfrutó de una prueba previa o canceló, **se elimina el parámetro `trial_period_days: 15`** y Stripe procesa el cobro del primer mes de forma inmediata al ingresar la tarjeta.
  - **En Pantalla de Cuenta Desactivada (`/deactivated`)**: Para usuarios cancelados o con prueba concluida, se integró el botón directo `Suscribirme con Plan Oficial` prellenado con su correo para reactivación inmediata sin soporte manual.
- **Cancelación Inmediata y Definitiva (`/api/subscription/cancel`)**:
  - Al procesar la cancelación en la app, se ejecuta `stripe.subscriptions.cancel(subId)` inmediatamente en lugar de diferirlo a fin de ciclo.
  - Sincronización atómica en Prisma: `subscription.status = 'CANCELED'`, `cancelAtPeriodEnd = false`, y `user.isActive = false`.
  - Modal de cancelación actualizado en `CancelSubscriptionModal.tsx` aclarando el corte inmediato de acceso, garantía de cero cargos futuros y redirección inmediata a `/deactivated`.
- **Sincronización Bidireccional en Webhooks y Panel Admin**:
  - Webhooks de Stripe (`customer.subscription.deleted` / `canceled` y `checkout.session.completed`) sincronizan automáticamente `user.isActive` (false en cancelación, true en pago).
  - Acciones de administrador (`deactivateUser` / `reactivateUser` en `actions.ts` y `toggleUserActiveStatus` en `user-actions.ts`) sincronizan tanto `user.isActive` como `subscription.status`.
  - Cron diario (`check-subscriptions`) audita pruebas vencidas (`diffDays < 0`) y desactiva el acceso en automático.
- **Limpieza de Datos en Producción**:
  - Normalización de las cuentas canceladas existentes en la base de datos (incluyendo la cuenta de prueba de Henry Infante `henryjinfantec2366@gmail.com`) con `isActive: false` para expulsión inmediata.

---

## [5.9.0] — 2026-10-22 🔔 Auditoría de Actividad, Contingencia de Trials y Garantía de Cero Cargos

### ✨ Added & Enhanced
- **Auditoría de Actividad y Primer Acceso (`User.firstLoginAt` / `User.lastLoginAt`)**:
  - Nuevas columnas en el modelo `User` en PostgreSQL para registrar el primer acceso a la plataforma y la última fecha de actividad de sesión.
  - Captura transparente y regulada en `DashboardLayout`, `auth/callback` y Server Action de login.
  - Indicadores visuales en el panel de administración (`UsersClient.tsx`): `✓ Accedió: DD/MM/AAAA` vs `⚠️ Nunca ha ingresado` para segmentar leads en el CRM de Ayudante X.
- **Motor de Contingencia para Periodos de Prueba (`/api/cron/check-subscriptions`)**:
  - El cron diario ahora audita proactivamente todas las suscripciones en estado `TRIAL`.
  - Evalúa la ventana de expiración a ≤ 3 días y dispara en automático el correo `REMINDER_TRIAL` por Resend (`soporte@agora-lexlatin.com`).
  - Candado anti-spam con el campo `Subscription.trialReminderSentAt` para evitar duplicidad de envíos.
  - Disparo en tiempo real del evento comercial `TRIAL_EXPIRING` hacia Ayudante X / GoHighLevel.
  - Acceso seguro al endpoint mediante token `CRON_SECRET` o sesión autenticada de Administrador.
- **Botón Manual de Aviso de Cobro (`UsersClient.tsx`)**:
  - Incorporación de botón directo `Aviso Cobro` (`Mail`) para forzar o reenviar la notificación de fin de prueba a cualquier usuario en `TRIAL` en 1 clic.
- **Validación del Ciclo Completo de Cancelación (Caso Henry Infante)**:
  - Entrega exitosa del recordatorio preventivo con 1 día de anticipación a `henryjinfantec2366@gmail.com`.
  - Cancelación anticipada procesada de forma impecable vía portal y webhook de Stripe.
  - Despacho inmediato del correo de *Garantía de Cero Cargos* (`TRIAL_CANCELLED`) confirmando la anulación total de la suscripción sin cargos a la tarjeta.

---

## [5.8.0] — 2026-10-20 🌐 Fusión de "Jurisdicciones" e "Industrias" (3-Level Storytelling)

### ✨ Added & Unified
- **Fusión de Módulos (Jurisdicciones + Industrias)**:
  - Se eliminó el enlace independiente de *Industrias* en la barra lateral (`Sidebar.tsx`) y en el panel de configuración de administradores (`RankingsToggleClient.tsx`). La sección **RANKINGS ANALÍTICOS** ahora contiene únicamente **`Clasificación`** (icono `Building2`) y **`Jurisdicciones`** (icono `Globe`).
  - La ruta heredada `/dashboard/metrics/industries` redirige automáticamente a `/dashboard/metrics/countries` (`redirect`).
- **Storytelling Analítico en 3 Niveles en `Jurisdicciones` (`/dashboard/metrics/countries`)**:
  1. **Nivel 1 (Macro / Mapa Interactivo)**:
     - Mapa interactivo Mercator global/latinoamericano destacado en la cabecera. Se retiraron las tarjetas superiores de KPIs globales para darle protagonismo absoluto a la geografía.
     - Hover dinámico con tooltip enriquecido mostrando volumen de operaciones y monto acumulado por país.
     - Barra de herramientas con selector de país `SearchableSelect` con buscador en vivo, por defecto configurado en **México** con prioridad a jurisdicciones de Latinoamérica.
  2. **Nivel 2 (Sectores por País)**:
     - Tabla de industrias activas del país seleccionado con columnas: `Industria`, `Operaciones` (con badge del % que representa del total del país), y `Monto Acumulado (USD)` (estrictamente operaciones públicas; confidenciales = $0).
     - Ordenable interactivamente tanto por número de transacciones como por monto acumulado.
     - Gráfico Donut (`PieChart` / `recharts`) con desglose visual del % de participación de los sectores principales.
  3. **Nivel 3 (Clímax: Firmas Asesoras Líderes por Sector)**:
     - Al seleccionar cualquier industria (por defecto la industria #1 del país seleccionado, e.g. "Banca"), se despliega la tabla de firmas: `Firmas Asesoras en [Industria] — [País]`.
     - Columnas: `#` (clasificación limpia: 1, 2, 3... sin emojis ni medallas), `Firma`, `Número de Operaciones en Sector`, y `Monto Acumulado en Sector (USD)`.
     - Ordenable por operaciones (#) o monto ($).
     - Botón de acceso directo para explorar las transacciones de dicho sector en el módulo de Operaciones.
- **Motor Server-Side (`/api/metrics/countries`)**:
  - Consultas paralelas vía `Promise.all` que entregan en una sola respuesta atómica los datos del mapa global (`mapData`), el catálogo de países, el desglose sectorial del país (`industries`) y las firmas asesoras locales por sector con cálculo de montos públicos.
- **Exportación a Excel**:
  - Exporta el reporte consolidado de industrias y firmas del país seleccionado.

---

## [5.7.0] — 2026-10-20 🏆 Rediseño de "Clasificación de Firmas" (Country-Centric Ranking)

### ✨ Added & Redesigned
- **Módulo "Clasificación" (anteriormente "Firmas Asesoras")**:
  - Renombrado en la barra lateral (`Sidebar.tsx`) y en el panel de configuración de administradores (`RankingsToggleClient.tsx`).
  - **Filtro Principal por País**: Selector estilizado `SearchableSelect` con buscador interno (`Buscar país...`), ubicado en la barra de herramientas directamente encima de la tabla. País por defecto: **México**, con priorización de jurisdicciones de Latinoamérica (*México, Brasil, Chile, Colombia, Perú, Argentina...*).
  - **Tabla de Clasificación Consolidada (1 fila por firma)**:
    1. **`#` (Clasificación)**: Numeración limpia (1, 2, 3...) sin emojis ni medallas.
    2. **`Firma`**: Nombre de la firma legal y país, con opción de ordenamiento alfabético.
    3. **`Número de Operaciones`**: Total de transacciones asesoradas con desglose contextual de públicas vs. confidenciales. Criterio de ordenamiento por defecto (`sortBy=deals&sortOrder=desc`).
    4. **`Monto Acumulado (USD)`**: Suma matemática exacta de operaciones con valor público en dólares (transacciones confidenciales suman $0 al monto acumulado pero se cuentan en el total de operaciones). Ordenable con 1 clic (`sortBy=value&sortOrder=desc`).
- **Motor Server-Side (`/api/metrics/firms`)**:
  - Agregación eficiente en Prisma agrupando operaciones por firma local (`firm.country = selectedCountry`).
  - Filtros cruzados dinámicos por tipo (`M&A`, `Financiamientos`, `Emisiones`) y rango de fechas (`dateAnnounced`).
  - Mapeo de ranking positions consistente incluso al filtrar por búsqueda de texto de firma.
- **Panel Lateral de Detalle Interactivo**:
  - Al hacer clic en cualquier firma de la tabla, despliega la lista desglosada de operaciones asesoradas con montos y acceso directo al modal de detalle completo (`EntityDetailModal`).
- **Exportación a Excel**:
  - Exporta las columnas consolidadas: `Clasificación`, `Firma`, `País`, `Número de Operaciones`, `Operaciones Públicas`, `Operaciones Confidenciales`, `Monto Acumulado (USD)`.

---

### 🐛 Fixed & Diagnosed
- **Error al Abrir Portal de Facturación ("Gestionar Suscripción")** — Al pulsar *"Gestionar Suscripción"*, Stripe devolvía `StripeInvalidRequestError: No such customer: 'cus_VP706vnkkzEY5u'; a similar object exists in live mode, but a test mode key was used to make this request` (500 en `/api/portal`). Vercel tenía configurada la clave `sk_test_...` de la cuenta de LexLatin (`acct_1NvmaWA8zDaMc9Ma`), mientras que los checkouts ocurrían en Live Mode.
  - Se recreó `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` como tipo **Config** (resolviendo el bloqueo de seguridad de Vercel para prefijos de framework públicos) con la clave `pk_live_...`.
  - Se actualizó `STRIPE_SECRET_KEY` con la clave de producción `sk_live_...`.
  - Se diagnosticó y verificó en vivo la generación exitosa de URLs del Customer Portal (`urlGenerated: true`) para clientes de producción.
- **Bloqueo de Cambio de Contraseña para Usuarios de Enlace Mágico** — Los usuarios suscritos vía Stripe Checkout y Magic Link no poseían contraseña previa en Supabase Auth. El modal en `Header.tsx` (`PasswordChangeModal`) y la Server Action `changeOwnPassword` (`/profile/actions.ts`) exigían `currentPassword` obligatoria y llamaban a `signInWithPassword`, arrojando siempre *"La contraseña actual es incorrecta"*.
  - `changeOwnPassword` ahora trata `currentPassword` como opcional: si el usuario no tiene contraseña previa, actualiza directamente en Supabase Auth mediante `supabase.auth.updateUser({ password })`. Si se provee, valida primero la contraseña anterior.

### ✨ Added
- **Modal de "Establecer o Cambiar Contraseña" en Header**:
  - Título y descripción actualizados para permitir a cualquier usuario definir su contraseña personal directamente desde su sesión activa.
  - Campo *"Contraseña Actual"* marcado como opcional con texto de ayuda contextual: *"💡 Si accediste mediante enlace a tu correo y aún no tienes contraseña, puedes dejar este campo vacío"*.
  - Menú de perfil renombrado a *"Establecer / Cambiar Contraseña"*.
- **Herramienta de Asignación / Reseteo de Contraseña en Admin (`UsersClient.tsx`)**:
  - Botón de acción con ícono de llave (`KeyRound` - *"Password"*) incorporado en la tabla de usuarios de suscripción regular (`/dashboard/admin/users`).
  - Permite a los administradores generar una contraseña temporal segura en Supabase Auth (`resetUserPassword`) y copiarla en 1 clic para compartirla con el cliente.
- **Restauración de Ciclo de Prueba**:
  - Suscripción de Henry Infante confirmada en estado `TRIAL` con `cancelAtPeriodEnd: false` y vencimiento hasta el 23 de octubre de 2026.

---

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
