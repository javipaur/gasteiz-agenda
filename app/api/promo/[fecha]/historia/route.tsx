import { ImageResponse } from "next/og";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { MAX_DIAPOSITIVAS, TAMANO_HISTORIA } from "@/lib/promo";

export const runtime = "nodejs";
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string }> };

/**
 * La historia del día: un plan, a pantalla completa.
 *
 * **Una sola diapositiva y no un resumen.** El formato de historia se mira de pie, con el
 * móvil en la mano y quizá esperando el bus: ahí caben una cosa y su nombre grande, no seis
 * títulos en minúscula. Un resumen en vertical obliga a ampliar para leer, y quien amplía
 * una historia ya está a un dedo de pasarla.
 *
 * **El mismo selector y el mismo límite que el post.** No hay una lista nueva: el primer
 * evento de `recomendados` es el mismo que ocupa la primera diapositiva del carrusel. Es
 * lo que hace que la historia y el post no se contradigan, y lo que evita que este script
 * tenga una tercera lista que mantener.
 *
 * **`numero` y `pie` se calculan fuera del JSX y se pintan como interpolación simple.**
 * Un ternario dentro de un `<div>` puede devolver un número o una cadena, y Satori los
 * cuenta como dos hijos y tumba la respuesta con un 502 a mitad del stream. Está escrito
 * y explicado en `app/api/promo/[fecha]/portada/route.tsx`, que falló en producción por
 * eso durante semanas.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { fecha } = await params;

  const titulo = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde: fecha, hasta: fecha, limite: MAX_DIAPOSITIVAS });
  const primero = lista[0];

  const numero = lista.length > 0 ? String(lista.length) : "—";
  const pie =
    lista.length === 0
      ? "Hoy no hay nada recomendado"
      : lista.length === 1
        ? "plan recomendado"
        : "planes recomendados";

  const nombre = primero?.title ?? "";
  const lugar = primero?.location ?? "";

  // El logo va con los colores escritos y no con `var(--color-accent)`: dentro del SVG de
  // `ImageResponse` no hay tema, y una variable de CSS sale en negro. Mismo criterio que la
  // imagen de presentación, y por el mismo motivo.
  const marca = (
    <svg width="150" height="150" viewBox="0 0 512 512" fill="none">
      <g transform="translate(256, 256)">
        <path
          d="M 85 -85 A 120 120 0 1 0 120 16 L 120 0 L 18 0 L 18 42 L 62 42 A 62 62 0 1 1 44 -44 L 85 -85 Z"
          fill="#dc2626"
        />
        <line
          x1="-126"
          y1="102"
          x2="107"
          y2="-130"
          stroke="#ca8a04"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <g transform="translate(-38, -120) rotate(-16)">
          <path d="M 0 -22 L 0 -11" stroke="#e7e5e4" strokeWidth="11" strokeLinecap="round" />
          <path d="M -68 6 C -62 -22, 58 -28, 80 -2 C 84 14, -26 25, -68 6 Z" fill="#e7e5e4" />
          <path
            d="M -54 8 C -20 20, 44 15, 66 5 C 46 13, -14 15, -54 8 Z"
            fill="#e7e5e4"
            opacity="0.6"
          />
        </g>
      </g>
    </svg>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#141210",
          color: "#F5F1EA",
          padding: 90,
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {marca}
          <div style={{ fontSize: 44, letterSpacing: 8, color: "#E0A34E", marginTop: 30 }}>
            {titulo.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 90, lineHeight: 1.14, textTransform: "none" }}>
            {nombre || "Hoy no hay nada recomendado"}
          </div>
          {/*
           * El lugar va en su propio `<div>` y no pegado al título con un espacio. Con
           * `{nombre} {lugar}` el `<div>` tendría tres hijos —título, espacio y lugar— y sin
           * `display` Satori tumba la imagen. Es el mismo fallo que se resolvió en la
           * ruta del evento, que estuvo dando 502 desde octubre.
           */}
          {lugar ? (
            <div style={{ fontSize: 46, color: "#B9B2A6", marginTop: 40 }}>{lugar}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 150, lineHeight: 1, color: "#E0A34E" }}>{numero}</div>
          <div style={{ fontSize: 52, color: "#B9B2A6", marginTop: 20 }}>{pie}</div>
          <div style={{ fontSize: 36, color: "#8B8377", marginTop: 56 }}>
            gasteizclick.javierpalacio.es/hoy
          </div>
        </div>
      </div>
    ),
    TAMANO_HISTORIA
  );
}