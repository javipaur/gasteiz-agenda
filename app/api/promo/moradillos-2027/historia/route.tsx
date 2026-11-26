import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { MORADILLOS_2027, segmentosPublicosDe } from "@/lib/moradillos-2027";
import { PALETA_PROMO, TAMANO_HISTORIA } from "@/lib/promo";
import { paraInstagramJpeg } from "@/lib/promo-image";
import { CabeceraPromo, WordmarkPromo } from "@/lib/promo-marca";

export const runtime = "nodejs";

/**
 * La historia lleva el cartel, no un resumen escrito a mano. El cartel es el
 * dato: recortarlo cortaría el nombre de quien organiza o las fechas que el
 * propio cartel pinta, así que va entero dentro del marco.
 */
export async function GET(request: Request) {
  // El cartel se lee del disco y se pasa como data URI. `ImageResponse` no
  // resuelve rutas relativas y `urlImagenPromo` apunta a producción, donde este
  // fichero todavía no está desplegado: la historia fallaría en desarrollo y
  // en cualquier preview. La data URI funciona en los dos sitios sin red.
  const cartel = `data:image/jpeg;base64,${await readFile(
    join(
      process.cwd(),
      "public",
      ...segmentosPublicosDe(MORADILLOS_2027.imagenes.cartel),
    ),
    "base64",
  )}`;
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
        padding: 64,
      }}
    >
      <CabeceraPromo tamanoMarca={64} tamanoTexto={36} />
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 1300,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: PALETA_PROMO.marco,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori descarga la imagen con su propio fetch, sin el optimizador de Next. */}
        <img
          src={cartel}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", fontSize: 34 }}>{MORADILLOS_2027.fechas}</div>
        <div style={{ display: "flex", fontSize: 34 }}>{MORADILLOS_2027.destino}</div>
        <div style={{ display: "flex", fontSize: 24, color: PALETA_PROMO.tintaSuave }}>
          {MORADILLOS_2027.carteles} · {MORADILLOS_2027.generos}
        </div>
        <WordmarkPromo tamano={28} />
      </div>
    </div>,
    TAMANO_HISTORIA,
  );

  return await paraInstagramJpeg(request, image);
}
