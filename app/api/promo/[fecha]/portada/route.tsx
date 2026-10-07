import { ImageResponse } from "next/og";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { TAMANO_PROMO } from "@/lib/promo";

export const runtime = "nodejs";
// Es una imagen que se puede cachear un rato: el mismo día da la misma portada.
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { fecha } = await params;

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde: fecha, hasta: fecha, limite: 9 });

  // `T12:00:00` y no medianoche: una fecha sin hora la parsea el motor como UTC, y en
  // `Europe/Madrid` eso es las dos de la mañana del día anterior. A mediodía el día no
  // se puede mover por el huso.
  const titulo = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
          <div style={{ fontSize: 190, lineHeight: 1 }}>
            {lista.length > 0 ? lista.length : "—"}
          </div>
          <div style={{ fontSize: 40, color: "#B9B2A6", marginTop: 12 }}>
            {lista.length === 0
              ? "Hoy no hay nada recomendado"
              : lista.length === 1
                ? "plan recomendado"
                : "planes recomendados"}
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#8B8377" }}>gasteizclick.javierpalacio.es/hoy</div>
      </div>
    ),
    TAMANO_PROMO
  );
}