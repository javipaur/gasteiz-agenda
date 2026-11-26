import Image from "next/image";
import Link from "next/link";

import { MORADILLOS_2027 } from "@/lib/moradillos-2027";
import { propsImagen } from "@/lib/image-proxy";

/**
 * Un bloque pequeño, no una sección más de la agenda. Moradillos es un festival
 * de otra comunidad con una fecha concreta: tiene su ficha y su enlace, y no
 * entra en el registro de 28 fuentes ni en el contador de planes de Vitoria.
 */
export default function Moradillos2027Strip() {
  // Es una imagen local y fija, pero pasa por la misma puerta que las de la
  // agenda: así el `quality` y el `unoptimized` tienen un solo dueño y este
  // fichero no puede quedarse con una prop olvidada.
  const imagen = propsImagen(MORADILLOS_2027.imagenes.cartel);
  if (!imagen) return null;

  return (
    <section className="px-5 sm:px-6 py-8 md:py-10 max-w-7xl mx-auto">
      <Link
        href={MORADILLOS_2027.sede}
        className="group flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-border bg-surface/60 p-4 sm:p-5 transition-colors hover:border-brand-red/40"
      >
        <Image
          {...imagen}
          alt="Cartel de Moradillos Fest 2027"
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            Difusión editorial
          </p>
          <h2 className="mt-1 font-display text-xl leading-snug sm:text-2xl">
            {MORADILLOS_2027.titulo} · {MORADILLOS_2027.fechas}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {MORADILLOS_2027.destino} · {MORADILLOS_2027.carteles}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-brand-red group-hover:underline">
          Ver la ficha →
        </span>
      </Link>
    </section>
  );
}
