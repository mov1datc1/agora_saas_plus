# 🔌 02. Contrato de API con Drupal (`agora_api`)

> **Módulo en Drupal:** `agora_api` (Ubicación en repo: `drupal-modules/agora_api/`)  
> **Ruta en Servidor Drupal (Cloudways):** `modules/custom/agora_api/src/Controller/TransactionsController.php`  
> **Endpoint Producción:** `GET https://lexlatin.com/api/agora/transactions`

---

## 1. Propósito del Endpoint Custom

El CMS Drupal 8 de LexLatin utiliza la categoría `Transacción` (`field_category_target_id = 1`) dentro del tipo de contenido `post`. Además, el equipo de Data Entry crea **casos no publicados** (exclusivos para Ágora o clones por tipo de operación) que la JSON:API estándar de Drupal bloquea en colecciones por el issue [#3080441](https://www.drupal.org/project/drupal/issues/3080441).

Para resolverlo de raíz y eliminar las decenas de peticiones anidadas (`?include=`), se construyó el módulo custom **`agora_api`**, que consulta directamente las tablas MySQL de Drupal y entrega un JSON plano con todas las relaciones pre-resueltas.

---

## 2. Especificación de la Petición (Request)

### 2.1. URL y Método
```http
GET https://lexlatin.com/api/agora/transactions
```

### 2.2. Cabeceras Requeridas (Headers)
| Header | Valor | Descripción |
|---|---|---|
| `X-Agora-Token` | `agora-etl-2026-secure-token` | Token secreto compartido (definido en `DRUPAL_AGORA_TOKEN` en Vercel y `API_TOKEN` en `TransactionsController.php`). Si falta o no coincide, retorna `403 Forbidden`. |
| `Accept` | `application/json` | Formato de respuesta esperado. |

### 2.3. Parámetros de Consulta (Query Params)
| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `page` | `int` | `0` | Índice de página (base 0). El `offset` real en SQL es `page * limit`. |
| `limit` | `int` | `50` | Cantidad de registros por página (mínimo `1`, máximo `100`). |
| `status` | `string` | `all` | Filtro de estado en Drupal: `'all'` (publicados + no publicados), `'published'` (`status = 1`), `'unpublished'` (`status = 0`). |
| `changed_after` | `int` | `0` | Timestamp UNIX opcional. Si es `> 0`, solo devuelve nodos con `n.changed >= changed_after` (útil para sincronización incremental). |

> **Ordenamiento por defecto en Drupal:** `ORDER BY n.changed DESC` (los casos creados o editados más recientemente aparecen primero en la página 0).

---

## 3. Contrato de Respuesta (Response JSON Schema)

```json
{
  "total": 25400,
  "page": 0,
  "limit": 5,
  "count": 5,
  "data": [
    {
      "nid": 131758,
      "title": "Tidewater adquiere Wilson Sons Ultratug Participações y su filial Atlantic Offshore Services",
      "status": true,
      "created": "2026-09-02T14:20:00+00:00",
      "changed": "2026-10-27T16:22:10+00:00",
      "body": "<p>La compañía estadounidense Tidewater...</p>",
      "excerpt": "La compañía estadounidense Tidewater...",
      "link": "/noticias/tidewater-adquiere-wilson-sons-ultratug-participacoes-y-su-filial-atlantic-offshore-services-131758",
      "field_estado_caso": "Cerrado",
      "field_caso_no_publicado": false,
      "field_fecha_firma": "2026-02-22",
      "field_fecha_cierre": "2026-08-31",
      "field_tipo_de_noticia": "Transacción",
      "practice_areas": [
        "Corporativo - Adquisiciones"
      ],
      "countries": [
        "Brasil",
        "Chile",
        "Estados Unidos"
      ],
      "industries": [
        "Energía y recursos naturales | No Renovable - Gas Natural",
        "Energía y recursos naturales | No Renovable - Petróleo",
        "Transporte y logística"
      ],
      "firms": [
        "Demarest Advogados - São Paulo",
        "Pinheiro Neto Advogados - Río de Janeiro"
      ],
      "lawyers": [
        "Alejandro Alfonso",
        "Bruno Rocha"
      ],
      "companies": [
        {
          "name": "Tidewater Inc.",
          "nid": 98412,
          "role": "comprador"
        },
        {
          "name": "Wilson Sons Ultratug Participações S.A.",
          "nid": 131750,
          "role": "target"
        }
      ],
      "monetary": {
        "total_usd": 500000000,
        "operations": 1
      }
    }
  ]
}
```

---

## 4. Mapeo Detallado Campo por Campo (Drupal MySQL → JSON API → Prisma)

| Campo en JSON (`agora_api`) | Tabla / Columna Origen en MySQL (Drupal 8) | Tipo | Destino en Ágora Plus (Prisma / Supabase) |
|---|---|---|---|
| `nid` | `node_field_data.nid` | `number` | `Transaction.id = "drupal-{nid}"` |
| `title` | `node_field_data.title` | `string` | `Transaction.title` |
| `status` | `node_field_data.status` | `boolean` | Estado de publicación en el portal LexLatin |
| `created` | `node_field_data.created` | `ISO string` | Fallback último para `dateAnnounced` |
| `changed` | `node_field_data.changed` | `ISO string` | Usado para ordenar el feed del cron (`DESC`) |
| `body` | `node__body.body_value` | `string \| null` | Sanitizado y guardado en `Transaction.excerpt` |
| `excerpt` | `node__body.body_summary` | `string \| null` | Fallback si `body` está vacío |
| `field_tipo_de_noticia` | `node__field_tipo_de_noticia.field_tipo_de_noticia_value` | `string \| null` | **Filtro Primario:** Solo se procesa si es `"Transacción"` |
| `field_estado_caso` | `node__field_estado_caso.field_estado_caso_value` | `string \| null` | Normalizado a `"Cerrado"`, `"En progreso"` o `"Completada"` en `Transaction.status` |
| `field_caso_no_publicado` | `node__field_caso_no_publicado.field_caso_no_publicado_value` | `boolean` | `Transaction.isPublished = !field_caso_no_publicado` |
| `field_fecha_firma` | `node__field_fecha_de_la_firma.field_fecha_de_la_firma_value` | `string \| null` | `Transaction.dateAnnounced` |
| `field_fecha_cierre` | `COALESCE(node__field_fecha_de_cierre_de_la_emis, node__field_fecha_de_concrecion_del_ac)` | `string \| null` | `Transaction.dateClosed` (Fecha prioritaria en UI y filtro de fechas) |
| `practice_areas` | `node__field_ae` → `node_field_data.title` | `string[]` | Define `Transaction.type` (`M&A`, `Financiamientos`, `Emisiones`) y se guarda en `Transaction.practiceArea` |
| `countries` | `node__field_paises_involucrados` → `node_field_data.title` | `string[]` | Unido por comas en `Transaction.country` (soporte Crossborder) |
| `industries` | `node__field_industrias_asociadas` → `node_field_data.title` | `string[]` | **Todas** se insertan en `Industry` y se vinculan en `TransactionIndustry` (N:M), más la primera en `Transaction.industryId` |
| `firms` | `node__field_firmas_involucradas` → `node_field_data.title` | `string[]` | `Firm` + `TransactionAdvisor` (`role: "Asesor Legal"`) |
| `lawyers` | `node__field_abogados_involucrados` → `node_field_data.title` | `string[]` | `Lawyer` + `TransactionLawyer` (`role: "Abogado Involucrado"`) |
| `companies` | `node__field_empresas_involucradas` → `paragraph__field_empresa` + tablas `paragraph__field_rol_*` | `Array<{name, nid, role}>` | `Company` (`id: "drupal-company-{nid}"`) + `TransactionCompany` con rol humanizado |
| `monetary` | `node__field_operacion` → `paragraph__field_datos_monetarios` → `paragraph__field_monto_transaccion_en_dolar` | `{total_usd, operations} \| null` | Suma en USD en `Transaction.value` y texto formateado en `Transaction.valueString` |

---

## 5. Verificación Rápida del Contrato con `curl`

```bash
# Consultar las 3 transacciones modificadas más recientemente
curl -s -H "X-Agora-Token: agora-etl-2026-secure-token" \
     -H "Accept: application/json" \
     "https://lexlatin.com/api/agora/transactions?page=0&limit=3&status=all" | python3 -m json.tool
```
