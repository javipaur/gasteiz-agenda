import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, JetBrains_Mono } from "next/font/google";
import { FavoritesProvider } from "./context/FavoritesContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import Analytics from "./components/Analytics";
import { JsonLd, graphJsonLd, organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-work-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gasteiz Click — Agenda cultural de Vitoria-Gasteiz",
    template: "%s | Gasteiz Click",
  },
  description:
    "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
  metadataBase: new URL("https://gasteizclick.javierpalacio.es"),
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "Gasteiz Click",
    title: "Gasteiz Click — Agenda cultural de Vitoria-Gasteiz",
    description:
      "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gasteiz Click — Agenda cultural de Vitoria-Gasteiz",
    description:
      "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gasteiz Click",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-512.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      {
        rel: "mask-icon",
        url: "/icon-maskable.svg",
        color: "#C94A3D",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#C94A3D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${workSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <JsonLd data={graphJsonLd(webSiteJsonLd(), organizationJsonLd())} />
      </head>
      <body className="bg-bg text-fg antialiased">
        <ServiceWorkerRegistration />
        <Analytics />
        <FavoritesProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none"
          >
            Saltar al contenido principal
          </a>
          <Header />
          <main id="main-content" className="min-h-[100dvh]">{children}</main>
          <Footer />
          <ScrollToTop />
        </FavoritesProvider>
      </body>
    </html>
  );
}
