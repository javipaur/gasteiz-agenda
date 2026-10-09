import type { Metadata } from "next";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { EventCard, InViewWrapper } from "@/lib/shared";
import { localDateStr } from "@/lib/utils";
import { MAX_DIAPOSITIVAS } from "@/lib/promo";

/**
 * El título y la descripción dependen de la ventana, así que van en `generateMetadata`.
 *
 * **Antes eran un `metadata` fijo que decía «para hoy» en todas las direcciones.** En
 * `/hoy` eso era cierto; en `/hoy?desde=2026-10-10&hasta=2026-10-11` es falso, y es
 * justo la URL que lleva el pie de foto del post del finde. Lo que se ve en la pestaña
 * —y lo que Google indexa para esas direcciones— decía lo contrario de la verdad.
 *
 * El `canonical` se queda como estaba. Apuntar `/hoy?desde=…` a `/hoy` es una decisión
 * de SEO que no se ha tomado, y cambiarla en silencio sería tomarla.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams;
  const { desde, hasta } = ventanaDe(q);
  const esHoy = desde === hasta && desde === hoyLocal();

  if (esHoy) {
    return {
      title: "Recomendados para hoy",
      description:
        "Qué merece la pena hoy en Vitoria-Gasteiz, con los eventos que más fuentes confirman.",
      alternates: { canonical: "/hoy" },
    };
  }

  const ventana = ventanaEnCastellano(desde, hasta);
  return {
    title: `Recomendados · ${ventana}`,
    description: `Qué merece la pena en Vitoria-Gasteiz: ${ventana}, con los eventos que más fuentes confirman.`,
    alternates: { canonical: "/hoy" },
  };
}

/** `YYYY-MM-DD` de hoy en hora local, que es como los eventos llevan la fecha. */
function hoyLocal(): string {
  return localDateStr(new Date());
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<Record<string, string | string[] | undefined>>;
};

/** El primer valor si llegó como array, que es lo que Next hace con `?a=1&a=2`. */
function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** La ventana pedida, tal cual la resuelve la página. */
function ventanaDe(q: Record<string, string | string[] | undefined>) {
  const desde = primero(q.desde) ?? primero(q.fecha) ?? hoyLocal();
  const hasta = primero(q.hasta) ?? desde;
  return { desde, hasta };
}

/**
 * La ventana escrita como la lee una persona.
 *
 * **Estaba en ISO.** Quien llega del post de Instagram veía, en lo primero que hay
 * debajo del título, `2026-10-10 — 2026-10-11`: un formato pensado para máquinas, en la
 * página que el post promete. Las tarjetas de abajo ya dicen «SÁB 10» y «DOM 11» con
 * su etiqueta, así que la cabecera era lo único que no hablaba el idioma del sitio.
 *
 * **`T12:00:00` y no medianoche**, por el mismo motivo que la portada del promo: una
 * fecha sin hora la parsea el motor como UTC, y en Europe/Madrid eso son las dos de
 * la madrugada del día anterior. A mediodía el día no se puede mover por el huso.
 */
function ventanaEnCastellano(desde: string, hasta: string): string {
  const fmt = (ymd: string) =>
    new Date(`${ymd}T12:00:00`).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  return desde === hasta ? fmt(desde) : `${fmt(desde)} — ${fmt(hasta)}`;
}

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
  const { desde, hasta } = ventanaDe(q);

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
    // `pt-28` y no `py-10`, y no es una preferencia de espaciado: la `Header` es
    // `fixed` (`Header.tsx:329`) así que no ocupa sitio en el flujo, y `<main>` no
    // lleva `padding-top` (`layout.tsx:143`). Sin apartarla, el título se esconde
    // detrás. Medido en móvil con `py-10`: el `h1` empezaba en 40 px y la barra llegaba
    // a 66, o sea **26 px del título tapados**. Las otras quince páginas usan `pt-28`
    // y esta era la única que no.
    <div className="mx-auto max-w-5xl px-5 pt-28 pb-10 sm:px-6">
      <h1 className="font-display text-3xl text-fg">Recomendados</h1>
      <p className="mt-1 text-sm text-fg-muted">{ventanaEnCastellano(desde, hasta)}</p>

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