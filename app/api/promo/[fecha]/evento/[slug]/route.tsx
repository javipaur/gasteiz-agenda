import { ImageResponse } from "next/og";
import { getEventoBySlug } from "@/lib/agenda";
import { formatDate, shortTime } from "@/lib/utils";
import { urlImagenPromo, TAMANO_PROMO } from "@/lib/promo";

export const runtime = "nodejs";
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string; slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;

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
  const { day, month } = formatDate(evento.date);

  /*
   * **`fechaCorta` se compone con una plantilla y se pinta como una interpolación.**
   *
   * Era `<div style={{ marginRight: 24 }}>{day} {month}</div>`, y eso **hacía fallar la
   * ruta entera en producción con un 502**. Al ser dos interpolaciones más el espacio que
   * las separa, el `<div>` tiene tres hijos y ninguno de ellos declara `display` — que es
   * exactamente la condición que dispara el error de Satori («Expected `<div>` to have
   * explicit "display: flex"… if it has more than one child node»).
   *
   * La portada de la misma carpeta tenía el fallo espejo: un ternario que podía devolver
   * un número o una cadena. Los dos están medidos, no supuestos, y los dos llevan meses en
   * producción; ninguna se vio en `next build` porque las dos rutas son dinámicas y no se
   * prerenderizan. El detalle completo está en la portada.
   */
  const fechaCorta = `${day} ${month}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#141210",
          color: "#F5F1EA",
          padding: 70,
          fontFamily: "sans-serif",
        }}
      >
        {imagen ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imagen}
            alt=""
            width={940}
            height={520}
            style={{ objectFit: "cover", borderRadius: 28, marginBottom: 40 }}
          />
        ) : null}

        <div style={{ display: "flex", fontSize: 30, color: "#E0A34E", letterSpacing: 4 }}>
          <div style={{ marginRight: 24 }}>{fechaCorta}</div>
          {evento.time ? <div>{shortTime(evento.time)}</div> : null}
        </div>

        <div style={{ fontSize: 62, lineHeight: 1.15, marginTop: 18 }}>
          {evento.title}
        </div>

        {evento.location ? (
          <div style={{ fontSize: 34, color: "#B9B2A6", marginTop: 22 }}>
            {evento.location}
          </div>
        ) : null}

        <div style={{ fontSize: 26, color: "#8B8377", marginTop: 30 }}>
          {evento.category}
        </div>
      </div>
    ),
    TAMANO_PROMO
  );
}