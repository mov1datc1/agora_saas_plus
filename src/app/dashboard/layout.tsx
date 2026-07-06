import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import DunningBanner from "./DunningBanner";
import { redirect } from 'next/navigation';
import UnderConstruction from '@/components/layout/UnderConstruction';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let userRole = 'USER';
  let subscriptionStatus = 'INCOMPLETE';
  let userName = 'Usuario';
  let accountType = 'INDIVIDUAL';
  let parentId: string | null = null;

  if (user?.email) {
    const dbUser = await prisma.user.findUnique({ 
      where: { email: user.email },
      include: { subscription: true }
    });
    if (dbUser?.isActive === false) {
      redirect('/deactivated')
    }
    userRole = dbUser?.role || 'USER';
    
    // Auto-upgrade admins to SUPERADMIN if needed (Migration fallback)
    if (dbUser && userRole === 'ADMIN' && (dbUser.email === 'palacios.jenrique@gmail.com' || dbUser.email === 'admin@lexlatin.com')) {
      await prisma.user.update({ where: { email: dbUser.email }, data: { role: 'SUPERADMIN' } });
      userRole = 'SUPERADMIN';
    }
    if (dbUser?.subscription) {
      subscriptionStatus = dbUser.subscription.status;
    }
    userName = dbUser?.name || user.email.split('@')[0];
    accountType = dbUser?.accountType || 'INDIVIDUAL';
    parentId = dbUser?.parentId || null;
  }

  const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
  
  if (config?.maintenanceModeEnabled && userRole !== 'SUPERADMIN' && userRole !== 'ADMIN') {
    return (
      <div className="h-full w-full bg-[#0a0a0a] text-white">
        <UnderConstruction />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex bg-background">
      <Sidebar userRole={userRole} accountType={accountType} parentId={parentId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DunningBanner status={subscriptionStatus} />
        <Header userName={userName} />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
