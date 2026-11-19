import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Eliminar mis datos",
  description:
    "Cómo solicitar la eliminación de tus datos en Gasteiz Click: newsletter, notificaciones push y otros datos asociados.",
  alternates: { canonical: "/eliminar-datos" },
};

export default function EliminarDatosPage() {
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
          <span className="text-fg-muted">Eliminar mis datos</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg leading-tight tracking-[-0.02em] mb-3">
          Eliminar mis datos
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-fg-subtle mb-10">
          Última actualización · noviembre 2026
        </p>

        <div className="space-y-8 text-base leading-relaxed text-fg-muted">
          <section>
            <p>
              Gasteiz Click no exige crear una cuenta de usuario. Los datos que
              podemos tratar dependen de las funciones que uses (newsletter o
              notificaciones push). Aquí te explicamos cómo dejar de recibir
              comunicaciones y cómo solicitar la eliminación de los datos
              asociados.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">
              Newsletter
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-fg font-medium">Darte de baja:</strong>{" "}
                usa el enlace de baja incluido en cualquier correo de la
                newsletter. La baja es inmediata.
              </li>
              <li>
                <strong className="text-fg font-medium">
                  Eliminar tu email y datos de suscripción:
                </strong>{" "}
                si quieres que eliminemos tu dirección y la información asociada
                a tu suscripción, escríbenos a{" "}
                <a
                  href="mailto:javipaur@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos%20(newsletter)"
                  className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
                >
                  javipaur@gmail.com
                </a>{" "}
                indicando la dirección de correo suscrita y la solicitud de
                eliminación.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">
              Notificaciones push
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-fg font-medium">
                  Desactivar notificaciones:
                </strong>{" "}
                puedes revocar el permiso de notificaciones desde la
                configuración de tu navegador o del dispositivo.
              </li>
              <li>
                <strong className="text-fg font-medium">
                  Eliminar la suscripción almacenada:
                </strong>{" "}
                si deseas que eliminemos el registro técnico de suscripción push
                asociado a tu navegador, escríbenos a{" "}
                <a
                  href="mailto:javipaur@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos%20(push)"
                  className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
                >
                  javipaur@gmail.com
                </a>{" "}
                indicando que quieres eliminar tu suscripción push. Si es
                posible, incluye el navegador/dispositivo desde el que te
                suscribiste para ayudarnos a localizarla.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">
              Favoritos y datos en tu dispositivo
            </h2>
            <p>
              Los favoritos se guardan únicamente en tu navegador
              (almacenamiento local) y no se envían a nuestros servidores. Puedes
              borrarlos eliminando los datos del sitio en tu navegador.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">
              Plazo y contacto
            </h2>
            <p>
              Atenderemos las solicitudes de eliminación en un plazo razonable.
              Para cualquier duda o para ejercer tus derechos de acceso,
              rectificación o supresión, contacta en{" "}
              <a
                href="mailto:javipaur@gmail.com"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                javipaur@gmail.com
              </a>
              . Más información en la{" "}
              <Link
                href="/privacidad"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                política de privacidad
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
