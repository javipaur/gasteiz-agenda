import { ImageResponse } from "next/og";

import {
  NAVIDAD_2026,
  POR_CONFIRMAR,
  diaCortoNavidad,
  diapositivaNavidad,
} from "@/lib/navidad-vitoria";
import { PALETA_PROMO, TAMANO_PROMO } from "@/lib/promo";
import { paraInstagramJpeg } from "@/lib/promo-image";
import { CabeceraPromo, WordmarkPromo } from "@/lib/promo-marca";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Una diapositiva del carrusel. El texto y la fuente salen de `lib/navidad-vitoria.ts`:
 * copiar un dato aquí y otro en el paquete es cómo una pieza acaba diciendo una hora
 * que la otra ya no dice. Los campos sin fuente se pintan con la marca literal
 * `POR CONFIRMAR`, no se rellenan con datos del año anterior.
 */
export async function GET(request: Request, { params }: { params: Promise<{ numero: string }> }) {
  const { numero: pedido } = await params;
  const numero = Number(pedido);
  if (!/^\d+$/.test(pedido) || !Number.isInteger(numero)) {
    return new Response("No encontrado", { status: 404 });
  }

  const diapositiva = diapositivaNavidad(numero);
  if (!diapositiva) return new Response("No encontrado", { status: 404 });

  const evento = NAVIDAD_2026.eventos.find((e) => e.id === diapositiva.evento);
  if (!evento) return new Response("No encontrado", { status: 404 });

  const pendiente = [evento.fecha, evento.hora, evento.lugar, evento.precio].some(
    (dato) => dato === POR_CONFIRMAR,
  );
  const cuando =
    evento.fecha === POR_CONFIRMAR
      ? POR_CONFIRMAR
      : diaCortoNavidad(evento.fecha);
  const hora = evento.horaFin ? `${evento.hora}–${evento.horaFin}` : evento.hora;
  const contador = `${numero}/${NAVIDAD_2026.diapositivas.length}`;

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: PALETA_PROMO.papel,
        color: PALETA_PROMO.tinta,
        padding: 72,
      }}
    >
      <CabeceraPromo
        extra={
          <div style={{ display: "flex", fontSize: 28, color: PALETA_PROMO.tintaSuave }}>
            {contador}
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, color: PALETA_PROMO.rojo }}>
          {cuando}
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>
          {diapositiva.titulo}
        </div>
        <div style={{ display: "flex", fontSize: 44, color: PALETA_PROMO.tintaSuave }}>
          {diapositiva.texto}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 32 }}>{hora}</div>
          <div style={{ display: "flex", fontSize: 32 }}>{evento.lugar}</div>
          <div style={{ display: "flex", fontSize: 32 }}>{evento.precio}</div>
        </div>
        {pendiente ? (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 18px",
              borderRadius: 999,
              border: `2px solid ${PALETA_PROMO.rojo}`,
              color: PALETA_PROMO.rojo,
              fontSize: 26,
            }}
          >
            {POR_CONFIRMAR}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", width: 132, height: 6, backgroundColor: PALETA_PROMO.rojo }} />
        <div style={{ display: "flex", fontSize: 27, color: PALETA_PROMO.tintaSuave }}>
          {diapositiva.fuente}
        </div>
        <div style={{ display: "flex", fontSize: 25, color: PALETA_PROMO.tintaSuave }}>
          {diapositiva.aviso}
        </div>
        <div style={{ display: "flex", fontSize: 23, color: PALETA_PROMO.tintaTenue }}>
          Consultado el {diaCortoNavidad(NAVIDAD_2026.consultado)}
        </div>
        <div style={{ display: "flex" }}>
          <WordmarkPromo tamano={30} />
        </div>
      </div>
    </div>,
    TAMANO_PROMO,
  );

  return await paraInstagramJpeg(request, image);
}
