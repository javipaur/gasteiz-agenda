import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * El vídeo que n8n descarga para el Reel. Está generado por `npm run reel:navidad`
 * y vive en `public/`: aquí solo se sirve, sin publicar nada y sin meter música.
 * La persona añade la música desde Instagram, que es quien tiene la licencia.
 */
export async function GET() {
  const video = await readFile(join(process.cwd(), "public", "navidad-2026", "reel.mp4"));
  return new Response(Uint8Array.from(video), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(video.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
