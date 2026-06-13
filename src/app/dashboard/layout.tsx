import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/prisma";
import DunningBanner from "./DunningBanner";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdmin = false;
  let subscriptionStatus = 'INCOMPLETE';
  let userName = 'Usuario';

  if (user?.email) {
    const dbUser = await prisma.user.findUnique({ 
      where: { email: user.email },
      include: { subscription: true }
    });
    if (dbUser?.role === 'ADMIN') {
      isAdmin = true;
    }
    if (dbUser?.subscription) {
      subscriptionStatus = dbUser.subscription.status;
    }
    userName = dbUser?.name || user.email.split('@')[0];
  }

  return (
    <div className="h-full overflow-hidden flex bg-background">
      <Sidebar isAdmin={isAdmin} />
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
