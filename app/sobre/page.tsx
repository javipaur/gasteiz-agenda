import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sobre Gasteiz Click · Metodología y fuentes",
  description:
    "Gasteiz Click es la agenda cultural de Vitoria-Gasteiz: conciertos, teatro, cine, deporte y planes familiares, actualizados cada día a partir de fuentes oficiales y verificadas.",
  alternates: { canonical: "/sobre" },
};

const FUENTES = [
  {
    nombre: "Ayuntamiento de Vitoria-Gasteiz",
    detalle: "Agenda municipal, centros cívicos, BIZAN y programación cultural oficial.",
  },
  {
    nombre: "Gobierno Vasco / Euskadi.eus",
    detalle: "Cultura, exposiciones y actividades institucionales.",
  },
  {
    nombre: "Salas y programadores locales",
    detalle: "Jimmy Jazz, HellDorado, Musikaze, VAM Cultura, La Genterula y otros.",
  },
  {
    nombre: "Fiestas de la Virgen Blanca",
    detalle: "Programa oficial completo de La Blanca durante la temporada.",
  },
  {
    nombre: "Cines de Vitoria",
    detalle: "Cines Florida y Yelmo Cines Boulevard: cartelera y horarios.",
  },
];

export default function SobrePage() {
  return (
    <article className="px-5 sm:px-6 pt-28 md:pt-32 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
          <span className="font-display italic text-accent text-sm">Vitoria-Gasteiz</span>
        </div>
        <h1 className="font-display text-3xl md:text-5xl text-fg font-semibold tracking-[-0.03em] leading-[1.05] mb-6">
          La agenda cultural
          <br />
          que mira a Vitoria-Gasteiz
        </h1>
        <p className="text-base md:text-lg text-fg-muted leading-relaxed mb-12 max-w-2xl">
          Gasteiz Click reúne en un solo lugar todo lo que pasa en la ciudad:
          conciertos, teatro, exposiciones, cine, deporte y planes familiares.
          Sin ruido, ordenado por días y siempre al día.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Cómo trabajamos
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-fg-muted">
              <p>
                Cada día recopilamos y comprobamos la programación de la ciudad
                desde fuentes públicas. Cada evento incluye fecha, lugar y un
                enlace a la fuente original para que siempre puedas confirmar
                horarios y comprar entradas donde corresponde.
              </p>
              <p>
                Cuando una actividad cambia o se cancela, lo reflejamos lo antes
                posible. Si encuentras algo desactualizado, puedes avisarnos y
                lo corregimos.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Nuestras fuentes
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {FUENTES.map((f) => (
                <li
                  key={f.nombre}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <h3 className="font-display text-base font-semibold text-fg mb-1.5">
                    {f.nombre}
                  </h3>
                  <p className="text-sm text-fg-muted leading-relaxed">
                    {f.detalle}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Contacto
            </h2>
            <p className="text-base text-fg-muted leading-relaxed mb-4">
              ¿Tienes un evento que debería estar aquí o has encontrado un
              error? Escríbenos y lo revisamos.
            </p>
            <a
              href="mailto:hola@javierpalacio.es"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-colors duration-300"
            >
              hola@javierpalacio.es
            </a>
          </section>

          <section className="pt-4">
            <Link
              href="/culture"
              className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-[0.15em] text-accent hover:text-accent-hover transition-colors"
            >
              Ver la agenda
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </section>
        </div>
      </div>
    </article>
  );
}