# 🔧 IMPORTANTE — Paso adicional requerido

## Problema detectado

Drupal tiene un `.htaccess` que redirige **todas** las URLs a `index.php`.
El archivo `agora-bulk-export.php` no se ejecuta directamente.

## Solución: Agregar excepción en `.htaccess`

### Opción A: Modificar el `.htaccess` principal (Recomendada)

Editar `/public_html/.htaccess` y agregar esta línea **ANTES** de `RewriteRule`:

Buscar esta sección:
```apache
# Pass all requests not referring directly to files in the filesystem
# to index.php.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [L]
```

Agregar **ANTES** de esas líneas:
```apache
# Allow direct access to agora-bulk-export.php
RewriteRule ^agora-bulk-export\.php$ - [L]
```

El resultado debe quedar así:
```apache
# Allow direct access to agora-bulk-export.php  
RewriteRule ^agora-bulk-export\.php$ - [L]

# Pass all requests not referring directly to files in the filesystem
# to index.php.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [L]
```

### Opción B: Crear una carpeta separada

Si no quieren tocar el `.htaccess` de Drupal:

1. Crear carpeta: `/public_html/agora-api/`
2. Mover el archivo: `/public_html/agora-api/index.php` (renombrar a index.php)
3. Crear un `.htaccess` dentro de `/public_html/agora-api/`:
```apache
# Override Drupal rewrite - execute PHP directly
RewriteEngine Off
```

La URL sería: `https://lexlatin.com/agora-api/?key=...&offset=0&limit=5`

### Opción C: Usar subdirectory fuera de Drupal

Si Cloudways permite configurar otro virtual host o subdirectory:

1. Crear carpeta: `/public_html/api-export/`
2. Colocar el PHP ahí: `/public_html/api-export/index.php`
3. Crear `.htaccess`:
```apache
RewriteEngine Off
<FilesMatch "\.php$">
    SetHandler application/x-httpd-php
</FilesMatch>
```

---

## Verificación después del fix

### Test 1: Sin API key
```bash
curl -s "https://lexlatin.com/agora-bulk-export.php"
```
Resultado esperado:
```json
{"success":false,"error":"API Key inválida"}
```

### Test 2: Con API key
```bash
curl -s "https://lexlatin.com/agora-bulk-export.php?key=agora-sync-2026-k8xP9mQ2vR&offset=0&limit=2"
```
Resultado esperado: JSON con `"success":true` y datos de 2 posts.

**Si usan la Opción B**, la URL cambia a:
```bash
curl -s "https://lexlatin.com/agora-api/?key=agora-sync-2026-k8xP9mQ2vR&offset=0&limit=2"
```

---

## ⚠️ AVISAR A JONATHAN

Cuando esté funcionando, enviar:
1. La **URL final** del endpoint (puede variar según la opción elegida)
2. Confirmación de que el Test 2 devuelve JSON con posts
