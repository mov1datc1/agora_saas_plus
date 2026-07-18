# Guía de Instalación: Módulo Agora REST API para Drupal

## ¿Qué es esto?

Un módulo custom de Drupal que crea un endpoint REST en:

```
GET https://lexlatin.com/api/agora/transactions
```

Este endpoint sirve **todos los posts de tipo Transacción** (publicados Y no publicados) con sus relaciones completas: abogados, firmas, empresas con roles, países, industrias y montos.

**¿Por qué?** La JSON:API estándar de Drupal no devuelve contenido no publicado en colecciones (es un [bug conocido del core](https://www.drupal.org/project/drupal/issues/3080441)). Este módulo lo resuelve con queries directas a la base de datos.

---

## Archivos del Módulo

El módulo tiene **3 archivos** en la carpeta `drupal-modules/agora_api/`:

```
agora_api/
├── agora_api.info.yml                    # Metadata del módulo
├── agora_api.routing.yml                 # Define la ruta /api/agora/transactions
└── src/
    └── Controller/
        └── TransactionsController.php    # Lógica del endpoint
```

---

## Paso a Paso para el Equipo de Drupal

### Paso 1: Conectarse al servidor por SSH

En **Cloudways Dashboard**:
1. Ir a **Servers** → seleccionar el servidor de LexLatin
2. En la pestaña **Master Credentials**, copiar:
   - **Public IP**: (ej: `104.248.230.220`)
   - **Username**: (ej: `master`)
   - **Password**: la contraseña
3. Conectarse:

```bash
ssh master@104.248.230.220
```

> Si pide contraseña, pegar la de Master Credentials.

---

### Paso 2: Encontrar la carpeta de Drupal

```bash
# En Cloudways la ruta típica es:
cd /home/master/applications/*/public_html

# Si hay varias aplicaciones, buscar la de LexLatin:
ls /home/master/applications/
# Entrar a la correcta (ej: lexlatin o zwcjasengh)
cd /home/master/applications/NOMBRE_APP/public_html
```

**Verificar** que estás en la carpeta correcta:
```bash
ls -la core/
# Debe mostrar archivos de Drupal (authorize.php, modules/, etc.)
```

---

### Paso 3: Crear la carpeta del módulo

```bash
# Ir a la carpeta de módulos custom
cd modules/custom/

# Crear la carpeta del módulo
mkdir -p agora_api/src/Controller
```

---

### Paso 4: Crear los 3 archivos

#### Archivo 1: `agora_api/agora_api.info.yml`

```bash
cat > agora_api/agora_api.info.yml << 'EOF'
name: 'Agora REST API'
type: module
description: 'Custom REST API for Agora SaaS — serves all transaction posts (published + unpublished) with full relationships.'
core_version_requirement: ^8 || ^9 || ^10
package: Custom
EOF
```

#### Archivo 2: `agora_api/agora_api.routing.yml`

```bash
cat > agora_api/agora_api.routing.yml << 'EOF'
agora_api.transactions:
  path: '/api/agora/transactions'
  defaults:
    _controller: '\Drupal\agora_api\Controller\TransactionsController::list'
  requirements:
    _access: 'TRUE'
  options:
    no_cache: TRUE
EOF
```

#### Archivo 3: `agora_api/src/Controller/TransactionsController.php`

> **Este archivo es largo (280 líneas).** Lo más seguro es copiarlo directamente desde el repositorio.
>
> **Opción A — Copiar desde repo (recomendado):**
> El archivo está en: `agora-plus/drupal-modules/agora_api/src/Controller/TransactionsController.php`
> 
> Se puede subir vía SCP:
> ```bash
> # Desde la máquina LOCAL (no en el servidor):
> scp -r /ruta/al/repo/agora-plus/drupal-modules/agora_api/* \
>   master@104.248.230.220:/home/master/applications/NOMBRE_APP/public_html/modules/custom/agora_api/
> ```
>
> **Opción B — Crear manualmente:**
> Copiar el contenido del archivo TransactionsController.php desde el repositorio
> y pegarlo con `nano` o `vi`:
> ```bash
> nano agora_api/src/Controller/TransactionsController.php
> # Pegar el contenido completo, guardar con Ctrl+O, salir con Ctrl+X
> ```

---

### Paso 5: Verificar que los archivos están correctos

```bash
# Verificar estructura
find agora_api/ -type f
```

Debe mostrar:
```
agora_api/agora_api.info.yml
agora_api/agora_api.routing.yml
agora_api/src/Controller/TransactionsController.php
```

```bash
# Verificar contenido del info.yml
cat agora_api/agora_api.info.yml
```

Debe decir: `name: 'Agora REST API'`

---

### Paso 6: Habilitar el módulo

**Opción A — Con Drush (si está disponible):**

```bash
cd /home/master/applications/NOMBRE_APP/public_html
drush en agora_api -y
drush cr
```

**Opción B — Sin Drush (vía Admin UI):**

1. Ir a `https://lexlatin.com/admin/modules`
2. Buscar **"Agora REST API"**
3. Marcar el checkbox ✅
4. Clic en **"Install"** al final de la página
5. Ir a `https://lexlatin.com/admin/config/development/performance`
6. Clic en **"Clear all caches"**

---

### Paso 7: Probar el endpoint

Desde cualquier terminal (local o en el servidor):

```bash
# Test básico - debe devolver JSON con transacciones
curl -s "https://lexlatin.com/api/agora/transactions?limit=2" \
  -H "X-Agora-Token: agora-etl-2026-secure-token" | python3 -m json.tool | head -50
```

**Resultado esperado:**
```json
{
  "total": 18603,
  "page": 0,
  "limit": 2,
  "count": 2,
  "data": [
    {
      "nid": 134210,
      "title": "San Miguel refinancia deuda...",
      "status": true,
      "body": "<p>...",
      "practice_areas": ["Banca y Finanzas"],
      "companies": [{"name": "San Miguel", "role": "prestatario"}],
      ...
    }
  ]
}
```

**Test de posts no publicados:**
```bash
curl -s "https://lexlatin.com/api/agora/transactions?status=unpublished&limit=5" \
  -H "X-Agora-Token: agora-etl-2026-secure-token" | python3 -m json.tool | head -30
```

**Test del clon específico (Opea, nid 134123):**
```bash
curl -s "https://lexlatin.com/api/agora/transactions?status=unpublished&limit=100" \
  -H "X-Agora-Token: agora-etl-2026-secure-token" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for d in data['data']:
    if 'Opea' in d['title'] or d['nid'] == 134123:
        print(f\"nid: {d['nid']} | status: {d['status']} | title: {d['title'][:60]}\")
"
```

---

### Paso 8: Confirmar al equipo de Agora

Una vez verificado, enviar confirmación con:

- ✅ El endpoint responde en `https://lexlatin.com/api/agora/transactions`
- ✅ Devuelve posts publicados Y no publicados
- ✅ El token `X-Agora-Token` funciona

---

## Troubleshooting

### "Page not found" al acceder al endpoint
- Limpiar caché: `drush cr` o vía admin UI
- Verificar que el módulo aparece como "Installed" en `/admin/modules`

### "The website encountered an unexpected error"
- Revisar logs: `drush watchdog:show --count=20`
- O vía admin: `/admin/reports/dblog`
- Causa probable: un nombre de tabla incorrecto (verificar con `drush sql:query "SHOW TABLES LIKE '%field_ae%'"`)

### El módulo no aparece en la lista
- Verificar que `agora_api.info.yml` no tiene errores de YAML (espacios, no tabs)
- Verificar que la carpeta está en `modules/custom/`, no en `modules/contrib/`

### Error de permisos al crear archivos
```bash
# Dar permisos correctos
chmod -R 755 modules/custom/agora_api/
chown -R www-data:www-data modules/custom/agora_api/
# O el usuario que use Apache/Nginx en Cloudways:
chown -R master:master modules/custom/agora_api/
```

---

## Seguridad

- El endpoint está protegido por token (`X-Agora-Token`)
- Sin el token correcto, devuelve `403 Forbidden`
- El token es: `agora-etl-2026-secure-token`
- En producción, este token se configura como variable de entorno en Vercel (`DRUPAL_AGORA_TOKEN`)

---

## Datos Técnicos

| Concepto | Detalle |
|---|---|
| **Endpoint** | `GET /api/agora/transactions` |
| **Auth** | Header `X-Agora-Token: agora-etl-2026-secure-token` |
| **Params** | `page` (int), `limit` (int, max 100), `status` (all/published/unpublished), `changed_after` (unix timestamp) |
| **Tablas consultadas** | `node_field_data`, `node__field_category`, `node__body`, `node__field_ae`, `node__field_firmas_involucradas`, `node__field_abogados_involucrados`, `node__field_empresas_involucradas`, `paragraph__field_empresa`, `paragraph__field_rol_*`, `node__field_paises_involucrados`, `node__field_operacion`, `paragraph__field_datos_monetarios` |
| **Posts despublicados** | ~603 (incluye clones de operaciones multi-tipo) |
| **Posts publicados** | ~18,000+ |
