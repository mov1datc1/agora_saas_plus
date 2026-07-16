# 📘 Arquitectura Híbrida ETL — Ágora Plus

> **Versión:** 3.0  
> **Última actualización:** 16 de julio de 2026  
> **Autor:** Equipo de Ingeniería  
> **Propósito:** Documentación operativa para retomar trabajo en nuevas sesiones

---

## 1. Resumen Ejecutivo

Ágora Plus usa una **arquitectura híbrida de ingesta de datos** que combina dos fuentes para lograr cobertura total del universo transaccional de LexLatin:

| Canal | Uso Principal | Cobertura | Velocidad |
|---|---|---|---|
| **MySQL Directo** | Migración histórica masiva + enriquecimiento | 100% (published + unpublished) | ~19 min para 22,854 txns |
| **JSON:API (Drupal)** | Sincronización incremental diaria (cron) | ~30% (solo published + tipo=Transacción) | ~50 txns/ejecución (~90s) |

### ¿Por qué híbrida?

Drupal JSON:API tiene **3 limitaciones críticas** que impiden usarla como fuente única:

1. **Solo expone contenido publicado** (`status=1`). Las ~10,920 transacciones despublicadas son invisibles.
2. **Requiere `field_tipo_de_noticia = Transacción`** como filtro. Los ~5,478 posts con `category=1` pero sin tipo asignado se pierden.
3. **Timeout de PHP** (Cloudways) limita a ~5 posts por request antes de cortar la conexión.

---

## 2. Universo de Datos en Drupal MySQL

```
┌─────────────────────────────────────────────┐
│           Drupal MySQL (Producción)         │
│          Host: 104.248.230.220:3306         │
│          DB: zwcjasengh                     │
│          User: zwcjasengh                   │
├─────────────────────────────────────────────┤
│                                             │
│  Total posts category=1:     24,522         │
│  ├── Con tipo "Transacción": 17,376         │
│  │   ├── Publicadas:          6,456  ← JSON:API alcanza SOLO estas │
│  │   └── Despublicadas:      10,920  ← Invisibles vía API          │
│  └── Sin tipo de noticia:     5,478  ← También invisibles vía API  │
│                                             │
│  Skipped (no transacciones):  1,668         │
│  Final migrados a Supabase:  22,854         │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 3. Tablas MySQL Relevantes

### Tablas de Entidades
| Tabla MySQL | Entidad | Registros | Tabla Supabase |
|---|---|---|---|
| `node` + `node_field_data` (type='firma') | Firmas | 4,151 | `Firm` |
| `node` + `node_field_data` (type='abogado') | Abogados | 43,204 | `Lawyer` |
| `node` + `node_field_data` (type='empresa') | Empresas | 24,237 | `Company` |
| `node` + `node_field_data` (type='industria') | Industrias | 56 | `Industry` |
| `node` + `node_field_data` (type='pais') | Países | 126 | (campo `country` en Transaction) |
| `node` + `node_field_data` (type='areas_de_practica') | Áreas de Práctica | 29 | (campo `practiceArea` en Transaction) |

### Tablas de Relaciones (Posts → Entidades)
| Tabla MySQL | Relación | Tabla Supabase |
|---|---|---|
| `node__field_firmas_involucradas` | Post → Firma | `TransactionAdvisor` |
| `node__field_abogados_involucrados` | Post → Abogado | `TransactionLawyer` |
| `node__field_empresas_involucradas` → `paragraph__field_empresa` | Post → Empresa (con rol vía `paragraph__field_tipo_de_operacion`) | `TransactionCompany` |
| `node__field_industrias_asociadas` | Post → Industria | `Transaction.industryId` (FK) |
| `node__field_paises_involucrados` | Post → País | `Transaction.country` |
| `node__field_ae` | Post → Área de Práctica | `Transaction.practiceArea` + clasificación |

### Tablas de Campos del Post
| Tabla MySQL | Campo | Campo Supabase |
|---|---|---|
| `node__body` (`body_value`, `body_summary`) | Cuerpo/Lead de la nota | `Transaction.excerpt` |
| `node__field_estado_caso` | Estado: Cerrado/En progreso | `Transaction.status` |
| `node__field_fecha_de_concrecion_del_ac` | Fecha de concreción | `Transaction.dateAnnounced` (primaria) |
| `node__field_fecha_de_la_firma` | Fecha de firma | `Transaction.dateAnnounced` (fallback) |
| `node__field_fecha_de_cierre_de_la_emis` | Fecha de cierre | `Transaction.dateClosed` |
| `node__field_caso_no_publicado` | Flag "no publicado" | `Transaction.isPublished` |
| `node_field_data.status` | Publicado en Drupal (0/1) | `Transaction.isPublished` |
| `node__field_tipo_de_noticia` | Tipo de noticia (Transacción, Movimiento, etc.) | Filtro de ingesta |
| `node__field_category` | Categoría (1 = deals) | Filtro de ingesta |
| `node__field_operacion` → `paragraph__field_datos_monetarios` | Monto en USD | `Transaction.value` |

### Nota sobre el Form de Drupal
El formulario de Data Entry en `lexlatin.com/node/add/post` tiene:
- **Título** → `node_field_data.title`
- **Subtítulo** → campo separado (no se migra)
- **Cuerpo (Body)** → `node__body.body_value` (HTML completo)
- **Edit summary** → `node__body.body_summary` (resumen, a veces vacío)
- El "lead" o extracto se toma de `body_summary` si existe, sino de los primeros 500 chars de `body_value`

---

## 4. Motor de Clasificación (5 Fases)

La clasificación determina el `type` de cada transacción:

```
FASE 0: Filtro de Ruido
  └── Skip: Movimiento, Acción judicial, etc.

