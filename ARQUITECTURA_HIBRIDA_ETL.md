# 📘 Arquitectura Híbrida ETL — Ágora Plus

> **Versión:** 4.0  
> **Última actualización:** 22 de julio de 2026  
> **Autor:** Equipo de Ingeniería  
> **Propósito:** Documentación operativa para retomar trabajo en nuevas sesiones

---

## 1. Resumen Ejecutivo

Ágora Plus usa una **arquitectura híbrida de ingesta de datos** que combina dos canales para lograr cobertura total del universo transaccional de LexLatin:

| Canal | Uso Principal | Cobertura | Velocidad | Control |
|---|---|---|---|---|
| **MySQL Directo** | Sync histórica total (botón en Admin) | 100% (published + unpublished) | ~15-20 min para ~24,500 txns | Admin Panel UI |
| **API Custom REST** | Sync incremental diaria (cron job) | Posts nuevos/editados (con filtros) | ~50 txns/ejecución (~50s) | Cron automático 3AM |

### Cambio v3.1 → v4.0: API Custom REST

A partir de v4.0, el cron ya **NO usa JSON:API de Drupal**. Ahora usa un **endpoint REST custom** (`/api/agora/transactions`) instalado como módulo de Drupal (`agora_api`), que:

- Retorna datos planos (no JSON:API nested)
- Incluye **publicados y despublicados** (`status=all`)
- Lee relaciones directamente via SQL (no `include=`)
- Incluye `field_tipo_de_noticia` para filtrado primario
- Autenticación via header `X-Agora-Token`

---

## 2. Universo de Datos en Drupal MySQL

```
┌─────────────────────────────────────────────────────────┐
│           Drupal MySQL (Producción — Cloudways)         │
│          Host: 104.248.230.220:3306                     │
│          DB: zwcjasengh                                 │
│          User: zwcjasengh                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Total posts category=1:       ~24,561                  │
│  ├── Con tipo "Transacción":  ~17,400                   │
│  │   ├── Publicadas:           ~6,500  ← API Custom ✅  │
│  │   └── Despublicadas:       ~10,900  ← API Custom ✅  │
│  ├── Sin tipo de noticia:      ~5,500  ← Solo MySQL ✅  │
│  └── Otro tipo (Movimiento):   ~1,600  ← Filtradas ❌   │
│                                                         │
│  FILTROS APLICADOS:                                     │
│  ├── tipo_de_noticia ≠ "Transacción"  → SKIP           │
│  ├── Portal Original (2+ áreas)      → SKIP            │
│  └── Noise Filter (editorial)        → SKIP            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Canales de Sincronización

### 3.1 MySQL Directo (Admin Panel — Botón "Sync MySQL")

**Ubicación UI:** Dashboard → Admin → Configuración → "Sincronización MySQL Directa"

**Flujo de uso:**
```
Paso 1: Click "Detectar IP" → muestra IP pública del servidor Vercel
Paso 2: Agregar IP al whitelist de Cloudways
Paso 3: Click "Iniciar Sync MySQL" → progress bar + logs en tiempo real
```

**Implementación técnica:**
```
Frontend: MySQLSyncPanel.tsx
  └── Llama POST /api/admin/mysql-sync en loop
      ├── Cada invocación: 200 posts (dentro del timeout de Vercel)
      ├── Conecta MySQL → lee chunk + relaciones → cierra MySQL
      ├── Aplica 3 filtros (tipo, portal original, noise)
      └── Upsert a Supabase via Prisma
```

**Script alternativo (local, más rápido):**
```bash
# Ubicación: scripts/sync-mysql-hybrid.js
# Duración: ~15-20 minutos (sin límite de timeout)
cd agora-plus
node scripts/sync-mysql-hybrid.js              # Sync completa
node scripts/sync-mysql-hybrid.js --dry-run    # Preview sin escribir
node scripts/sync-mysql-hybrid.js --from=2026  # Solo posts desde 2026
```

**APIs involucradas:**
| Endpoint | Función |
|----------|---------|
| `GET /api/admin/server-ip` | Detecta IP pública del servidor |
| `POST /api/admin/mysql-sync` | Ejecuta un chunk de sync MySQL |

---

### 3.2 API Custom REST (Cron Job — Automático)

**Endpoint Drupal:** `https://lexlatin.com/api/agora/transactions`  
**Autenticación:** Header `X-Agora-Token: agora-etl-2026-secure-token`  
**Módulo Drupal:** `agora_api` (Drupal 8.7) — archivo en `drupal-modules/agora_api/`

