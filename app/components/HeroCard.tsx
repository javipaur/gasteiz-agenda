import Link from "next/link";
import { formatDate, shortTime } from "@/lib/utils";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";
import type { Evento } from "@/lib/eventos";

/**
 * La tarjeta grande del portada: el centerpiece.
 *
 * ## De dónde sale la forma
 *
 * De una referencia concreta —`cazaplan.app`— medida en el navegador: una tarjeta
 * de esquinas muy redondeadas, con **relleno saturado** en vez de foto, una barra
 * superior con la fecha y la categoría, un titular **serif enorme** y, abajo, el
 * sitio y las etiquetas.
 *
 * Y esa forma no es un capricho aesthetic, funciona: con la foto de fondo y el
 * texto blanco encima, el titular compite con la imagen y hay que meter un
 * degradado para que se lea. Con el **relleno sólido**, el texto va encima de un
 * color y ya no compite con nada. Es la diferencia entre una revista y un cartel.
 *
 * ## Por qué el color viene de la categoría
 *
 * Porque la tarjeta **es** la categoría. Un concierto en rojo, una exposición en
 * terracota, deporte en verde azulado: el color hace de etiqueta y ahorra la
 * píldora. Y como los colores de `CATEGORY_COLORS` son de la paleta nueva —
 *profundos, no neón— el texto blanco encima siempre pasa el contraste.
 *
 * ## El titular va en `font-titular` y no en `font-display`
 *
 * Porque son dos serif con papeles distintos: Bodoni Moda es el logotipo y los
 * titulares de sección, y DM Serif Display es **solo** para este titular, que
 * necesita más peso y más tamaño para llenar la tarjeta. Con las dos en el mismo
 * rol una sobra.
 */
export default function HeroCard({ evento }: { evento: Evento }) {
  const categoria = normalizeCategory(evento.category);
  const color = CATEGORY_COLORS[categoria] ?? "#1E4A8A";

  const { day, month } = formatDate(evento.date);
  const time = shortTime(evento.time);

  return (
    <Link
      href={`/evento/${evento.slug}`}
      className="group block overflow-hidden rounded-[28px] p-6 md:p-8 shadow-[0_18px_44px_-24px_rgba(22,22,22,0.55)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      style={{ backgroundColor: color }}
    >
      {/*
        Barra superior. Es la misma pieza que en la referencia: la fecha y la
        hora a la izquierda, la categoría a la derecha, y nada más. Lo que hay
        entre medias es un filete que crece al pasar por encima, que es un
        detalle pequeño que hace la tarjeta viva.
      */}
      <div className="flex items-start justify-between gap-4 text-white">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
          {day} {month}
          {time ? ` · ${time}` : ""}
        </span>
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-right">
          {categoria}
        </span>
      </div>

      {/*
        El titular. El `text-wrap: balance` ya está en el `base` de Tailwind, así
        que no hace falta aquí: un titular de dos líneas equilibra las líneas y
        uno de tres no, y el ancho de la tarjeta cambia según el texto.
      */}
      <h2 className="font-titular text-white text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] mt-8 md:mt-12 mb-6">
        {evento.title}
      </h2>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {evento.location ? (
            <p className="text-white/90 text-sm font-medium truncate">{evento.location}</p>
          ) : null}
          <p className="text-white/70 font-mono text-[11px] uppercase tracking-[0.14em] mt-1">
            Vitoria-Gasteiz
          </p>
        </div>

        {/*
          La llamada. Es un disco con una flecha, como el de la referencia, y
          no un texto: el objetivo de la tarjeta es que se pulse, y un botón
          cuadrado de texto Compártelo con quien te apetezca
        */}
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15 text-white transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 10h12M11 5l5 5-5 5" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
