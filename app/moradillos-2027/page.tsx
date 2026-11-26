import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { propsImagen } from "@/lib/image-proxy";
import {
  MORADILLOS_2027,
  descripcionMoradillos,
  resumenMoradillos,
} from "@/lib/moradillos-2027";

// La metadata y la prosa leen el mismo objeto que la ficha. Escritas a mano,
// un cambio en el cartel o en las fechas dejaría dos sitios diciendo cosas
// distintas sin que ningún test ni ningún build lo notara.
export const metadata: Metadata = {
  title: MORADILLOS_2027.titulo,
  description: descripcionMoradillos(),
  alternates: { canonical: MORADILLOS_2027.sede },
};

const enlaces = [
  { texto: "Entradas", href: MORADILLOS_2027.entradas },
  { texto: "Sala de prensa", href: MORADILLOS_2027.origen },
  { texto: "Instagram del festival", href: MORADILLOS_2027.instagram },
];

export default function Moradillos2027() {
  // Son rutas locales fijas, pero pasan por la puerta común: `propsImagen`
  // decide el `quality` y el `unoptimized`, y aqui no se puede olvidar ninguno.
  const cartel = propsImagen(MORADILLOS_2027.imagenes.cartel);
  const directo = propsImagen(MORADILLOS_2027.imagenes.directo);
  const publico = propsImagen(MORADILLOS_2027.imagenes.publico);
  if (!cartel || !directo || !publico) return null;

  return (
    <div className="px-5 sm:px-6 pt-28 md:pt-32 pb-24 max-w-5xl mx-auto">
      <header className="mb-10 md:mb-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          Difusión editorial
        </p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold text-fg tracking-[-0.02em]">
          {MORADILLOS_2027.titulo}
        </h1>
        <p className="mt-4 text-lg text-fg-muted max-w-2xl leading-relaxed">
          {MORADILLOS_2027.fechas} · {MORADILLOS_2027.destino}. Con{" "}
          {MORADILLOS_2027.carteles} y una programación de{" "}
          {MORADILLOS_2027.generos}.
        </p>
        <p className="mt-3 text-sm text-fg-subtle max-w-2xl leading-relaxed">
          Esta ficha es difusión editorial: recogemos la información pública del
          festival. No es un plan de la agenda de Vitoria-Gasteiz ni una
          recomendación propia.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-8 md:gap-10 items-start">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <Image
            {...cartel}
            alt={`Cartel de ${MORADILLOS_2027.titulo}`}
            width={1600}
            height={1600}
            className="w-full h-auto rounded-xl"
            priority
          />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="font-display text-xl text-fg mb-3">El festival</h2>
            <p className="text-fg-muted leading-relaxed">{resumenMoradillos()}</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface/60 p-5">
            <h2 className="font-display text-xl text-fg mb-4">Datos prácticos</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-fg-subtle">Fechas</dt>
                <dd className="mt-1 text-fg font-medium">{MORADILLOS_2027.fechas}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Lugar</dt>
                <dd className="mt-1 text-fg font-medium">{MORADILLOS_2027.destino}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Cartel</dt>
                <dd className="mt-1 text-fg font-medium">{MORADILLOS_2027.carteles}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Géneros</dt>
                <dd className="mt-1 text-fg font-medium">{MORADILLOS_2027.generos}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-3">
            {enlaces.map((enlace) => (
              <a
                key={enlace.texto}
                href={enlace.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border px-4 py-2 text-sm text-fg hover:border-brand-red/50 hover:text-brand-red transition-colors"
              >
                {enlace.texto} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-12 md:mt-16">
        <h2 className="font-display text-xl text-fg mb-4">Imágenes del festival</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Image
            {...directo}
            alt="Músico actuando en directo en Moradillos Fest"
            width={683}
            height={1024}
            className="w-full h-auto rounded-2xl border border-border"
          />
          <Image
            {...publico}
            alt="Público y escenario en Moradillos Fest"
            width={682}
            height={1024}
            className="w-full h-auto rounded-2xl border border-border"
          />
        </div>
        <p className="mt-4 text-sm text-fg-subtle">
          Material publicado en la{" "}
          <Link href={MORADILLOS_2027.origen} className="underline hover:text-brand-red">
            sala de prensa de Moradillos Fest
          </Link>
          . Para uso editorial, con crédito al festival.
        </p>
      </section>
    </div>
  );
}