**Cron configurado:**
```json
// vercel.json
"crons": [{ "path": "/api/sync-drupal", "schedule": "0 9 * * *" }]
// 9:00 UTC = 3:00 AM CST (CDMX)
```

**Flujo del cron:**
```
POST /api/sync-drupal
  ├── Fetch API Custom: 10 batches × 5 posts = 50 posts (los más recientes por `changed DESC`)
  ├── FILTRO 1: tipo_de_noticia ≠ "Transacción" → skip
  ├── FILTRO 2: Portal Original (2+ áreas mapeadas) → skip  
  ├── FILTRO 3: Noise Filter (editorial: nombramientos, fichajes) → skip
  ├── Clasificación: Practice Area Map → M&A / Emisiones / Financiamientos
  ├── Fallback heurístico: classificationEngine.ts (si no hay áreas)
  └── Upsert a Supabase (preserva typeOverride si existe)
```

**Logs de auditoría:** Dashboard → Admin → Configuración → CronLogs Panel

---

## 4. Tres Filtros de Calidad (v4.0)

### Filtro 1: Tipo de Noticia (PRIMARY)
```
Campo MySQL: node__field_tipo_de_noticia.field_tipo_de_noticia_value
Regla: Si tipo ≠ "Transacción" → SKIP
Ejemplo: "Movimiento Lateral", "Noticia" → filtrado
```
> ⚠️ Requiere que el módulo `agora_api` incluya `field_tipo_de_noticia` en la respuesta.
> Instrucciones para el equipo Drupal: `drupal-modules/INSTRUCCIONES_ACTUALIZACION_API.md`

### Filtro 2: Portal Original (Multi-Área)
```
Regla: Si un post tiene 2+ practice areas que mapean a TIPOS DISTINTOS → SKIP
Lógica: Es el "original" que Data Entry mantiene para LexLatin.
        Los clones (1 área cada uno) son los registros para Ágora.

Ejemplo:
  NID 134001: "Banca y finanzas" + "Mercado de capitales" → 2 tipos → SKIP ✅
  NID 134114: "Banca y finanzas" → 1 tipo → IMPORT ✅
  NID 134116: "Mercado de capitales" → 1 tipo → IMPORT ✅
```
> 🛠️ Herramienta de limpieza: Admin Panel → "Purgar Duplicados" (botón amarillo)

### Filtro 3: Noise Filter (Editorial)
```
Archivo: src/lib/classificationEngine.ts → isNonTransactional()
Señales corporativas: nombramiento, fichaje, promoción, nueva oficina...
Señales legales: litigio, arbitraje, regulación, evento, conferencia...

Regla: Si noiseScore ≥ 3 Y no hay keywords transaccionales → SKIP
       (Keywords transaccionales: adquiere, emisión, préstamo, etc.)
```

---

## 5. Tablas MySQL Relevantes

### Tablas de Entidades
| Tabla MySQL | Entidad | Tabla Supabase |
|---|---|---|
| `node` (type='firma') | Firmas | `Firm` |
| `node` (type='abogado') | Abogados | `Lawyer` |
| `node` (type='empresa') | Empresas | `Company` |
| `node` (type='industria') | Industrias | `Industry` |
| `node` (type='pais') | Países | `Transaction.country` |
| `node` (type='areas_de_practica') | Áreas de Práctica | `Transaction.practiceArea` |

### Tablas de Relaciones
| Tabla MySQL | Relación | Tabla Supabase |
|---|---|---|
| `node__field_firmas_involucradas` | Post → Firma | `TransactionAdvisor` |
| `node__field_abogados_involucrados` | Post → Abogado | `TransactionLawyer` |
| `node__field_empresas_involucradas` → `paragraph__field_empresa` | Post → Empresa (con rol) | `TransactionCompany` |
| `node__field_ae` | Post → Área de Práctica | Clasificación + `Transaction.practiceArea` |

### Tablas de Campos del Post
| Tabla MySQL | Campo Supabase |
|---|---|
| `node__body.body_value` | `Transaction.excerpt` (HTML sanitizado) |
| `node__field_estado_caso` | `Transaction.status` |
| `node__field_fecha_de_concrecion_del_ac` | `Transaction.dateAnnounced` (primaria) |
| `node__field_fecha_de_la_firma` | `Transaction.dateAnnounced` (fallback) |
| `node__field_fecha_de_cierre_de_la_emis` | `Transaction.dateClosed` |
| `node__field_tipo_de_noticia` | Filtro (solo "Transacción" pasa) |
| `node__field_caso_no_publicado` | `Transaction.isPublished` |