FASE 1: Clasificación Determinística (field_ae)
  └── Mapeo directo de Áreas de Práctica → Tipo
      ├── "Banca y finanzas", "Bancario", "Financiero", "Project Finance" → Financiamientos
      ├── "Mercado de capitales", "Emisiones" → Emisiones
      └── "Corporativo", "Fusiones y adquisiciones", "M&A" → M&A

FASE 2: Detección de Conflictos Multi-Área
  └── Si una transacción mapea a >1 tipo → se registra como conflicto
      (ej: "Banca y finanzas" + "Corporativo" → Financiamientos pero con alt M&A)

FASE 3: Fallback Heurístico por Título (para posts SIN área de práctica)
  └── Keywords en el título determinan tipo:
      ├── "adquiere", "compra", "fusión", "participación" → M&A (+644 reclasificados)
      ├── "emite", "bono", "certificado bursátil", "OPA" → Emisiones (+126)
      └── "crédito", "préstamo", "sindicado", "financiamiento" → Financiamientos (+109)

FASE 4: Default
  └── Sin señales claras → "Operación General" (excluido del dashboard)
      └── 2,645 posts editoriales puros (derecho laboral, IP, litigios, etc.)
```

### Resultados de Clasificación Actual
| Tipo | Cantidad | % |
|---|---|---|
| M&A | 8,317 | 41% |
| Emisiones | 8,421 | 42% |
| Financiamientos | 3,471 | 17% |
| **Subtotal Operaciones** | **20,209** | **100%** |
| Operación General (excluido) | 2,645 | — |

---

## 5. Scripts Operativos

### 5.1 Migración Completa: MySQL → Supabase
```bash
# Ubicación: scripts/migrate-mysql-to-supabase.js
# Uso: Migración destructiva total (WIPE + INSERT)
# Duración: ~19 minutos para 22,854 transacciones
# ⚠️ BORRA TODA LA DATA EXISTENTE

cd agora-plus
node scripts/migrate-mysql-to-supabase.js
```

**Qué hace:**
1. Lee TODA la data de MySQL (posts cat=1, firmas, abogados, empresas, industrias, relaciones)
2. Cierra MySQL (para evitar timeout)
3. Hace WIPE de todas las tablas en Supabase
4. Inserta en batch de 100 registros con raw SQL
5. Aplica clasificación determinística (field_ae) + conflictos
6. Genera `migration_conflicts.csv` con los conflictos multi-área

### 5.2 Enriquecimiento: Excerpt + Status + dateClosed
```bash
# Ubicación: scripts/enrich-from-mysql.js
# Uso: Actualiza campos faltantes SIN borrar ni re-clasificar
# Duración: ~15-20 minutos para 22,854 UPDATEs
# ✅ NO DESTRUCTIVO — solo UPDATE

cd agora-plus
node scripts/enrich-from-mysql.js
```

**Qué hace:**
1. Lee body, status, dateClosed, isPublished de MySQL
2. Cierra MySQL
3. Hace UPDATE individual de cada registro en Supabase
4. NO toca: title, type, value, country, relaciones

### 5.3 Reclasificación Heurística
```bash
# Se ejecuta vía script inline (no archivo)
# Uso: Reclasifica "Operación General" con señales en el título
# Duración: ~4 minutos
# ✅ NO DESTRUCTIVO — solo UPDATE de type

