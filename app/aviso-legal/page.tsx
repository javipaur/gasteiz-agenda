import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aviso legal",
  description:
    "Términos de uso, titularidad y condiciones de Gasteiz Click, la agenda cultural de Vitoria-Gasteiz.",
  alternates: { canonical: "/aviso-legal" },
};

export default function AvisoLegalPage() {
  return (
    <article className="px-5 sm:px-6 pt-28 pb-24 md:pt-32">
      <div className="max-w-2xl mx-auto">
        <nav aria-label="Migas de pan" className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-fg-subtle">
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
          Última actualización · septiembre 2026
        </p>

        <div className="space-y-8 text-base leading-relaxed text-fg-muted">
          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Titular del sitio</h2>
            <p>
              El sitio web <strong className="text-fg font-medium">Gasteiz Click</strong> es un
              proyecto personal e independiente sobre la agenda cultural de
              Vitoria-Gasteiz. Para cualquier consulta puedes escribir a{" "}
              <a href="mailto:hola@javierpalacio.es" className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border">
                hola@javierpalacio.es
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Finalidad del sitio</h2>
            <p>
              La finalidad de Gasteiz Click es divulgar la oferta cultural, de ocio
              y deportiva de Vitoria-Gasteiz mediante la agregación de fuentes
              públicas. La información se ofrece con carácter orientativo y se
              actualiza de forma periódica, pero no se garantiza su exactitud o
              disponibilidad en todo momento.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Propiedad intelectual</h2>
            <p>
              Los textos y la selección y ordenación de contenidos de este sitio
              son originales del titular. Las marcas, imágenes y logotipos que
              aparecen pertenecen a sus respectivos titulares y se utilizan
              únicamente con fines informativos. Queda prohibida la reproducción,
              distribución o comunicación pública de los contenidos sin
              autorización, salvo cita con indicación de la fuente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Responsabilidad y enlaces externos</h2>
            <p>
              Gasteiz Click enlaza a sitios externos (ayuntamiento, salas, medios
              locales y plataformas de venta de entradas) a través de los que se
              gestiona la compra y confirmación de cada actividad. El titular no se
              hace responsable del contenido, políticas o servicios de esos sitios,
              ni de los cambios o cancelaciones de los eventos publicados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Legislación aplicable</h2>
            <p>
              Este aviso legal se rige por la legislación española. Para cualquier
              controversia, ambas partes se someten a los juzgados y tribunales de
              Vitoria-Gasteiz. Puedes consultar cómo tratamos tus datos en{" "}
              <Link href="/privacidad" className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border">
                la política de privacidad
              </Link>.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}