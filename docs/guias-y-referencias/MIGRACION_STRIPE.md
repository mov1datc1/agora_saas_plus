# Guía de Migración a Cuenta Stripe del Cliente (Ágora Plus)

Este documento detalla paso a paso cómo migrar de la cuenta de pruebas de MovidaSoft a la cuenta final de Stripe del cliente, configurando primero un entorno de pruebas (Sandbox) y luego pasando a Producción.

> [!IMPORTANT]
> Debes tener acceso de **Administrador** a la cuenta de Stripe del cliente final antes de iniciar este proceso.

---

## FASE 1: Configurar el Entorno Sandbox (Pruebas) del Cliente

Lo primero es configurar la cuenta del cliente para pruebas, así evitamos romper nada en el código de producción.

### 1. Activar el Modo de Pruebas
1. Inicia sesión en la cuenta de Stripe del cliente.
2. En la esquina superior derecha, activa el interruptor que dice **"Modo de prueba"** (Test mode). Toda la interfaz se pondrá de color naranja/amarillo.

### 2. Crear el Producto y el Precio (Suscripción)
1. En el menú principal, ve a **Catálogo de productos** (Product Catalog) > **Productos**.
2. Haz clic en **Añadir producto**.
3. **Nombre:** `Suscripción Ágora Plus PRO` (o el nombre que desee el cliente).
4. **Modelo de precios:** Estándar (Standard pricing).
5. **Precio:** Ingresa el monto (ej: $99 USD).
6. **Facturación:** Selecciona **Recurrente** (Mensual o Anual).
7. Haz clic en **Guardar producto**.
8. Una vez guardado, copia el **ID del precio** (comienza con `price_...`). Guárdalo en un bloc de notas como `NUEVO_PRICE_ID`.

### 3. Obtener las Llaves API (Test)
1. Ve a **Desarrolladores** (Developers) > **Claves de API** (API Keys).
2. Copia la **Clave publicable** (comienza con `pk_test_...`). Guárdala como `NUEVA_PUBLISHABLE_KEY`.
3. Revela y copia la **Clave secreta** (comienza con `sk_test_...`). Guárdala como `NUEVA_SECRET_KEY`.

### 4. Configurar el Webhook (Para la prueba gratuita y pagos)
1. En la sección **Desarrolladores**, ve a **Webhooks**.
2. Haz clic en **Añadir punto de conexión** (Add endpoint).
3. **URL del endpoint:** `https://www.agora-lexlatin.com/api/webhook` *(Asegúrate de incluir `www.` si tu dominio principal lo usa, como lo arreglamos antes)*.
4. **Eventos a escuchar (Seleccionar eventos):**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Haz clic en **Añadir punto de conexión**.
6. En la pantalla de tu nuevo Webhook, haz clic en **"Revelar Secreto de Firma"** (Reveal Signing Secret). Copia este valor (comienza con `whsec_...`). Guárdalo como `NUEVO_WEBHOOK_SECRET`.

---

## FASE 2: Actualizar Variables en Vercel (y en tu código local)

Ahora que tienes los 4 valores de Stripe, debes sustituirlos en la plataforma.

### 1. Variables de Entorno a sustituir
Debes tener estos 4 valores a la mano:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_test_...`
- `STRIPE_SECRET_KEY` = `sk_test_...`
- `STRIPE_WEBHOOK_SECRET` = `whsec_...`
- `STRIPE_PRICE_ID` = `price_...`

### 2. Cambiar en Vercel
1. Ve a tu panel de **Vercel** > Proyecto `agora-plus`.
2. Ve a **Settings** > **Environment Variables**.
3. Busca cada una de las 4 variables mencionadas arriba, haz clic en el ícono del lápiz (Editar), borra el valor viejo de MovidaSoft y pega el nuevo valor del cliente. Haz clic en **Save**.
4. Repite esto para las 4 variables.
5. Ve a **Deployments**, haz clic en los tres puntos del despliegue más reciente y selecciona **Redeploy** para que los cambios surtan efecto.

> [!TIP]
> **Opcional (Desarrollo Local):** Si vas a seguir programando en tu máquina, abre el archivo `.env.local` en tu editor de código y reemplaza estos 4 valores también para que tus pruebas locales apunten al Stripe del cliente.

---

## FASE 3: Pruebas y Pase a Producción (Live Mode)

### 1. Validar el Sandbox
Entra a tu aplicación, realiza un flujo completo (registro, prueba de 15 días simulando el pago con la tarjeta de prueba de Stripe `4242 4242...`) y verifica que los correos lleguen y el usuario se registre en la base de datos sin errores 500.

### 2. Pasar a Producción Real
Cuando el cliente diga "¡Vamos en vivo!", los pasos son idénticos pero con los códigos reales:

1. En la cuenta de Stripe del cliente, **apaga** el interruptor de "Modo de prueba".
2. Ve a la sección de Productos y **crea el producto otra vez** (los productos de prueba no se pasan a producción). Obtendrás un nuevo `price_...` (ya sin el "test").
3. Ve a **Claves de API** y copia las llaves de producción (`pk_live_...` y `sk_live_...`).
4. Ve a **Webhooks** y vuelve a crear un Webhook **NUEVO**.
   - **URL OBLIGATORIA:** `https://www.agora-lexlatin.com/api/webhook` *(NO uses el de WooCommerce `?wc-api=wc_stripe` de la versión anterior)*.
   - **Eventos a escuchar:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`.
   - Copia el nuevo secreto (`whsec_...`).
5. **Finalmente, ve a Vercel**, reemplaza las 4 variables con estos nuevos valores "live", y haz un **Redeploy**.

¡Con esto, la plataforma quedará conectada 100% a la chequera del cliente y lista para recibir dinero real!
