import { ImageResponse } from "next/og";

import { AVISO_CAMBIOS, NAVIDAD_2026, diaCortoNavidad } from "@/lib/navidad-vitoria";
import { PALETA_PROMO, TAMANO_PROMO } from "@/lib/promo";
import { paraInstagramJpeg } from "@/lib/promo-image";
import { CabeceraPromo, WordmarkPromo } from "@/lib/promo-marca";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * La portada del carrusel de Navidad. **No es una foto de un evento**: es una
 * pieza editorial dibujada por el proyecto, con los datos verificados en
 * `lib/navidad-vitoria.ts` y su fecha de consulta. Por eso no lleva una imagen
 * de prensa que no sabemos redistribuir.
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
      <CabeceraPromo
        extra={
          <div style={{ display: "flex", fontSize: 26, color: PALETA_PROMO.tintaSuave }}>
            {NAVIDAD_2026.diapositivas.length} planes
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            letterSpacing: 4,
            color: PALETA_PROMO.rojo,
            textTransform: "uppercase",
          }}
        >
          Agenda de la ciudad
        </div>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 700, lineHeight: 1.05 }}>
          {NAVIDAD_2026.titulo}
        </div>
        <div style={{ display: "flex", fontSize: 42, color: PALETA_PROMO.tintaSuave }}>
          {diaCortoNavidad(NAVIDAD_2026.inicio)} — {diaCortoNavidad(NAVIDAD_2026.fin)}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            width: 132,
            height: 6,
            backgroundColor: PALETA_PROMO.rojo,
          }}
        />
        <div style={{ display: "flex", fontSize: 34, color: PALETA_PROMO.tinta }}>
          Luces, belenes, mercados y planes en familia
        </div>
        <div style={{ display: "flex", fontSize: 26, color: PALETA_PROMO.tintaSuave }}>
          {AVISO_CAMBIOS}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: PALETA_PROMO.tintaTenue }}>
          Consultado el {diaCortoNavidad(NAVIDAD_2026.consultado)}
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <WordmarkPromo tamano={32} />
      </div>
    </div>,
    TAMANO_PROMO,
  );

  return await paraInstagramJpeg(request, image);
}
