import { ImageResponse } from "next/og";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { MAX_DIAPOSITIVAS, TAMANO_PROMO } from "@/lib/promo";

export const runtime = "nodejs";
// Es una imagen que se puede cachear un rato: el mismo día da la misma portada.
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string }> };

/*
 * **`numero` y `pie` se calculan aquí y se pintan como interpolación simple.**
 *
 * Antes el número iba como `{lista.length > 0 ? lista.length : "—"}` dentro del `<div>`,
 * y eso **hacía fallar la ruta entera en producción con un 502**. El motivo está medido,
 * no supuesto: se bisecció la composición contra un servidor local hasta dar con la
 * línea, y el ternario puede devolver un **número** o una **cadena** — Satori los cuenta
 * como hijos distintos y responde «Expected `<div>` to have explicit "display: flex"… if
 * it has more than one child node».
 *
 * Dos cosas hicieron que pasara tanto tiempo:
 *
 * - **El error no señalaba la línea.** Es el mismo que tira la imagen de presentación, y
 *   en la portada no hay nada que lo sugiera.
 * - **`next build` no lo cazaba**, porque `/api/promo/[fecha]/portada` es dinámica y no se
 *   prerenderiza. La presentación sí es estática, y por eso aquella se vio en el build y
 *   ésta lleva desde octubre fallen: solo se ha comprobado en ejecución.
 *
 * `String(...)` deja el número en un solo hijo de texto y el problema desaparece.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { fecha } = await params;

  const eventos = await getAgendaEventos();
  // `MAX_DIAPOSITIVAS` y no un `9` a pelo: la portada cuenta lo mismo que el paquete,
  // y dos números escritos en dos sitios son dos números que un día no coinciden. Este
  // estaba a pelo y el otro en `app/api/promo/route.ts`, y solo se veían distintos si
  // alguien miraba los dos.
  const lista = recomendados(eventos, {
    desde: fecha,
    hasta: fecha,
    limite: MAX_DIAPOSITIVAS,
  });

  // `T12:00:00` y no medianoche: una fecha sin hora la parsea el motor como UTC, y en
  // `Europe/Madrid` eso es las dos de la mañana del día anterior. A mediodía el día no
  // se puede mover por el huso.
  const titulo = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Los dos textos del centro se calculan aquí y no dentro del JSX, por el motivo que
  // explica el bloque de abajo. `numero` además lleva `String()` porque un número y una
  // cadena no son el mismo tipo de hijo para Satori.
  const numero = lista.length > 0 ? String(lista.length) : "—";
  const pie =
    lista.length === 0
      ? "Hoy no hay nada recomendado"
      : lista.length === 1
        ? "plan recomendado"
        : "planes recomendados";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141210",
          color: "#F5F1EA",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, letterSpacing: 6, color: "#E0A34E" }}>
            HOY EN VITORIA
          </div>
          <div style={{ fontSize: 86, marginTop: 18, textTransform: "capitalize" }}>
            {titulo}
          </div>
        </div>

<div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 190, lineHeight: 1 }}>{numero}</div>
          <div style={{ fontSize: 40, color: "#B9B2A6", marginTop: 12 }}>{pie}</div>
        </div>

        <div style={{ fontSize: 30, color: "#8B8377" }}>gasteizclick.javierpalacio.es/hoy</div>
      </div>
    ),
    TAMANO_PROMO
  );
}