# ⚙️ 03. Reglas de Negocio y Pipeline ETL — Ágora Plus

> **Archivos Principales:**
> - Sincronización API Drupal (Cron y Manual): [`src/app/api/sync-drupal/route.ts`](../src/app/api/sync-drupal/route.ts)
> - Sincronización MySQL Directa (Admin): [`src/app/api/admin/mysql-sync/route.ts`](../src/app/api/admin/mysql-sync/route.ts)
> - Motor de Clasificación y Filtro de Ruido: [`src/lib/classificationEngine.ts`](../src/lib/classificationEngine.ts)
> - Backfill Multi-Industria: [`scripts/backfill-industries.js`](../scripts/backfill-industries.js)

---

## 1. Resumen del Pipeline ETL

Cada vez que Ágora Plus sincroniza operaciones desde Drupal (ya sea mediante el Cron automático diario a las 3:00 AM CST en `/api/sync-drupal`, desde el botón de sincronización en el panel Admin, o mediante scripts de backfill), cada nodo pasa por **7 reglas estrictas de validación, clasificación y normalización** diseñadas junto con el equipo de Data Entry de LexLatin (Ángela Castillo y Daniela Bernal).

```mermaid
flowchart TD
    Post["Nodo recibido de Drupal\n(nid, title, fields, relationships)"]
    R1{"Regla 1:\nfield_tipo_de_noticia == 'Transacción'?"}
    R2{"Regla 2:\n¿Tiene al menos 1 evidencia\n(área, empresa, monto o firma)?"}
    R3{"Regla 3:\n¿Mapea a 2+ Tipos de Operación\ndistintos (Portal Original)?"}
    R4{"Regla 4:\n¿Es Ruido Editorial\n(isNonTransactional)?"}
    R5["Regla 5:\nClasificar Tipo de Operación\n(M&A | Financiamientos | Emisiones)"]
    R6["Regla 6:\nVincular TODAS las Relaciones\n• Industrias (N:M en TransactionIndustry)\n• Países Crossborder\n• Firmas, Abogados y Empresas con Rol"]
    R7["Regla 7:\nUpsert en Supabase + Reconciliación 404"]
    Purge["Eliminar de Ágora si existía\n(deleteIfExists) y Saltar"]

    Post --> R1
    R1 -- "No (None / Noticia / Movimiento)" --> Purge
    R1 -- "Sí" --> R2
    R2 -- "No (0 evidencias)" --> Purge
    R2 -- "Sí" --> R3
    R3 -- "Sí (Original con Clones)" --> Purge
    R3 -- "No (1 solo tipo o con typeOverride)" --> R4
    R4 -- "Sí (Fichaje / Nombramiento)" --> Gen["Forzar 'Operación General'\n(Oculto del Dashboard)"]
    R4 -- "No" --> R5
    R5 --> R6 --> R7
```

---

## 2. Las 7 Reglas de Negocio en Detalle

### Regla 1: Filtro Primario por "Tipo de Noticia" (`field_tipo_de_noticia`)
En el formulario de Drupal existen las opciones: `"- None -"`, `"Transacción"`, `"Acción judicial o extrajudicial"`, `"Movimiento"`, `"Eventos e iniciativas"`.
* **Regla:** Únicamente se importan nodos cuyo `field_tipo_de_noticia` sea explícitamente **`"Transacción"`**.
* **Efecto destructivo en re-sync:** Si un nodo previamente sincronizado es cambiado en Drupal a `"- None -"` o `"Movimiento"`, el ETL ejecuta `deleteIfExists(transactionId)` y lo elimina de Ágora junto con sus relaciones.

---

### Regla 2: Guardrail de Evidencia Cero (Zero-Evidence Guardrail)
En ocasiones se marcan por error notas editoriales como `"Transacción"` en Drupal sin llenar datos transaccionales.
* **Regla:** Todo caso debe tener al menos **UNO** de los siguientes 4 elementos:
  1. `practice_areas.length > 0`
  2. `companies.length > 0`
  3. `monetary.total_usd > 0`
  4. `firms.length > 0`
* Si los 4 están vacíos, el registro se descarta (y se elimina si existía en BD).

---

### Regla 3: Metodología de Clones de Data Entry (Filtro "Portal Original")
Cuando una operación real involucra múltiples naturalezas jurídicas (por ejemplo, una compra apalancada que es **M&A + Financiamiento**, o un **Financiamiento + Emisión**), la metodología de Data Entry en Drupal es:
1. Publicar en el portal de LexLatin una nota original que tiene marcadas ambas áreas de práctica.
2. Crear en Drupal **clones no publicados** (uno por cada tipo de operación individual, con sus propios montos y roles de empresas correspondientes).
* **Regla:**
  * Si un nodo mapea a **2 o más tipos de operación distintos** (`allMappedTypes.length >= 2`, ej. `['M&A', 'Financiamientos']`) y no tiene `typeOverride`, se identifica como el **Portal Original** → **se salta y se purga de Ágora**, dejando únicamente sus clones individuales para no duplicar conteos ni montos.
  * **Excepción importante:** Si un nodo tiene 2 áreas de práctica que mapean al **mismo** tipo de operación (ej. `"Corporativo - Adquisiciones"` + `"Corporativo - Fusiones"`, ambas `M&A`), **NO** hay conflicto (`uniqueTypes.length === 1`) y la operación se conserva.

