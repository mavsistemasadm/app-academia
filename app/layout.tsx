import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { RegistrarServiceWorker } from "@/components/shared/RegistrarServiceWorker";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Central de Saúde Conectada",
    template: "%s · Central de Saúde Conectada",
  },
  description:
    "Acompanhamento de treino, indicadores clínicos e medicamentos — você cuidado todos os dias pelo centro de treinamento.",
  applicationName: "Central de Saúde Conectada",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Saúde Conectada",
  },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icones/icone-192.png",
    apple: "/icones/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
