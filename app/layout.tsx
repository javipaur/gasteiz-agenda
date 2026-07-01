import { Fraunces, Work_Sans, JetBrains_Mono } from "next/font/google";
import { FavoritesProvider } from "./context/FavoritesContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
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

export const metadata = {
  title: "Gasteiz Click — Agenda cultural de Vitoria-Gasteiz",
  description:
    "Descubre conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.",
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
      <body className="bg-bg text-fg antialiased">
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
        </FavoritesProvider>
      </body>
    </html>
  );
}
