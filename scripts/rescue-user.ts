import prisma from '../src/lib/prisma'
import { supabaseAdmin } from '../src/utils/supabase/admin'
import { Resend } from 'resend'

async function rescueUser() {
  const customerEmail = 'henryjinfantec2366@gmail.com'
  const customerName = 'Henry Infante'
  const stripeCustomerId = 'cus_V0kVZTYF39Ey10'
  const priceId = 'price_1TqKfkA8zDaMc9MaeJXZELz'
  // Trial expires on Oct 22, 2026 as seen in Stripe
  const trialEndsAt = new Date('2026-10-22T23:59:59.000Z')

  console.log(`\n🚀 Iniciando rescate para: ${customerEmail} (Customer: ${stripeCustomerId})...`)

  // 1. Verificar si ya existe en Prisma
  let dbUser = await prisma.user.findUnique({
    where: { email: customerEmail },
    include: { subscription: true }
  })

  let inviteUrl = ''
  let userId = dbUser?.id || ''

  // 2. Crear o resolver en Supabase Auth
  if (!dbUser) {
    console.log('1️⃣ Generando acceso en Supabase Auth...')
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: customerEmail,
    })

    if (linkError) {
      console.log('⚠️ generateLink(invite) arrojó error, verificando si ya existe en Supabase Auth:', linkError.message)
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      const existing = listData?.users?.find(u => u.email === customerEmail)
      
      if (existing) {
        userId = existing.id
        const { data: magicLinkData } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: customerEmail,
        })
        if (magicLinkData?.properties?.action_link) {
          inviteUrl = magicLinkData.properties.action_link
        }
      } else {
        throw new Error(`Error en Supabase Auth: ${linkError.message}`)
      }
    } else if (linkData.user) {
      userId = linkData.user.id
      inviteUrl = linkData.properties?.action_link || ''
    }

    if (!userId) throw new Error('No se pudo resolver el ID de usuario en Supabase')

    console.log(`✅ Usuario creado en Supabase Auth (UUID: ${userId})`)
    if (inviteUrl) console.log(`🔗 Magic Link generado: ${inviteUrl}`)

    // 3. Crear en Prisma
    console.log('2️⃣ Registrando usuario en la base de datos de Ágora (Prisma)...')
    dbUser = await prisma.user.create({
      data: {
        id: userId,
        email: customerEmail,
        name: customerName,
        role: 'USER',
        stripeCustomerId: stripeCustomerId,
      },
      include: { subscription: true }
    })
    console.log('✅ Usuario registrado exitosamente en PostgreSQL.')
  } else {
    console.log(`ℹ️ El usuario ya existía en Ágora (ID: ${dbUser.id}).`)
    // Generar un magic link actualizado
    const { data: magicLinkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: customerEmail,
    })
    if (magicLinkData?.properties?.action_link) {
      inviteUrl = magicLinkData.properties.action_link
    }
  }

  // 4. Crear o actualizar suscripción TRIAL en Prisma
  console.log('3️⃣ Configurando suscripción de 15 días (TRIAL)...')
  const subscription = await prisma.subscription.upsert({
    where: { userId: dbUser.id },
    create: {
      userId: dbUser.id,
      stripeSubscriptionId: 'sub_manual_synced',
      status: 'TRIAL',
      priceId: priceId,
      trialEndsAt: trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
    },
    update: {
      status: 'TRIAL',
      priceId: priceId,
      trialEndsAt: trialEndsAt,
      currentPeriodEnd: trialEndsAt,
      cancelAtPeriodEnd: false,
    }
  })
  console.log(`✅ Suscripción configurada: Estado ${subscription.status}, vence: ${subscription.trialEndsAt?.toISOString()}`)

  // 5. Enviar correo vía Resend
  console.log('4️⃣ Enviando correo con el Magic Link...')
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey || resendApiKey === 're_dummy') {
    console.log('\n⚠️ ATENCIÓN: Variable RESEND_API_KEY no encontrada en entorno local.')
    console.log('El usuario quedó 100% activo en Ágora y Supabase, pero el correo no pudo enviarse sin la llave.')
    console.log('👉 Puedes enviarle este enlace directamente a Henry para que entre de inmediato:')
    console.log(inviteUrl)
    return
  }

  try {
    const resend = new Resend(resendApiKey)
    const template = await prisma.emailTemplate.findUnique({ where: { type: 'WELCOME' }})
    const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.agora-lexlatin.com/dashboard'
    const subject = template?.subject || '¡Bienvenido a Ágora Plus PRO!'
    let html = template?.htmlBody || `<h1>¡Bienvenido a Ágora Plus!</h1><p>Hola {{userFirstname}},</p><p>Tu suscripción PRO se ha activado con éxito. Ahora tienes acceso total a nuestra base de datos y al <strong>Ágora Copilot</strong> impulsado por IA.</p><p><a href="{{dashboardUrl}}">Ir a mi Dashboard</a></p><p>Saludos,<br>Equipo Ágora Plus</p>`
    
    const finalUrl = inviteUrl ? inviteUrl : dashboardUrl
    html = html.replace(/{{userFirstname}}/g, customerName)
               .replace(/{{dashboardUrl}}/g, finalUrl)

    const emailRes = await resend.emails.send({
      from: 'Ágora Plus <soporte@agora-lexlatin.com>',
      to: [customerEmail],
      subject: subject,
      html: html,
    })

    console.log('📧 Correo enviado con éxito vía Resend:', emailRes)
  } catch (err: any) {
    console.error('❌ Error al enviar por Resend:', err.message)
    console.log('👉 Enlace directo generado:', inviteUrl)
  }
}

rescueUser().catch(console.error)
