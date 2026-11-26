import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MORADILLOS_2027, segmentosPublicosDe } from "@/lib/moradillos-2027";

export const runtime = "nodejs";

/**
 * Sirve el cartel tal cual está en la sala de prensa. No se vuelve a dibujar:
 * un cartel de festival es un dato, y cualquier reescritura cambiaría nombres
 * de artistas o fechas que el organizador ya ha publicado.
 */
export function GET() {
  const jpeg = readFileSync(
    join(process.cwd(), "public", ...segmentosPublicosDe(MORADILLOS_2027.imagenes.cartel)),
  );
  return new Response(Uint8Array.from(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
