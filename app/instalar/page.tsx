import type { Metadata } from "next";
import InstallGuide from "./InstallGuide";

export const metadata: Metadata = {
  // Sin la marca: la plantilla de `app/layout.tsx` ya añade " | Gasteiz Click".
  title: "Instalar la app",
  description: "Añade Gasteiz Click a la pantalla de inicio: icono, sin barra de navegador y funciona sin cobertura. Instrucciones para iPhone, Android y cualquier navegador.",
  // Página de utilidad, no contenido. Es lo mismo que hace `app/offline`: fuera
  // del índice, pero con `follow` para que quien llega desde el menú pueda
  // seguir los enlaces que hay dentro.
  robots: { index: false, follow: true },
};

export default function Instalar() {
  return (
    // `pt-28` y no `py-12`, y no es una preferencia de espaciado: la `Header` es
    // fija y se lleva por delante los primeros píxeles de la página. Con `py-12`
    // el H1 quedaba medio tapado — se vio renderizando, no leyendo el código—.
    // Es el mismo motivo y el mismo valor que usan el resto de páginas; el
    // comentario largo está en `app/hoy/page.tsx`.
    <div className="px-5 sm:px-6 pt-28 md:pt-32 pb-24 max-w-3xl mx-auto">
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg tracking-[-0.02em]">
          Instala Gasteiz Click
        </h1>
        <p className="text-fg-muted leading-relaxed mt-3 max-w-xl">
          Un icono en la pantalla de inicio, se abre sin barra de navegador y
          sigue funcionando cuando no hay cobertura.
        </p>
      </header>

      <InstallGuide />
    </div>
  );
}