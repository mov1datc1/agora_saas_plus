import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ágora | Inteligencia Transaccional",
  description: "Detecta oportunidades de negocio antes de que el mercado las vea.",
  icons: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      url: '/favicon.svg',
    },
  ],
};

import { AuthListener } from "@/components/auth/AuthListener";
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google'
import prisma from '@/lib/prisma'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } })

  return (
    <html lang="es" className="h-full bg-background antialiased">
      <body className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        <AuthListener />
        {children}
      </body>
      {config?.gaMeasurementId && <GoogleAnalytics gaId={config.gaMeasurementId} />}
      {config?.gtmMeasurementId && <GoogleTagManager gtmId={config.gtmMeasurementId} />}
    </html>
  );
}
