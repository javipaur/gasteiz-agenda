import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso legal",
  description:
    "Aviso legal, condiciones de uso e independencia de Gasteiz Click respecto de entidades gubernamentales.",
  alternates: { canonical: "/aviso-legal" },
};

export default function AvisoLegalPage() {
  return (
    <article className="px-5 sm:px-6 pt-28 pb-24 md:pt-32">
      <div className="max-w-2xl mx-auto">
        <nav
          aria-label="Migas de pan"
          className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-fg-subtle"
        >
          <Link href="/" className="hover:text-accent transition-colors">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-fg-muted">Aviso legal</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg leading-tight tracking-[-0.02em] mb-3">
          Aviso legal
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-fg-subtle mb-10">
          Última actualización · noviembre 2026
        </p>

        <div className="space-y-8 text-base leading-relaxed text-fg-muted">
          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Titular y contacto</h2>
            <p>
              <strong className="text-fg font-medium">Gasteiz Click</strong> es un
              proyecto personal e independiente, desarrollado y gestionado por un
              particular, con finalidad informativa sobre actividades y servicios de
              interés local en Vitoria-Gasteiz.
            </p>
            <p className="mt-3">
              Contacto:{" "}
              <a
                href="mailto:javipaur@gmail.com"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                javipaur@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">
              Independencia y ausencia de afiliación gubernamental
            </h2>
            <p>
              Gasteiz Click no pertenece, no está gestionada, no está patrocinada ni
              está afiliada al Ayuntamiento de Vitoria-Gasteiz, al Gobierno Vasco, a
              ninguna Administración pública ni a ningún organismo gubernamental.
            </p>
            <p className="mt-3">
              Gasteiz Click no representa a ninguna entidad gubernamental ni presta
              servicios administrativos oficiales. Su finalidad es facilitar el acceso
              a información pública y otras fuentes de interés con carácter informativo.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Finalidad y alcance de la información</h2>
            <p>
              El sitio recopila y organiza información procedente de distintas fuentes
              para facilitar la consulta de planes, actividades y servicios de la
              ciudad. La información se ofrece con carácter orientativo y puede estar
              sujeta a cambios, errores o indisponibilidad temporal.
            </p>
            <p className="mt-3">
              Para confirmar horarios, disponibilidad, servicios, precios, condiciones
              o posibles modificaciones, consulta siempre la fuente oficial o el
              organizador correspondiente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Propiedad intelectual y marcas</h2>
            <p>
              Los textos propios y la selección y ordenación de contenidos de este
              sitio son del titular, salvo que se indique lo contrario. Las marcas,
              nombres comerciales, logotipos e imágenes de terceros pertenecen a sus
              respectivos titulares y se utilizan únicamente con fines informativos o
              de identificación.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Enlaces externos y responsabilidad</h2>
            <p>
              Gasteiz Click puede enlazar a sitios externos (fuentes oficiales, salas,
              medios, organizadores o plataformas de terceros). El titular no se hace
              responsable del contenido, disponibilidad, políticas o servicios de esos
              sitios, ni de cambios, cancelaciones o incidencias en las actividades o
              servicios publicados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Privacidad y legislación aplicable</h2>
            <p>
              El tratamiento de datos se describe en la{" "}
              <Link
                href="/privacidad"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                política de privacidad
              </Link>
              . Este aviso legal se rige por la legislación española. Para cualquier
              controversia, las partes se someten a los juzgados y tribunales de
              Vitoria-Gasteiz, salvo normativa imperativa aplicable.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}