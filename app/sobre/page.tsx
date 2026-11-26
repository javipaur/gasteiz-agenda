import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 3600;

export const metadata: Metadata = {
  // El layout ya añade «| Gasteiz Click»: repetir la marca aquí produce
  // «Sobre Gasteiz Click | Gasteiz Click» en la pestaña y en el SERP.
  title: "Sobre la agenda",
  description:
    "Qué es Gasteiz Click, qué puedes encontrar, fuentes de información y aviso de independencia respecto de entidades gubernamentales.",
  alternates: { canonical: "/sobre" },
};

const SECCIONES = [
  {
    titulo: "Hoy en Vitoria",
    detalle: "Descubre los planes disponibles para hoy.",
  },
  {
    titulo: "Recomendados",
    detalle: "Una selección de propuestas y actividades destacadas.",
  },
  {
    titulo: "Agenda cultural",
    detalle: "Conciertos, teatro, exposiciones, talleres y otros eventos.",
  },
  {
    titulo: "Cartelera",
    detalle: "Películas y horarios de los cines Florida y Boulevard.",
  },
  {
    titulo: "Deporte",
    detalle: "Carreras, competiciones y actividades deportivas.",
  },
  {
    titulo: "Senderismo",
    detalle: "Rutas y propuestas para disfrutar del entorno natural.",
  },
  {
    titulo: "Farmacias de guardia",
    detalle:
      "Consulta de los turnos publicados por el Colegio Oficial de Farmacéuticos de Álava.",
  },
  {
    titulo: "Tranvía",
    detalle: "Información de líneas, paradas y recorridos.",
  },
  {
    titulo: "Buscador",
    detalle: "Encuentra actividades por título, lugar o categoría.",
  },
];

const FUENTES_OFICIALES = [
  {
    nombre: "Ayuntamiento de Vitoria-Gasteiz",
    href: "https://www.vitoria-gasteiz.org/",
  },
  {
    nombre: "Agenda cultural municipal",
    href: "https://www.vitoria-gasteiz.org/wb021/was/we001Action.do?accion=calMunicipales&accionWe001=ficha&idioma=es",
  },
  {
    nombre: "Gobierno Vasco – Euskadi.eus",
    href: "https://www.euskadi.eus/",
  },
  {
    nombre: "Farmacias de guardia – Gobierno Vasco",
    href: "https://www.euskadi.eus/informacion/farmacias-de-guardia/web01-a2farbil/es/",
  },
  {
    nombre: "Colegio Oficial de Farmacéuticos de Álava",
    href: "https://cofalava.org/farmacias-de-guardia/",
  },
  {
    nombre: "Euskotren – Tranvía de Vitoria-Gasteiz",
    href: "https://www.euskotren.eus/es/tranvia",
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
          Gasteiz Click
        </h1>
        <p className="text-base md:text-lg text-fg-muted leading-relaxed mb-10 max-w-2xl">
          Descubre qué hacer en Vitoria-Gasteiz desde una sola aplicación. Gasteiz
          Click reúne información de distintas fuentes públicas y privadas para
          facilitar el acceso a los planes y actividades de la ciudad.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Qué puedes encontrar
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {SECCIONES.map((item) => (
                <li
                  key={item.titulo}
                  className="rounded-2xl border border-border bg-surface p-5"
                >
                  <h3 className="font-display text-base font-semibold text-fg mb-1.5">
                    {item.titulo}
                  </h3>
                  <p className="text-sm text-fg-muted leading-relaxed">
                    {item.detalle}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Fuentes de información
            </h2>
            <p className="text-base text-fg-muted leading-relaxed mb-4">
              Gasteiz Click es una plataforma independiente que recopila y organiza
              información procedente de diferentes fuentes. Entre las fuentes oficiales
              de consulta se encuentran:
            </p>
            <ul className="space-y-2">
              {FUENTES_OFICIALES.map((fuente) => (
                <li key={fuente.href} className="text-base text-fg-muted">
                  <a
                    href={fuente.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
                  >
                    {fuente.nombre}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-base text-fg-muted leading-relaxed mt-4">
              La información se muestra con fines informativos y puede estar sujeta a
              cambios. Para confirmar horarios, disponibilidad, servicios y posibles
              modificaciones, consulta siempre la fuente oficial correspondiente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Aviso legal y exención de responsabilidad
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-fg-muted">
              <p>
                Gasteiz Click es una aplicación independiente, desarrollada y
                gestionada por un particular. No pertenece, no está gestionada, no
                está patrocinada ni está afiliada al Ayuntamiento de Vitoria-Gasteiz,
                al Gobierno Vasco, a ninguna Administración pública ni a ningún
                organismo gubernamental.
              </p>
              <p>
                Gasteiz Click no representa a ninguna entidad gubernamental ni presta
                servicios administrativos oficiales. Su finalidad es exclusivamente
                informativa y consiste en facilitar el acceso a información pública y
                otras fuentes de interés.
              </p>
              <p>
                Los nombres y marcas de terceros pertenecen a sus respectivos
                titulares.
              </p>
              <p>
                Consulta también el{" "}
                <Link
                  href="/aviso-legal"
                  className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
                >
                  aviso legal
                </Link>
                , la{" "}
                <Link
                  href="/privacidad"
                  className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
                >
                  política de privacidad
                </Link>{" "}
                y la información sobre{" "}
                <Link
                  href="/eliminar-datos"
                  className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
                >
                  eliminación de datos
                </Link>
                .
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-4">
              Contacto
            </h2>
            <p className="text-base text-fg-muted leading-relaxed mb-4">
              ¿Tienes un evento que debería estar aquí, has encontrado un error o
              necesitas contactar por motivos legales o de privacidad?
            </p>
            <a
              href="mailto:javipaur@gmail.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-colors duration-300"
            >
              javipaur@gmail.com
            </a>
          </section>

          <section className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-[0.15em] text-accent hover:text-accent-hover transition-colors"
            >
              Volver al inicio
              <svg
                className="w-4 h-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </section>
        </div>
      </div>
    </article>
  );
}