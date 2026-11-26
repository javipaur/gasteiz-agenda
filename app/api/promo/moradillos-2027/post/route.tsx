import { ImageResponse } from "next/og";

import { MORADILLOS_2027 } from "@/lib/moradillos-2027";
import { PALETA_PROMO, TAMANO_PROMO } from "@/lib/promo";
import { paraInstagramJpeg } from "@/lib/promo-image";
import { CabeceraPromo, WordmarkPromo } from "@/lib/promo-marca";

export const runtime = "nodejs";

/**
 * El post de difusión de Moradillos 2027. No es el carrusel de la agenda:
 * aquí no hay diez planes de Vitoria ni ventana del día, y ningún texto se
 * genera a partir de los eventos. Es una ficha fija con los datos que Carlos
 * publica en su sala de prensa.
 */
export async function GET(request: Request) {
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
      <CabeceraPromo />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, color: PALETA_PROMO.rojo }}>
          DIFUSIÓN EDITORIAL
        </div>
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700, lineHeight: 1.05 }}>
          {MORADILLOS_2027.titulo}
        </div>
        <div style={{ display: "flex", fontSize: 42, color: PALETA_PROMO.tintaSuave }}>
          {MORADILLOS_2027.fechas}
        </div>
        <div style={{ display: "flex", fontSize: 42 }}>{MORADILLOS_2027.destino}</div>
        <div style={{ display: "flex", fontSize: 36 }}>{MORADILLOS_2027.carteles}</div>
        <div style={{ display: "flex", fontSize: 30, color: PALETA_PROMO.tintaSuave }}>
          {MORADILLOS_2027.generos}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <WordmarkPromo tamano={32} />
      </div>
    </div>,
    TAMANO_PROMO,
  );

  return await paraInstagramJpeg(request, image);
}
