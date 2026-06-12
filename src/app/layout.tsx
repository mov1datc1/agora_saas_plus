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
  title: "Ágora Plus | Inteligencia Transaccional",
  description: "Detecta oportunidades de negocio antes de que el mercado las vea.",
};

import { AuthListener } from "@/components/auth/AuthListener";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full bg-background antialiased">
      <body className={`${geistSans.variable} ${geistMono.variable} h-full`}>
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
