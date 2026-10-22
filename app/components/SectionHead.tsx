import Link from "next/link";

/**
 * La cabecera de una sección: etiqueta, titular y enlace.
 *
 * ## Por qué esto no es un título en mayúsculas con una píldora de color
 *
 * Porque salía **catorce veces igual** en la portada, y catorce veces igual es
 * catorce veces plantilla. La forma era: una píldora de color saturado y debajo
 * un titular en Bodoni **en mayúsculas** con tracking negativo. Repetido trece
 * veces, el efecto es el contrario del buscado: nadie lo lee como una sección,
 * se lee como un relleno.
 *
 * Y el color tampoco era la respuesta. Aquí la referencia sí lo dice, y dice algo
 * distinto: **la página es neutra y el color vive en el contenido**. Su tarjeta
 * grande es azul porque es el centerpiece; el resto de la página son tarjetas
 * blancas y texto negro. El color marca **qué es**, no **dónde estás**.
 *
 * ## La forma que queda
 *
 * ```
 * ● CATEGORÍAS ─────────────────────────────── Ver todo →
 * Explora Vitoria-Gasteiz
 * ```
 *
 * - **La etiqueta** es texto en caja alta, pequeño, con tracking, en el color
 *   apagado de la página. Es una *etiqueta*, y las etiquetas van en mayúsculas;
 *   los titulares no.
 * - **El punto** es de color, y solo un punto. Es lo que distingue "CULTURA" de
 *   "DEPORTE" sin gritar, y como es gráfico no necesita 4,5:1 sino 3:1.
 * - **El filete** es lo que da estructura. Una línea hairline que separa la
 *   etiqueta del borde derecho hace el trabajo que hacía la píldora de color, y
 *   lo hace sin gritar.
 * - **El titular** va en **sentence case**. Es la diferencia más grande y la más
 *   barata: trece mayúsculasTrackeadas leen como trece gritos, y trece
 *   sentence case leen como trece titulares.
 *
 * ## El peso del Bodoni
 *
 * `font-bold` (700) y no `font-black` (900). La Bodoni es variable y los pesos
 * son reales, así que no hay negrita sintética —que en una Didone destruye el
 * contraste entre el trazo fino y el grueso—. Pero 700 en una Didone sigue siendo
 * elegante, y 900 ya es un ladrillo. El h1 de la portada es el único sitio donde
 * se permite el peso alto, y lleva `font-bold` con mayúsculas.
 */
export default function SectionHead({
  tag,
  title,
  subtitle,
  href,
  linkLabel = "Ver todo",
  color,
}: {
  tag?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  color?: string;
}) {
  return (
    <div className="mb-7">
      {/*
        La fila de arriba: etiqueta a la izquierda, filete al centro, enlace a la
        derecha. Es la estructura de una cabecera de revista, y por eso el filete
        crece: `flex-1` se queda con el hueco que dejan los dos extremos.
      */}
      <div className="flex items-center gap-3 mb-4">
        {tag ? (
          <span className="inline-flex items-center gap-2 shrink-0">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: color ?? "var(--accent)" }}
            />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
              {tag}
            </span>
          </span>
        ) : (
          <span aria-hidden="true" className="size-2 shrink-0" />
        )}

        <span aria-hidden="true" className="h-px flex-1 bg-border" />

        {href && (
          <Link
            href={href}
            className="group inline-flex items-center gap-1.5 shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted hover:text-accent transition-colors duration-300"
          >
            {linkLabel}
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        )}
      </div>

      {/*
        El titular, en sentence case. `text-balance` ya está en el `base` de
        Tailwind, así que un título de dos líneas equilibra las líneas y uno de
        tres no, sin que haya que pedirlo aquí.
      */}
      <h2 className="font-display text-3xl md:text-5xl font-bold tracking-[-0.02em] text-fg leading-[1.05]">
        {title}
      </h2>

      {subtitle && <p className="text-fg-muted mt-3 text-sm max-w-prose">{subtitle}</p>}
    </div>
  );
}
