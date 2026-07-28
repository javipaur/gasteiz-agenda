import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, JetBrains_Mono } from "next/font/google";
import { FavoritesProvider } from "./context/FavoritesContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
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
    images: [
      {
        url: "/icon-512.svg",
        width: 512,
        height: 512,
        alt: "Gasteiz Click",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gasteiz Click — Agenda cultural de Vitoria-Gasteiz",
    description:
      "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
    images: ["/icon-512.svg"],
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
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
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
      </head>
      <body className="bg-bg text-fg antialiased">
        <ServiceWorkerRegistration />
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
