import type { Metadata } from "next";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { EventCard, InViewWrapper } from "@/lib/shared";
import { localDateStr } from "@/lib/utils";
import { MAX_DIAPOSITIVAS } from "@/lib/promo";

export const metadata: Metadata = {
  title: "Recomendados para hoy",
  description:
    "Qué merece la pena hoy en Vitoria-Gasteiz, con los eventos que más fuentes confirman.",
  alternates: { canonical: "/hoy" },
};

/** `YYYY-MM-DD` de hoy en hora local, que es como los eventos llevan la fecha. */
function hoyLocal(): string {
  return localDateStr(new Date());
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * La página a la que lleva el post de Instagram, y la que hace que "hoy" sea una
 * respuesta y no un adjetivo.
 *
 * **Va página propia y no una sección más de la home porque el post es la fuente de
 * tráfico.** La URL del pie de foto tiene que merecer la pena por sí sola: alguien
 * llega desde Instagram, no desde el menú, y la home no es "hoy" sino todo.
 *
 * **La ventana es `desde`/`hasta` y no solo `fecha`,** porque el mismo selector sirve
 * al post del día, al de la semana y al del finde, y los tres son la misma página con
 * otros dos parámetros. Sin ninguno, hoy.
 */
export default async function HoyPage({ searchParams }: Props) {
  const q = await searchParams;
  const uno = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const desde = uno(q.desde) ?? uno(q.fecha) ?? hoyLocal();
  const hasta = uno(q.hasta) ?? desde;

  const eventos = await getAgendaEventos();
  // `MAX_DIAPOSITIVAS` y no el `LIMITE_POR_DEFECTO` del selector, que son 8. **Esta
  // página es la que lleva el post de Instagram**, así que no puede enseñar menos de
  // lo que el post enseña: con 9 planes en el finde, la novena diapositiva prometía una
  // tarjeta que no estaba. Medido el 9 de octubre de 2026 sobre el finde del 10 y 11: el
  // paquete daba 9 imágenes y esta página pintaba 8.
  const lista = recomendados(eventos, { desde, hasta, limite: MAX_DIAPOSITIVAS });

  return (
    // Un `<div>` y no un `<main>`: `app/layout.tsx` ya envuelve la página en
    // `<main id="main-content">`, así que abrir otro aquí dejaba dos landmarks
    // `main` en el documento y el enlace "Saltar al contenido principal" del layout
    // seguía apuntando al de fuera, que ya no era el único. Es lo mismo que
    // documenta `app/docs/page.tsx`.
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-fg">Recomendados</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {desde === hasta ? desde : `${desde} — ${hasta}`}
      </p>

      {lista.length === 0 ? (
        // El hueco se dice. Una página vacía sin explicación es indistinguible de una
        // que se ha roto, y es la respuesta que peor recibe la gente que llega desde un
        // post: va a pensar que la web no funciona.
        <p className="mt-10 text-fg-muted">No hay nada recomendado para esa fecha.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((evento) => (
            <InViewWrapper key={evento.id}>
              <EventCard evento={evento} />
            </InViewWrapper>
          ))}
        </div>
      )}
    </div>
  );
}