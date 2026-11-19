import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Política de privacidad de Gasteiz Click: qué datos se tratan, con qué finalidad, conservación y cómo ejercer tus derechos.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacidadPage() {
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
          <span className="text-fg-muted">Privacidad</span>
        </nav>

        <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg leading-tight tracking-[-0.02em] mb-3">
          Política de privacidad
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-fg-subtle mb-10">
          Última actualización · noviembre 2026
        </p>

        <div className="space-y-8 text-base leading-relaxed text-fg-muted">
          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Responsable</h2>
            <p>
              Gasteiz Click es un proyecto personal e independiente sobre la agenda
              y servicios de interés local de Vitoria-Gasteiz. No pertenece, no está
              gestionado ni está afiliado a ninguna Administración pública ni entidad
              gubernamental.
            </p>
            <p className="mt-3">
              Para cualquier cuestión sobre privacidad o para ejercer tus derechos,
              puedes escribir a{" "}
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
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Datos que tratamos y finalidad</h2>
            <ul className="list-disc pl-5 space-y-3">
              <li>
                <strong className="text-fg font-medium">Newsletter.</strong> Si te
                suscribes, tratamos tu dirección de correo electrónico para enviarte
                el boletín solicitado (con doble confirmación). Guardamos la
                información necesaria para gestionar la suscripción (por ejemplo,
                estado de confirmación, fechas y token de gestión/baja). Puedes darte
                de baja en cualquier momento desde el enlace incluido en los correos.
              </li>
              <li>
                <strong className="text-fg font-medium">Notificaciones push.</strong>{" "}
                Si las activas, almacenamos los datos técnicos de suscripción del
                navegador/dispositivo (como el endpoint y claves asociadas) necesarios
                para enviarte las notificaciones que hayas autorizado. Puedes revocar
                el permiso desde tu navegador o dispositivo.
              </li>
              <li>
                <strong className="text-fg font-medium">Favoritos.</strong> Los
                eventos guardados como favoritos se almacenan únicamente en tu
                navegador (almacenamiento local). No se envían a nuestros servidores.
              </li>
              <li>
                <strong className="text-fg font-medium">Uso y medición técnica.</strong>{" "}
                Podemos registrar datos de uso agregados (por ejemplo, eventos de
                visita o instalación de la PWA) para conocer el funcionamiento del
                servicio y mejorar la experiencia. Estas mediciones no tienen como
                finalidad identificarte personalmente.
              </li>
              <li>
                <strong className="text-fg font-medium">Analítica (si está habilitada).</strong>{" "}
                El sitio puede integrar analítica web agregada para entender el uso
                general de las páginas. Si se activa, se configura para minimizar
                datos y no realizar perfilado con fines publicitarios. La
                configuración concreta depende del despliegue.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Conservación y eliminación</h2>
            <p>
              Conservamos los datos el tiempo necesario para prestar el servicio o
              hasta que solicites su supresión o te des de baja. Puedes solicitar la
              eliminación de los datos asociados a la newsletter o a las notificaciones
              push escribiendo a{" "}
              <a
                href="mailto:javipaur@gmail.com"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                javipaur@gmail.com
              </a>
              . Consulta las instrucciones detalladas en{" "}
              <Link
                href="/eliminar-datos"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                Eliminar mis datos
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Compartición de datos</h2>
            <p>
              No vendemos tus datos ni los cedemos a terceros con fines publicitarios.
              Para prestar el servicio pueden intervenir proveedores técnicos
              necesarios (por ejemplo, infraestructura de alojamiento, servicio de
              correo para la newsletter o servicios de notificaciones del navegador),
              en la medida imprescindible para su funcionamiento.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Enlaces y fuentes de terceros</h2>
            <p>
              Gasteiz Click recopila y organiza información procedente de fuentes
              públicas y privadas y enlaza a sitios externos (organismos, salas,
              medios o plataformas de venta de entradas). Esos sitios tienen sus
              propias políticas de privacidad y condiciones. La información se muestra
              con fines informativos y puede estar sujeta a cambios; confirma siempre
              los datos en la fuente oficial correspondiente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Tus derechos</h2>
            <p>
              Puedes solicitar el acceso, rectificación, supresión u oposición en
              relación con los datos que tratemos. Para ejercerlos, contacta en{" "}
              <a
                href="mailto:javipaur@gmail.com"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                javipaur@gmail.com
              </a>
              . Si resides en el Espacio Económico Europeo, también puedes presentar
              una reclamación ante la autoridad de control competente.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-fg font-semibold mb-3">Más información</h2>
            <p>
              Consulta también el{" "}
              <Link
                href="/aviso-legal"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                aviso legal
              </Link>{" "}
              y la página{" "}
              <Link
                href="/sobre"
                className="text-accent hover:text-accent-hover underline underline-offset-4 decoration-border"
              >
                Sobre Gasteiz Click
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
