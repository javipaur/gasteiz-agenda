import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Cómo tratamos los datos en Gasteiz Click: newsletter, favoritos, notificaciones push y analítica.",
};

export default function PrivacidadPage() {
  return (
    <article className="px-5 sm:px-6 pt-28 pb-24 md:pt-32">
      <div className="max-w-2xl mx-auto">
        <nav aria-label="Migas de pan" className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-fg-subtle">
          <Link href="/" className="hover:text-accent transition-colors">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-fg-muted">Privacidad</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-bold text-fg leading-tight tracking-[-0.02em] mb-3">
          Privacidad
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-fg-subtle mb-10">
          Última actualización · agosto 2026
        </p>

        <div className="space-y-8 text-base leading-relaxed text-fg-muted">
          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Responsable</h2>
            <p>
              Gasteiz Click es un proyecto personal e independiente sobre la agenda
              cultural de Vitoria-Gasteiz. Para cualquier cuestión sobre tus datos
              puedes escribir a{" "}
              <a href="mailto:hola@javierpalacio.es" className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border">
                hola@javierpalacio.es
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Qué datos tratamos</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-fg font-medium">Newsletter.</strong> Si te suscribes,
                guardamos tu email para enviarte un resumen semanal con doble
                confirmación (double opt-in). Puedes darte de baja desde el enlace
                de cualquier email.
              </li>
              <li>
                <strong className="text-fg font-medium">Favoritos.</strong> Se guardan
                únicamente en tu navegador (localStorage). Nunca salen de tu dispositivo.
              </li>
              <li>
                <strong className="text-fg font-medium">Notificaciones push.</strong> Si las
                activas, almacenamos un identificador anónimo de suscripción asociado
                a tu navegador, sin datos personales.
              </li>
              <li>
                <strong className="text-fg font-medium">Analítica.</strong> Usamos analítica
                agregada y sin cookies de seguimiento para saber qué páginas funcionan.
                No perfilamos usuarios ni vendemos datos.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Contenido de terceros</h2>
            <p>
              Los eventos se recopilan de fuentes públicas (ayuntamiento, salas,
              medios locales) y enlazamos a webs externas para comprar entradas.
              Esas webs tienen sus propias políticas de privacidad.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Tus derechos</h2>
            <p>
              Puedes acceder, rectificar o eliminar tus datos en cualquier momento:
              para la newsletter usa el enlace de baja o escríbenos por email. Sin
              cuentas de usuario, no hay más datos que esos.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
