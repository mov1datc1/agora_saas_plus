import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PowerOff, ShieldAlert, Clock, Mail, CreditCard } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";
import prisma from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DeactivatedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    include: {
      subscription: true,
      parent: {
        include: { subscription: true }
      }
    }
  });

  const effectiveSub = dbUser?.parentId ? dbUser?.parent?.subscription : dbUser?.subscription;
  const isCanceled = effectiveSub?.status === 'CANCELED';
  const isTrialExpired = effectiveSub?.status === 'TRIAL' && effectiveSub.trialEndsAt && new Date(effectiveSub.trialEndsAt) < new Date();

  let title = "Cuenta Desactivada";
  let description = "Tu acceso a la plataforma ha sido suspendido. Por favor comunícate con el equipo de soporte de LexLatin para reactivar tu cuenta.";
  let badgeLabel = "Acceso Suspendido";
  let IconComponent = PowerOff;
  let iconBg = "bg-red-500/10 text-red-600 ring-red-500/20";

  if (isCanceled) {
    title = "Suscripción Cancelada";
    description = "Tu suscripción a Ágora Plus ha sido cancelada exitosamente y no se realizará ningún cargo futuro. Por este motivo, tu acceso a la plataforma de inteligencia transaccional ha finalizado. Si deseas reactivar tu plan, ponte en contacto con nuestro equipo.";
    badgeLabel = "Suscripción Finalizada";
    IconComponent = ShieldAlert;
    iconBg = "bg-rose-500/10 text-rose-600 ring-rose-500/20";
  } else if (isTrialExpired) {
    title = "Periodo de Prueba Finalizado";
    description = "Tu periodo de prueba gratuita de 15 días ha concluido. Para continuar explorando las operaciones de M&A, financiamientos, emisiones y Ágora Copilot, por favor activa tu suscripción oficial.";
    badgeLabel = "Prueba Concluida";
    IconComponent = Clock;
    iconBg = "bg-amber-500/10 text-amber-600 ring-amber-500/20";
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6">
      <div className="mx-auto flex w-full max-w-[460px] flex-col justify-center space-y-6 text-center">
        <div className="flex flex-col items-center space-y-3">
          <div className={`rounded-full p-4 ring-1 ${iconBg}`}>
            <IconComponent className="h-10 w-10" />
          </div>
          <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted">
            {badgeLabel}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          {(isCanceled || isTrialExpired) && (
            <Link
              href={`/api/public-checkout?email=${encodeURIComponent(user.email || '')}&noTrial=true`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E05C50] px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#c94b40] transition-all hover:scale-[1.01]"
            >
              <CreditCard className="w-4 h-4" />
              Suscribirme con Plan Oficial
            </Link>
          )}
          <a
            href={`mailto:soporte@agora-lexlatin.com?subject=${encodeURIComponent(`Consulta sobre suscripción - ${user.email}`)}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contactar a Soporte
          </a>
          <div className="flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