# Ver logs de conversación para el script exacto
# Reclasificó 879 transacciones: +644 M&A, +126 Emisiones, +109 Financiamientos
```

### 5.4 Sincronización Incremental (Cron)
```bash
# Endpoint: POST /api/sync-drupal
# Auth: Bearer ${CRON_SECRET} o Bearer agora-bypass-token
# Configuración: vercel.json → "0 9 * * *" (diario 3:00 AM CST)
# Duración: ~90 segundos por ejecución (10 batches × 5 posts)

# Trigger manual:
curl -X POST "https://www.agora-lexlatin.com/api/sync-drupal" \
  -H "Authorization: Bearer agora-bypass-token"
```

**Qué hace:**
1. Fetch de Drupal JSON:API (`sort=-changed` para capturar ediciones)
2. Loop de paginación: hasta 10 batches de 5 posts = 50 posts/ejecución
3. Clasificación determinística (field_ae) + heurístico fallback
4. Upsert en Supabase (actualiza si existe, inserta si nuevo)
5. Registra conflictos multi-área en response
6. Dedup por UUID para evitar duplicados entre batches

---

## 6. Conexiones y Credenciales

### MySQL (Drupal Producción — Cloudways)
```
Host: 104.248.230.220
Port: 3306
User: zwcjasengh
Pass: KctUE3ap9p
DB:   zwcjasengh
```
> ⚠️ Solo lectura. No modificar datos de producción de Drupal.

### Supabase (PostgreSQL)
```
URL: En .env.local → DATABASE_URL
Pooler: puerto 6543 (IPv4, connection pooling)
Direct: puerto 5432 (para migrations)
```

### Drupal JSON:API (Producción)
```
Base: https://lexlatin.com/jsonapi
User: agora_api_user
Pass: Agor4Lex!
Auth: Basic (base64)
```

### Vercel
```
Env vars: DRUPAL_API_URL, DRUPAL_API_USER, DRUPAL_API_PASS
Cron secret: CRON_SECRET (en Vercel dashboard)
Bypass: "agora-bypass-token" (hardcoded fallback)
```

---

## 7. Comparativa: JSON:API vs MySQL Directo

| Aspecto | JSON:API (Cron) | MySQL Directo (Scripts) |
|---|---|---|
| **Cobertura** | ~30% (solo published + tipo=Transacción) | 100% (todo category=1) |
| **Velocidad** | ~50 posts/90s | ~22,854 posts/19min |
| **Campos disponibles** | Todos (body, relations, taxonomy, status via field) | Todos (acceso directo a tablas) |
| **Body/Excerpt** | ✅ `body.processed` del JSON | ✅ `node__body.body_value` |
| **Status del caso** | ✅ `field_estado_caso` | ✅ `node__field_estado_caso` |
| **isPublished** | ⚠️ Solo ve published (status=1) | ✅ Lee ambos (status 0 y 1) |
| **Relaciones** | ✅ Via `include=` params | ✅ Via JOINs directos |
| **Clasificación** | ✅ En tiempo real (5 fases) | ✅ En tiempo de migración |
| **Mantenimiento** | Automático (cron diario) | Manual (ejecutar script) |
| **Riesgo** | Bajo (API pública, read-only) | Medio (acceso directo a DB producción) |
| **Uso ideal** | Sync incremental diario | Migración masiva / enriquecimiento |

### Fortalezas de JSON:API
- ✅ **Automática** — cron sin intervención humana
- ✅ **Captura ediciones** — sort by `-changed` detecta posts editados (ej: cierre reportado meses después)
- ✅ **Clasificación en tiempo real** — aplica motor de 5 fases a cada post nuevo
- ✅ **Sin acceso a DB** — no requiere credenciales MySQL
- ✅ **Segura** — solo lectura via API pública

### Debilidades de JSON:API
- ❌ **Solo publicadas** — 10,920 despublicadas invisibles
- ❌ **Lenta** — 5 posts/batch por timeout PHP de Cloudways
- ❌ **Max 50/ejecución** — limitada por timeout de Vercel (60s)
- ❌ **No captura tipo vacío** — 5,478 posts sin `field_tipo_de_noticia` se pierden
- ❌ **Formato complejo** — JSON:API usa relationships/includes que requieren parsing

### Fortalezas de MySQL Directo
- ✅ **Cobertura 100%** — lee published + unpublished + sin tipo
- ✅ **Velocidad brutal** — 22,854 registros en 19 min (batch SQL de 100)
- ✅ **Acceso a todo** — body, summary, status, fechas, relaciones paragraph
- ✅ **Enriquecimiento** — puede actualizar campos sin re-crear datos

### Debilidades de MySQL Directo
- ❌ **Manual** — requiere ejecutar script desde terminal local
- ❌ **Acceso a DB producción** — riesgo si se ejecuta un DELETE/UPDATE accidental
- ❌ **No incremental** — script de migración borra y re-crea todo
- ❌ **Credenciales expuestas** — IP, user, pass de MySQL en código
- ❌ **Dependiente de schema** — si Drupal cambia tablas, script se rompe

---

## 8. Flujo Operativo Recomendado

### Migración Inicial (una sola vez)
```
1. Ejecutar migrate-mysql-to-supabase.js    → 22,854 transacciones
2. Ejecutar reclasificación heurística      → +879 reclasificados
3. Ejecutar enrich-from-mysql.js            → excerpts + status + dateClosed
4. Verificar en dashboard                   → conteos correctos
```

### Operación Diaria (automática)
```
Cron 3:00 AM CST → POST /api/sync-drupal
  → Lee 50 posts más recientemente editados
  → Upsert en Supabase
  → Clasifica nuevos posts
  → Actualiza posts editados (ej: cierre reportado)
