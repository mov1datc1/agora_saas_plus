# Ágora Plus — Inteligencia Transaccional Legal (LexLatin)

> **Versión Actual:** `v5.11.1`  
> **Producción:** [https://www.agora-lexlatin.com](https://www.agora-lexlatin.com)  
> **Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Prisma 7.8 · Supabase PostgreSQL & Auth · Stripe · Resend · Vercel AI SDK

---

## 📚 Índice de Documentación Oficial (`docs/`)

Toda la documentación técnica, contratos de API y reglas de negocio del proyecto se encuentra organizada en la carpeta [`docs/`](./docs):

1. **[01_ARQUITECTURA_SOLUCION_AGORA_PLUS.md](./docs/01_ARQUITECTURA_SOLUCION_AGORA_PLUS.md)**  
   Arquitectura general del sistema, stack tecnológico, modelo relacional en Prisma (`Transaction`, `TransactionIndustry`, `TransactionAdvisor`, `TransactionCompany`, `TransactionLawyer`, `User`, `Subscription`), módulos de la aplicación y flujos de suscripción/seguridad.
2. **[02_CONTRATO_API_DRUPAL.md](./docs/02_CONTRATO_API_DRUPAL.md)**  
   Especificación técnica del endpoint REST custom en Drupal (`GET https://lexlatin.com/api/agora/transactions`), autenticación (`X-Agora-Token`), parámetros, estructura JSON de respuesta y mapeo de tablas MySQL de Drupal a Supabase.
3. **[03_REGLAS_NEGOCIO_Y_PIPELINE_ETL.md](./docs/03_REGLAS_NEGOCIO_Y_PIPELINE_ETL.md)**  
   Las 7 reglas de negocio y filtrado del motor ETL acordadas con el equipo de Data Entry (Filtro primario `Transacción`, Guardrail de Evidencia Cero, Filtro de Originales con Clones Multi-Área, Noise Filter Editorial, Clasificación Determinística de 3 familias, Soporte Multi-Industria N:M y Reconciliación automática de nodos 404).
4. **[CHANGELOG.md](./CHANGELOG.md)**  
   Historial detallado de versiones y despliegues en producción.

### Carpetas Adicionales en `docs/` y `drupal-modules/`
* [`docs/diagrams/`](./docs/diagrams) — Diagramas visuales de arquitectura, APIs y pipeline ETL.
* [`docs/guias-y-referencias/`](./docs/guias-y-referencias) — Guías operativas de Stripe, MySQL híbrido, `.htaccess` y esquemas SQL.
* [`docs/reportes-auditoria/`](./docs/reportes-auditoria) — Reportes históricos de conflictos y duplicados en migración.
* [`drupal-modules/agora_api/`](./drupal-modules/agora_api) — Código fuente del módulo PHP de Drupal (`TransactionsController.php`), [Guía de Instalación](./drupal-modules/GUIA_INSTALACION.md) e [Instrucciones de Actualización](./drupal-modules/INSTRUCCIONES_ACTUALIZACION_API.md).

---

## 🚀 Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Generar cliente Prisma
npx prisma generate

# 3. Iniciar servidor de desarrollo
npm run dev
```
