import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

export const dynamic = 'force-dynamic';

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
      <head>
        {config?.gtmMeasurementId && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${config.gtmMeasurementId}');`,
            }}
          />
        )}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        {config?.gtmMeasurementId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${config.gtmMeasurementId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            ></iframe>
          </noscript>
        )}
        {config?.gaMeasurementId && <GoogleAnalytics gaId={config.gaMeasurementId} />}
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
