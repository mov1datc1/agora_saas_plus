import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PowerOff } from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export default async function DeactivatedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6">
      <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-6 text-center">
        <div className="flex flex-col items-center space-y-2">
          <div className="rounded-full bg-red-500/10 p-4 mb-4 ring-1 ring-red-500/20">
            <PowerOff className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cuenta Desactivada
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu acceso a la plataforma ha sido suspendido o tu periodo de prueba/suscripción manual ha finalizado. 
            Por favor comunícate con el equipo de soporte de LexLatin para reactivar tu cuenta.
          </p>
        </div>
        
        <div className="mt-8 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
