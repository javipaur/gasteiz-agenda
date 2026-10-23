import { ImageResponse } from "next/og";
import { getAgendaEventos, getEventoBySlug } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { shortTime } from "@/lib/utils";
import {
  MAX_DIAPOSITIVAS,
  PALETA_PROMO,
  TAMANO_PROMO,
  fechaCortaPromo,
  urlImagenPromo,
  ventanaDelDia,
} from "@/lib/promo";
import { CabeceraPromo, MarcaPromo } from "@/lib/promo-marca";

export const runtime = "nodejs";
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string; slug: string }> };

/*
 * **La foto va con `objectFit: "contain"` y no con `cover`, y eso es una decisión sobre
 * el dato, no sobre el gusto.**
 *
 * Antes era un recorte fijo de 940×520. En una foto de prensa el recorte no se nota; en
 * un **cartel** sí: los carteles de concierto llevan el nombre del grupo y la fecha
 * impresos cerca del borde, y recortarlos deja una imagen que ya no dice quién toca. La
 * diapositiva de evento es justo donde el póster es el contenido, así que aquí se
 * encaja entero sobre el marco crema.
 *
 * La portada hace lo contrario a propósito —`cover`— porque allí el título se reescribe
 * en tipografía y la foto solo tiene que llenar. El motivo largo está en la portada.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { slug, fecha } = await params;

  // `getEventoBySlug` devuelve `{ evento, related } | null`, no el evento suelto.
  // El `related` no lo usa esta tarjeta.
  const encontrado = await getEventoBySlug(slug);
  const evento = encontrado?.evento;

  // 404 y no una tarjeta vacía: el enlace de una diapositiva ya publicada tiene que
  // poder romperse de forma visible, no servir un rectángulo que no dice nada.
  if (!evento) return new Response("no encontrado", { status: 404 });

  // `urlImagenPromo` y no `radioImagenPromo`: el renderizador descarga con el `fetch` de
  // Node y La Genterula devuelve 403 a cualquier User-Agent con "node", así que la URL
  // cruda dejaba un rectángulo del color del fondo en la tarjeta. La función lo manda
  // por `/api/img`. El motivo entero está en `lib/promo.ts`, no aquí.
  const imagen = urlImagenPromo(evento.image);

  /*
   * **El puesto en el carrusel se calcula con el mismo selector que lo ordenó.**
   *
   * No se recibe por parámetro porque la imagen se pide por URL y la URL no lleva el
   * orden: si se pasara, un post republicado desde un enlace viejo seguiría diciendo
   * «Nº 3» con el carrusel de hoy. Se recalcula, y si el evento ya no está entre los
   * recomendados de esa ventana no se pinta número: un número inventado es peor que
   * ninguno.
   */
  const puesto = await puestoEnElCarrusel(slug, fecha);

  const hora = shortTime(evento.time);
  const cuando = hora
    ? `${fechaCortaPromo(evento.date)} · ${hora}`
    : fechaCortaPromo(evento.date);
  const titulo = recortar(evento.title, 96);
  const sitio = recortar(evento.location ?? "", 64);
  const precio = recortar(evento.price ?? "", 40);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PALETA_PROMO.papel,
          color: PALETA_PROMO.tinta,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <CabeceraPromo
          extra={
            puesto ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 3,
                  color: PALETA_PROMO.rojo,
                }}
              >
                {puesto}
              </div>
            ) : null
          }
        />

        <div
          style={{
            display: "flex",
            height: 1,
            background: PALETA_PROMO.filete,
            marginTop: 22,
            marginBottom: 30,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 952,
            height: 560,
            borderRadius: 20,
            background: PALETA_PROMO.marco,
          }}
        >
          {imagen ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imagen}
              alt=""
              width={952}
              height={560}
              style={{ objectFit: "contain", borderRadius: 20 }}
            />
          ) : (
            <MarcaPromo tamano={240} />
          )}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            color: PALETA_PROMO.mostaza,
            marginTop: 30,
          }}
        >
          {cuando}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginTop: 14,
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: PALETA_PROMO.tintaSuave,
            marginTop: 14,
          }}
        >
          {sitio}
        </div>

        {precio ? (
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              color: PALETA_PROMO.rojo,
              marginTop: 14,
            }}
          >
            {precio}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              height: 1,
              background: PALETA_PROMO.filete,
              marginBottom: 20,
            }}
          />
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                color: PALETA_PROMO.tintaSuave,
              }}
            >
              {evento.category}
            </div>
            <div style={{ display: "flex", fontSize: 26, color: PALETA_PROMO.tintaSuave }}>
              gasteizclick.javierpalacio.es
            </div>
          </div>
        </div>
      </div>
    ),
    TAMANO_PROMO
  );
}

/**
 * «Nº 3», o `null` si el evento no está en el carrusel de esa ventana.
 *
 * Se devuelve la cadena entera y no el número: interpolar `{puesto}` con un `number |
 * null` dentro de un `<div>` es exactamente la forma que rompe Satori.
 */
async function puestoEnElCarrusel(slug: string, fecha: string): Promise<string | null> {
  let desde = fecha;
  let hasta = fecha;
  try {
    const ventana = ventanaDelDia(fecha);
    if (ventana) {
      desde = ventana.desde;
      hasta = ventana.hasta;
    }
  } catch {
    // Una fecha mal formada en el enlace no puede tumbar la imagen del evento.
  }

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde, hasta, limite: MAX_DIAPOSITIVAS });
  const indice = lista.findIndex((e) => e.slug === slug);

  return indice >= 0 ? `Nº ${indice + 1}` : null;
}

/** Corta por el último espacio antes del límite, sin partir palabras. */
function recortar(texto: string, maximo: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;

  const corte = limpio.slice(0, maximo);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > maximo / 2 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`;
}