### Tablas de Roles de Empresas
| Tabla MySQL | Rol |
|---|---|
| `paragraph__field_rol_fusiones_y_adquisicion` | Comprador / Vendedor (M&A) |
| `paragraph__field_rol_em` | Emisor / Colocador (Emisiones) |
| `paragraph__field_rol_financiamiento` | Prestatario / Acreedor (Financiamientos) |

---

## 6. Motor de Clasificación (5 Fases)

```
FASE 0: Filtro de Ruido (isNonTransactional)
  └── Skip: nombramientos, fichajes, eventos, litigios

FASE 1: Clasificación Determinística (Practice Area Map)
  └── Mapeo directo:
      ├── "Banca y finanzas", "Financiero" → Financiamientos
      ├── "Mercado de capitales - Emisiones" → Emisiones
      └── "Corporativo - Adquisiciones/Fusiones" → M&A

FASE 2: Detección de Conflictos Multi-Área
  └── Si mapea a >1 tipo distinto → es Portal Original → SKIP

FASE 3: Heurístico por Título (classificationEngine.ts)
  └── Para posts SIN área de práctica
      ├── "adquiere", "fusión", "participación" → M&A
      ├── "emite bonos", "certificados bursátiles" → Emisiones
      └── "crédito", "préstamo sindicado" → Financiamientos

FASE 4: Default
  └── Sin señales → "Operación General" (excluido del dashboard)
```

---

## 7. Archivos del Sistema

### ETL & Sync
| Archivo | Función |
|---------|---------|
| `src/app/api/sync-drupal/route.ts` | ETL principal (cron + sync masiva API) |
| `src/app/api/admin/mysql-sync/route.ts` | MySQL sync por chunks (Admin Panel) |
| `src/app/api/admin/server-ip/route.ts` | Detección IP del servidor |
| `scripts/sync-mysql-hybrid.js` | Script local MySQL sync v4.0 |
| `scripts/enrich-from-mysql.js` | Enriquecimiento de excerpts/status |
| `scripts/migrate-mysql-to-supabase.js` | Migración destructiva (legacy) |
| `src/lib/classificationEngine.ts` | Motor de clasificación + noise filter |

### Módulo Drupal
| Archivo | Función |
|---------|---------|
| `drupal-modules/agora_api/src/Controller/TransactionsController.php` | API Custom REST |
| `drupal-modules/INSTRUCCIONES_ACTUALIZACION_API.md` | Instrucciones para equipo Drupal |
| `drupal-modules/agora_api_v2.zip` | Módulo empaquetado listo para deploy |

### Admin Panel
| Archivo | Función |
|---------|---------|
| `src/app/dashboard/admin/settings/MassiveSyncClient.tsx` | Sync masiva via API + Purgar Duplicados |
| `src/app/dashboard/admin/settings/MySQLSyncPanel.tsx` | Sync MySQL directa con IP detection |
| `src/app/dashboard/admin/settings/CronLogsPanel.tsx` | Logs de auditoría del cron |
| `src/app/dashboard/admin/settings/sync-actions.ts` | Server actions (wipe, purge, sync) |

---

## 8. Conexiones y Credenciales

### MySQL (Drupal Producción — Cloudways)
```
Host: 104.248.230.220
Port: 3306
User: zwcjasengh
Pass: KctUE3ap9p
DB:   zwcjasengh
```
> ⚠️ Solo lectura. Requiere IP whitelisted en Cloudways.

### API Custom REST (Drupal)
```
URL:    https://lexlatin.com/api/agora/transactions
Auth:   Header X-Agora-Token: agora-etl-2026-secure-token
Params: ?page=0&limit=50&status=all
```

### Supabase (PostgreSQL)
```
URL: En .env.local → DATABASE_URL
Pooler: puerto 6543 (IPv4, connection pooling)
Direct: puerto 5432 (para migrations)
```

### Vercel
```
Cron: vercel.json → "0 9 * * *" (3:00 AM CST)
Secret: CRON_SECRET (en Vercel dashboard)
Bypass: "agora-bypass-token" (fallback)
```

---

## 9. Comparativa: API Custom vs MySQL Directo

| Aspecto | API Custom (Cron) | MySQL Directo (Admin/Script) |
|---|---|---|
| **Cobertura** | Posts recientes (50/ejecución) | 100% (~24,500 posts) |
| **Velocidad** | ~50 posts/50s | ~24,500 posts/15-20 min |
| **Publicados + Despublicados** | ✅ (`status=all`) | ✅ |
| **Filtro tipo_de_noticia** | ✅ (si módulo actualizado) | ✅ (directo de MySQL) |
| **Portal Original filter** | ✅ | ✅ |
| **Noise filter** | ✅ | ✅ |
| **Body HTML** | ✅ Preservado | ✅ Preservado |
| **Roles de empresas** | ✅ (si en API) | ✅ (vía JOINs) |
| **Automatización** | ✅ Cron diario 3AM | Manual (botón Admin) |
| **Requiere whitelist** | No | Sí (Cloudways) |
| **Uso ideal** | Incremental diario | Sync inicial + correcciones masivas |