```

### Cuando el Owner reporta discrepancias
```
1. Verificar si es un post published o unpublished
   - Published: el cron debería haberlo capturado
   - Unpublished: necesita script MySQL
2. Si hay datos faltantes en muchos registros:
   → Ejecutar enrich-from-mysql.js (no destructivo)
3. Si hay clasificación incorrecta:
   → Verificar practice areas en Drupal
   → Usar endpoint /api/transactions/override-type para corrección manual
```

---

## 9. Filtros de Calidad de Datos

### En los APIs (server-side)
- `dateAnnounced >= 1990-01-01` — elimina fechas basura (año 0002, etc.)
- `dateAnnounced <= hoy` — elimina datos de staging/test con fechas futuras
- `type NOT IN ('Operación General')` — excluye contenido editorial del dashboard
- Paginación server-side: 50 rows/request (Operations, Firms, Industries, Countries)

### En el ETL (sync-drupal)
- `processedIds` Set — dedup entre batches del mismo cron
- `sort=-changed` — captura posts editados (no solo nuevos)
- Try/catch en bridge table upserts — maneja colisiones de IDs legacy
- Status normalizado: "Cerrado (Closed)" → "Cerrado", "On-going" → "En progreso"

### En la migración MySQL
- Skip `field_tipo_de_noticia` ≠ 'Transacción' (Movimientos, Acciones judiciales)
- Clasificación por `field_ae` (áreas de práctica) como fuente de verdad
- `ON CONFLICT DO NOTHING` para evitar duplicados
- `isPublished = status=1 AND !field_caso_no_publicado`

---

## 10. Troubleshooting

### "El cron no captura posts editados"
- Verificar que `sort=-changed` esté en la URL del fetch (sync-drupal/route.ts)
- Si el post fue editado hace >2 días, el offset de 50 no lo alcanza

### "Faltan excerpts en muchas transacciones"
- Ejecutar `enrich-from-mysql.js` — actualiza excerpts desde MySQL
- Los posts importados via MySQL no tenían body en la primera migración

### "Transacciones duplicadas"
- Verificar `processedIds` Set en sync-drupal (dedup)
- Posts con múltiples fechas (firma + cierre) no deben crear registros duplicados
- ID es `drupal-{nid}` — mismo post siempre tiene mismo ID

### "El build falla"
- `npx prisma generate` — regenerar Prisma client
- `rm -rf node_modules .next && npm install` — reinstalación limpia
- Verificar que `tsconfig.json` excluye `scripts/`

### "Bridge table upsert falla"
- Los try/catch absorben colisiones de IDs legacy
- Si persiste: verificar unique constraint en TransactionCompany/Advisor/Lawyer

---

## 11. Schema de Supabase (Prisma)

```prisma
model Transaction {
  id            String    @id          // "drupal-{nid}" para migrados
  title         String                 // node_field_data.title
  type          String                 // M&A | Emisiones | Financiamientos | Operación General
  value         Decimal?               // Monto USD (null = confidencial)
  valueString   String?                // "Valor confidencial" o null
  status        String                 // Cerrado | En progreso | Cerrada (legacy)
  country       String?                // País principal
  isPublished   Boolean   @default(true)  // false = despublicado en Drupal
  practiceArea  String?                // Audit trail: áreas originales de Drupal
  typeOverride  String?                // Corrección manual vía /api/transactions/override-type
  dateAnnounced DateTime?              // Fecha de concreción/firma
  dateClosed    DateTime?              // Fecha de cierre
  excerpt       String?                // Body/lead de la nota (HTML limpio)
  link          String?                // https://lexlatin.com/node/{nid}
  industryId    String?                // FK → Industry
  // Relations: advisors[], companies[], lawyers[]
}
```

---

*Documento generado para continuidad operativa entre sesiones de desarrollo.*
