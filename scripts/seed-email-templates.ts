import prisma from '../src/lib/prisma'

const TEMPLATES = [
  {
    type: 'WELCOME',
    subject: '¡Bienvenido a Ágora Plus PRO!',
    htmlBody: `<h1>¡Bienvenido a Ágora Plus!</h1>
<p>Hola {{userFirstname}},</p>
<p>Tu prueba gratuita de <strong>15 días</strong> se ha activado con éxito. Ahora tienes acceso total a nuestra base de datos transaccional y al <strong>Ágora Copilot</strong> impulsado por IA.</p>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}" style="background-color: #E05C50; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Comenzar en mi Dashboard
  </a>
</p>
<p>Recuerda que puedes explorar firmas asesoras, transacciones por industria y generar informes personalizados durante tu periodo de prueba sin costo alguno.</p>
<p>Saludos cordiales,<br><strong>Equipo Ágora Plus</strong></p>`
  },
  {
    type: 'REMINDER_TRIAL',
    subject: 'Aviso: Tu prueba gratuita de Ágora Plus finaliza en 3 días',
    htmlBody: `<h1>Tu prueba de Ágora Plus está por concluir</h1>
<p>Hola {{userFirstname}},</p>
<p>Esperamos que estés aprovechando al máximo la plataforma y las herramientas de analítica legal y financiera de Ágora Plus.</p>
<p>Te recordamos que en <strong>3 días</strong> finalizará tu periodo de prueba gratuita y se procesará automáticamente el cobro de tu suscripción mensual oficial a tu tarjeta registrada.</p>
<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #4b5563;">
    <strong>¿Deseas continuar disfrutando del servicio?</strong> No tienes que hacer nada, tu cuenta continuará activa sin interrupciones.<br><br>
    Si prefieres gestionar tu método de pago o cancelar antes del cobro para no generar cargos, puedes hacerlo desde tu panel de facturación:
  </p>
</div>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}/billing" style="background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Ver Mi Facturación y Métodos de Pago
  </a>
</p>
<p>Saludos,<br><strong>Equipo Ágora Plus</strong></p>`
  },
  {
    type: 'TRIAL_CANCELLED',
    subject: 'Confirmación: Tu prueba gratuita de Ágora Plus ha sido cancelada',
    htmlBody: `<h1>Tu suscripción de prueba ha sido cancelada</h1>
<p>Hola {{userFirstname}},</p>
<p>Te confirmamos que tu solicitud de cancelación ha sido procesada con éxito.</p>
<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="color: #166534; margin-top: 0;">Garantía de Cero Cargos</h3>
  <p style="color: #15803d; margin-bottom: 0; font-size: 14px;">
    Confirmamos que <strong>no se ha realizado ningún cobro</strong> y que tu método de pago registrado <strong>no recibirá ningún cargo futuro</strong>. Tu suscripción en Stripe ha quedado totalmente anulada.
  </p>
</div>
<p>Lamentamos verte partir. Si en el futuro deseas reactivar tu acceso a las transacciones de América Latina o al Copilot de Ágora, serás bienvenido nuevamente en cualquier momento.</p>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}" style="background-color: #4b5563; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 14px; display: inline-block;">
    Ir a Ágora Plus
  </a>
</p>
<p>Atentamente,<br><strong>Equipo Ágora Plus</strong></p>`
  },
  {
    type: 'PAYMENT_SUCCESS',
    subject: '¡Pago confirmado! Bienvenido a tu suscripción oficial de Ágora Plus PRO',
    htmlBody: `<h1>¡Tu suscripción PRO está oficialmente activa!</h1>
<p>Hola {{userFirstname}},</p>
<p>Te confirmamos que el cobro de tu membresía a <strong>Ágora Plus PRO</strong> ha sido procesado exitosamente tras culminar tu periodo de prueba.</p>
<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #111827;">Detalle de la Transacción</h3>
  <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; margin-bottom: 0;">
    <li><strong>Estado:</strong> Pagado con éxito</li>
    <li><strong>Plan:</strong> Suscripción Mensual Ágora Plus PRO</li>
    <li><strong>Acceso:</strong> Ilimitado a la plataforma y reportes analíticos</li>
  </ul>
</div>
<h3>Beneficios activos en tu cuenta:</h3>
<ul style="color: #374151; font-size: 14px; line-height: 1.6;">
  <li>Acceso completo a la base histórica de M&A, emisiones y financiamientos de América Latina.</li>
  <li>Consultas ilimitadas con <strong>Ágora Copilot (IA)</strong>.</li>
  <li>Rankings interactivos de firmas asesoras, abogados e industrias.</li>
  <li>Exportación de datos e informes de mercado personalizados.</li>
</ul>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}" style="background-color: #E05C50; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Acceder a mi Dashboard
  </a>
</p>
<p>Gracias por confiar en Ágora.<br><strong>Equipo Ágora Plus</strong></p>`
  },
  {
    type: 'DUNNING',
    subject: 'Acción requerida: Problema al procesar tu pago de Ágora Plus',
    htmlBody: `<h1>Hubo un problema con tu método de pago</h1>
<p>Hola {{userFirstname}},</p>
<p>Intentamos procesar el cargo correspondiente a tu suscripción de <strong>Ágora Plus</strong>, pero el banco emisor de tu tarjeta no autorizó la transacción.</p>
<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="color: #991b1b; margin: 0; font-size: 14px;">
    <strong>Para evitar la suspensión de tu acceso:</strong> por favor ingresa a tu panel de facturación y actualiza tu tarjeta o selecciona otro método de pago. Realizaremos un nuevo intento de cobro en las próximas horas.
  </p>
</div>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}/billing" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Actualizar Método de Pago Ahora
  </a>
</p>
<p>Si consideras que esto es un error de tu banco, te recomendamos contactarlos para autorizar cargos recurrentes de Ágora / Stripe.</p>
<p>Saludos,<br><strong>Equipo Ágora Plus</strong></p>`
  },
  {
    type: 'UPCOMING_RENEWAL',
    subject: 'Aviso: Tu suscripción a Ágora Plus se renovará en 3 días',
    htmlBody: `<h1>Aviso de próxima renovación mensual</h1>
<p>Hola {{userFirstname}},</p>
<p>Te informamos que en <strong>3 días</strong> se procesará la renovación automática de tu suscripción mensual a <strong>Ágora Plus PRO</strong>.</p>
<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
  <p style="margin: 0; font-size: 14px; color: #4b5563;">
    El cobro se realizará de forma automática a la tarjeta registrada en tu cuenta. No es necesario que realices ninguna acción para mantener tu servicio activo.<br><br>
    Si necesitas descargar tus facturas anteriores, actualizar tu método de pago o consultar los datos de tu suscripción, puedes hacerlo aquí:
  </p>
</div>
<p style="margin: 24px 0;">
  <a href="{{dashboardUrl}}/billing" style="background-color: #1f2937; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Gestionar Mi Facturación
  </a>
</p>
<p>Gracias por seguir formando parte de Ágora.<br><strong>Equipo Ágora Plus</strong></p>`
  }
]

async function seed() {
  console.log('🌱 Inicializando plantillas de correo en la base de datos...')
  for (const t of TEMPLATES) {
    const upserted = await prisma.emailTemplate.upsert({
      where: { type: t.type },
      create: {
        type: t.type,
        subject: t.subject,
        htmlBody: t.htmlBody
      },
      update: {
        subject: t.subject,
        htmlBody: t.htmlBody
      }
    })
    console.log(`✅ Plantilla '${upserted.type}' guardada con éxito.`)
  }
  console.log('🎉 Todas las plantillas han sido sincronizadas en PostgreSQL.')
}

seed().catch(console.error)