---

### Regla 4: Filtro de Ruido Editorial (`isNonTransactional`)
Algunas notas de nombramientos de socios o aperturas de áreas traen etiquetada el área `"Corporativo - Adquisiciones"`.
* **Regla:** El motor [`classificationEngine.ts`](../src/lib/classificationEngine.ts) evalúa el título y el cuerpo buscando señales editoriales (`nombramiento`, `fichaje`, `nuevo socio`, `refuerza práctica`, `promueve a`, etc.). Si detecta ruido editorial sin evidencia de transacción financiera, clasifica el registro como `"Operación General"`, el cual queda excluido de todos los dashboards y conteos (que filtran estrictamente `type IN ('M&A', 'Emisiones', 'Financiamientos')`).

---

### Regla 5: Clasificación Determinística de Tipo de Operación
Existen **únicamente 3 tipos de operación oficiales** en Ágora Plus (`Private Capital` fue retirado por especificación de producto):

| Área de Práctica en Drupal (`field_ae`) | Tipo de Operación en Ágora Plus |
|---|---|
| `Corporativo - Adquisiciones` | **`M&A`** |
| `Corporativo - Fusiones` | **`M&A`** |
| `Banca y finanzas (créditos y financiamientos)` | **`Financiamientos`** |
| `Banca y finanzas` | **`Financiamientos`** |
| `Mercado de capitales - Emisiones` | **`Emisiones`** |

* Si el post no tiene área de práctica mapeada (y no es ruido editorial), actúa como respaldo el clasificador heurístico por título, extracto y roles de empresas (`classifyOperationType`).
* Si un administrador asignó un `typeOverride` manual en la base de datos, éste tiene prioridad absoluta y se preserva en futuras sincronizaciones.

---

### Regla 6: Relaciones Multi-Valor (Industrias Asociadas, Países Crossborder, Firmas, Empresas y Abogados)

#### 6.1. Industrias Asociadas (Relación N:M en `TransactionIndustry`)
* Cuando Data Entry selecciona **más de una industria asociada** en Drupal (ej. caso *Tidewater* `node/131758`: *Gas Natural*, *Petróleo* y *Transporte y logística*), el ETL hace `upsert` de **todas** las industrias del arreglo `post.industries` en la tabla `Industry` y crea un registro por cada una en la tabla puente **`TransactionIndustry`**.
* **Comportamiento en Ágora Plus:**
  * **Filtro de Operaciones (`/api/operations`):** Al filtrar por cualquiera de las industrias asociadas (`where: { OR: [{ industries: { some: { industry: { name } } } }, { industry: { name } }] }`), la operación aparece en los resultados.
  * **Ficha de Detalle y Exportación PDF/Excel:** Muestra todas las industrias asociadas a la operación.
  * **Métricas y Rankings (`/api/metrics/industries`, `/api/metrics/countries`, Dashboard y Copilot):** La operación se contabiliza en cada una de las industrias en las que participa (idéntico al comportamiento de operaciones *Crossborder* por país).

#### 6.2. Países Involucrados (Crossborder)
* Todos los países en `post.countries` se almacenan unidos por coma en `Transaction.country` (ej. `"Brasil, Chile, Estados Unidos"`).
* Al filtrar por cualquiera de esos países o consultar el mapa de Jurisdicciones, la operación aparece en cada país involucrado.

#### 6.3. Limpieza Atómica de Relaciones en Ediciones
* Antes de insertar las relaciones de una transacción en cada sync, el ETL ejecuta `deleteMany` sobre `TransactionAdvisor`, `TransactionLawyer`, `TransactionCompany` y `TransactionIndustry` para ese `transactionId`. Así, si Data Entry corrige una firma, sede o industria en Drupal, la versión antigua no queda huérfana en Ágora.

---

### Regla 7: Fecha Efectiva (`COALESCE(dateClosed, dateAnnounced)`) y Reconciliación 404
* **Fecha Efectiva en UI y Filtros:**
  * La tabla de Operaciones muestra `tx.dateClosed || tx.dateAnnounced` (priorizando la fecha de cierre/concreción sobre la fecha de firma/creación).
  * El filtro de rango de fechas en `/api/operations` aplica exactamente la misma regla lógica (`COALESCE`): si `dateClosed` existe, filtra por `dateClosed`; solo si `dateClosed` es `null`, filtra por `dateAnnounced`.
* **Reconciliación Automática de Nodos Eliminados (HTTP 404):**
  * En cada corrida del cron (`/api/sync-drupal`), el paso 4 verifica mediante peticiones `HEAD` a `https://lexlatin.com/node/{nid}` los 40 casos más recientes y un lote rotativo de 40 casos antiguos. Si Drupal responde `HTTP 404` (nodo borrado definitivamente), Ágora lo elimina automáticamente en cascada.