---

## 10. Flujo Operativo Recomendado

### Setup Inicial
```
1. Detectar IP del servidor (Admin → MySQL Sync → "Detectar IP")
2. Whitelist IP en Cloudways
3. Ejecutar sync MySQL completa (Admin → "Iniciar Sync MySQL")
4. Verificar en dashboard → conteos correctos
5. Purgar duplicados si hay (Admin → "Purgar Duplicados")
```

### Operación Diaria (automática)
```
Cron 3:00 AM CST → POST /api/sync-drupal
  → Lee 50 posts más recientemente editados
  → Filtra: tipo, portal original, noise
  → Upsert en Supabase
  → Log en CronLogs Panel
```

### Cuando el Owner reporta discrepancias
```
1. ¿Post no aparece? → Verificar si está en rango del cron (reciente)
   - Si es viejo → Ejecutar sync MySQL para traer históricos
   - Si es nuevo → Verificar CronLogs (¿fue filtrado?)
2. ¿Aparece contenido editorial? → Verificar campo tipo_de_noticia en Drupal
   - Si tipo ≠ "Transacción" pero pasó → actualizar módulo agora_api
3. ¿Operación duplicada (original multi-área)? → Ejecutar "Purgar Duplicados"
4. ¿Clasificación incorrecta? → Usar override manual en la transacción
```

---

## 11. Troubleshooting

### "MySQL sync falla: connection refused"
- La IP del servidor no está en el whitelist de Cloudways
- Detectar IP nuevamente (puede cambiar entre deploys de Vercel)
- Alternativa: usar script local `node scripts/sync-mysql-hybrid.js`

### "El cron no captura un post específico"
- El cron solo trae los 50 más recientemente editados
- Posts viejos o no editados quedan fuera del rango
- Solución: sync MySQL para cobertura total

### "Aparecen noticias que no son transacciones"
- Verificar que el módulo Drupal incluya `field_tipo_de_noticia`
- El filtro primario requiere que ese campo sea "Transacción"
- Si el módulo no está actualizado, usar `drupal-modules/INSTRUCCIONES_ACTUALIZACION_API.md`

### "Operación duplicada (2-3 cards de la misma)"
- Usar "Purgar Duplicados" en Admin Panel (elimina originales multi-área)
- El filtro Portal Original previene futuros duplicados

### "El build falla"
- `npx prisma generate` — regenerar Prisma client
- `rm -rf .next && npm run build` — rebuild limpio
- Si disco lleno: `npm cache clean --force`

---

## 12. Schema de Supabase (Prisma)

```prisma
model Transaction {
  id            String    @id          // "drupal-{nid}"
  title         String                 // node_field_data.title
  type          String                 // M&A | Emisiones | Financiamientos | Operación General
  value         Decimal?               // Monto USD (null = confidencial)
  valueString   String?                // "$512.3M" o "Valor confidencial"
  status        String                 // Cerrado | En progreso
  country       String?                // País(es) involucrado(s)
  isPublished   Boolean   @default(true)
  practiceArea  String?                // Áreas originales de Drupal (audit trail)
  typeOverride  String?                // Corrección manual (preservado en re-sync)
  dateAnnounced DateTime?              // Fecha concreción/firma
  dateClosed    DateTime?              // Fecha de cierre
  excerpt       String?                // Body HTML sanitizado
  link          String?                // https://lexlatin.com/node/{nid}
  industryId    String?                // FK → Industry
  // Relations: advisors[], companies[], lawyers[]
}

model CronLog {
  id            String    @id @default(cuid())
  executedAt    DateTime  @default(now())
  status        String                 // success | error
  source        String                 // cron-sync | manual-sync | repair-excerpts
  processedCount Int                   // Posts procesados
  recordsSkipped Int      @default(0)  // Posts filtrados
  newRecords    Int       @default(0)
  updatedRecords Int      @default(0)
  errorMessage  String?
  executionTimeMs Int?
  details       Json?                  // Métricas detalladas
}
```

---

*Documento v4.0 — Actualizado con API Custom REST, MySQL Sync desde Admin Panel, 3 filtros de calidad, y módulo Drupal `agora_api`.*
