import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Sora } from "next/font/google";

import { RegistrarServiceWorker } from "@/components/shared/RegistrarServiceWorker";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Títulos e números. A geometria arredondada conversa com o letreiro da logo.
const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

// Horários, unidades e rótulos técnicos.
const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
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
  themeColor: "#F3F6F6",
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
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
