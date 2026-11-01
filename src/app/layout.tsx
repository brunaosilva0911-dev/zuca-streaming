import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zuca.tv"),
  title: {
    default: "ZUCA — TV ao vivo e streaming sob demanda",
    template: "%s · ZUCA",
  },
  description:
    "ZUCA é a sua plataforma de TV ao vivo e vídeo sob demanda: canais abertos, esportes, filmes, notícias e infantil com guia de programação interativo, mini player flutuante e curadoria 100% familiar.",
  applicationName: "ZUCA",
  keywords: [
    "tv ao vivo",
    "streaming",
    "canais abertos",
    "epg",
    "guia de programação",
    "esportes ao vivo",
    "zuca",
  ],
  authors: [{ name: "ZUCA" }],
  creator: "ZUCA",
  publisher: "ZUCA",
  formatDetection: { telephone: false, address: false, email: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ZUCA",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "ZUCA",
    title: "ZUCA — TV ao vivo e streaming sob demanda",
    description:
      "Canais ao vivo, guia de programação com viagem no tempo, mini player flutuante e brilho ambiente cinematográfico.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZUCA — TV ao vivo e streaming",
    description: "A nova geração da televisão ao vivo, feita para toda a família.",
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23ff2e63'/%3E%3Cstop offset='1' stop-color='%237b5cff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='16' fill='url(%23g)'/%3E%3Ctext x='32' y='45' font-family='Arial Black,Arial' font-size='34' font-weight='900' fill='white' text-anchor='middle'%3EZ%3C/text%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body className="bg-zuca-void text-white antialiased">
        <Providers>
          <AppShell>
            <ErrorBoundary label="conteudo-principal">{children}</ErrorBoundary>
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
