import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, DM_Serif_Display, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { FavoritesProvider } from "./context/FavoritesContext";
import { ToastProvider } from "./context/ToastContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import ScrollToTop from "./components/ScrollToTop";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import Analytics from "./components/Analytics";
import Metricas from "./components/Metricas";
import CookieConsent from "./components/CookieConsent";
import { JsonLd, graphJsonLd, organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
import { getAccentSeason } from "@/lib/season";
import "./globals.css";

/**
 * Las tres tipografías, y cada una con su papel.
 *
 * **Bodoni Moda** es la del logotipo y los titulares de sección: una Didone de
 * contraste alto, que es la que le da a la marca el aire de "editorial" en vez de
 * "app de agenda". Su peso es 500 y no más: por encima, el trazo se hace pesado y
 * deja de ser elegante.
 *
 * **DM Serif Display** es solo para el titular gigante de las tarjetas. Se separa de
 * Bodoni a propósito porque pesa más y ocupa mucho más, y porque dos serif con el
 * mismo rol se pelean: si las dos titles hicieran lo mismo, una sobra.
 *
 * **Instrument Sans** es todo lo demás: interfaz, etiquetas, cuerpo. Es una sans
 * geométrica de trazo medio que aguanta bien textos largos en tamaño pequeño, que es
 * donde está la mayor parte del texto de esta web.
 *
 * El nombre de la variable de cada una es `--font-display`, `--font-titular` y
 * `--font-body`, y son las que lee `app/globals.css`. El cambio de una a otra no
 * toca ningún componente: es el mismo razonamiento que con los tokens de color, y
 * por eso está en `globals.css` y no esparcido por los JSX.
 */
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  display: "swap",
  weight: ["500"],
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dmserif",
  display: "swap",
  weight: "400",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

/**
 * JetBrains Mono se queda, y no por nostalgia: hay sitios donde las cifras tienen
 * que alinear en columna —las líneas de bus, los números de parada, la tabla de
 * horarios— y una sans proporcional las descuadra. En el resto de la web es la
 * etiqueta en caja alta, que en mono se lee como "dato".
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gasteiz Click · Agenda cultural de Vitoria-Gasteiz",
    template: "%s | Gasteiz Click",
  },
  description:
    "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
  metadataBase: new URL("https://gasteizclick.javierpalacio.es"),
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: "Gasteiz Click",
    title: "Gasteiz Click · Agenda cultural de Vitoria-Gasteiz",
    description:
      "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gasteiz Click · Agenda cultural de Vitoria-Gasteiz",
    description:
      "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
    images: ["/opengraph-image"],
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
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
        color: "#B3203F",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F3E8" },
    { media: "(prefers-color-scheme: dark)", color: "#16160F" },
  ],
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
      data-accent={getAccentSeason()}
      className={`${bodoni.variable} ${dmSerif.variable} ${instrument.variable} ${jetbrainsMono.variable}`}
      /* El script de abajo escribe `data-theme` en `<html>` antes de que hidrate, y el
         servidor no lo pone: sin esto React avisa de un mismatch en cada carga y
         descarta el atributo sin arreglarlo. **Es la solución documentada para un script
         inline que escribe un atributo antes de hidratar** y no un silencio: el atributo
         se sigue aplicando —sin él la página daría un flash del tema contrario—, solo
         deja de ser un attrs que React tenga que comparar. Si algún día desaparece, el
         síntoma es un aviso de hidratación y un posible flash de tema. */
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            /* El script de tema. Es el que decide la paleta antes de que hidrate,
               y por eso va en el `<head>` y no en un componente.
               Los tres estados que hay:
               - `"dark"` / `"light"`: lo que eligió la persona. Se aplica tal cual.
               - `"auto"`: lo que marque el sistema. **No** se pone atributo, y la
                 paleta la decide el CSS —la media query de `globals.css`— que además
                 sigue al sistema mientras la pestaña esté abierta.
               - Nada guardado: el valor por defecto del sitio, que es claro.

               El `"auto"` es lo que se rompió al pasar la paleta a "claro por
               defecto": antes el script resolvía la preferencia del sistema con
               `matchMedia` y se quedaba escuchando sus cambios. Se hardcodeó el
               "light" y el `ThemeToggle` seguía ofreciendo "Tema del sistema", que
               no hacía nada: el botón decía una cosa y la página hacía otra.

               Y `removeAttribute` y no `dataset.theme = ""`: dejar el atributo
               vacío lo hace *no* casar con `:root:not([data-theme="dark"])`, que
               es la regla que decide el tema del sistema. */
            __html: `(function(){var K="gasteiz-theme";try{function apply(){try{var v=localStorage.getItem(K);if(v==="dark"||v==="light"){document.documentElement.dataset.theme=v;return}if(v==="auto"){document.documentElement.removeAttribute("data-theme");return}document.documentElement.dataset.theme="light"}catch(e){}}apply();window.addEventListener("storage",apply)}catch(e){}})();`,
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <JsonLd data={graphJsonLd(webSiteJsonLd(), organizationJsonLd())} />
      </head>
      <body className="bg-bg text-fg antialiased">
        <ServiceWorkerRegistration />
        <Analytics />
        <Metricas />
        <FavoritesProvider>
          <ToastProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none"
          >
            Saltar al contenido principal
          </a>
          <Header />
          <main id="main-content" className="min-h-[100dvh] overflow-x-clip">{children}</main>
          <Footer />
          <BottomNav />
          <div
            aria-hidden="true"
            className="md:hidden"
            style={{ height: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
          />
          <ScrollToTop />
          <CookieConsent />
          </ToastProvider>
        </FavoritesProvider>
      </body>
    </html>
  );
}
