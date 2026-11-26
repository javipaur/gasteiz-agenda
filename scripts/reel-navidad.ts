/**
 * Genera `public/navidad-2026/reel.mp4` a partir de los datos verificados de
 * `lib/navidad-vitoria.ts`. No descarga clips, no usa música y no publica nada:
 * la persona añade la música desde Instagram, que es quien tiene la licencia.
 *
 * Los cortes van a 120 bpm —una imagen cada medio segundo— y el vídeo dura
 * 16 s: ocho planes, cuatro latidos por plan. Cada plano es un SVG dibujado
 * con `sharp`, así que no hay material de terceros dentro del MP4.
 *
 *    npm run reel:navidad
 *
 * La salida se comprueba con `ffprobe-static`: 1080×1920, 15–20 s. Un vídeo
 * más corto deja el gancho a medias; uno más largo se corta en Instagram.
 */
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const ejecutar = promisify(execFile);

const ANCHO = 1080;
const ALTO = 1920;
const LATIDOS_POR_PLAN = 4;
const IMAGENES_POR_SEGUNDO = 2;
const SALIDA = join(process.cwd(), "public", "navidad-2026", "reel.mp4");

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Divide por palabras sin partir ninguna: el SVG no sabe ajustar líneas. */
function enLineas(texto: string, maximo: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (candidata.length > maximo && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidata;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function textoEnLineas(
  texto: string,
  opciones: { x: number; y: number; tamano: number; maximo: number; interlineado: number; color: string; peso?: number },
): string {
  return enLineas(texto, opciones.maximo)
    .map(
      (linea, i) =>
        `<text x="${opciones.x}" y="${opciones.y + i * opciones.interlineado}" ` +
        `font-family="Arial, Helvetica, sans-serif" font-size="${opciones.tamano}" ` +
        `font-weight="${opciones.peso ?? 400}" fill="${opciones.color}">${escapar(linea)}</text>`,
    )
    .join("");
}

async function main(): Promise<void> {
  if (!ffmpegPath) throw new Error("ffmpeg-static no ha podido resolver el binario");

  const { AVISO_CAMBIOS, NAVIDAD_2026, POR_CONFIRMAR, diaCortoNavidad } = await import(
    "../lib/navidad-vitoria"
  );
  const { PALETA_PROMO } = await import("../lib/promo");

  const marca = (await readFile(join(process.cwd(), "public", "brand-mark.svg"))).toString("base64");
  await mkdir(join(tmpdir(), "opencode"), { recursive: true });
  const temporal = await mkdtemp(join(tmpdir(), "opencode", "navidad-reel-"));

  try {
    let indice = 1;
    for (const diapositiva of NAVIDAD_2026.diapositivas) {
      const evento = NAVIDAD_2026.eventos.find((e) => e.id === diapositiva.evento);
      if (!evento) throw new Error(`La diapositiva ${diapositiva.numero} no tiene evento`);

      const pendiente = [evento.fecha, evento.hora, evento.lugar, evento.precio].some(
        (dato) => dato === POR_CONFIRMAR,
      );
      const hora = evento.horaFin ? `${evento.hora}–${evento.horaFin}` : evento.hora;
      const cuando =
        evento.fecha === POR_CONFIRMAR ? POR_CONFIRMAR : diaCortoNavidad(evento.fecha);
      const detalles = [hora, evento.lugar, evento.precio].filter(Boolean).join(" · ");

      for (let latido = 0; latido < LATIDOS_POR_PLAN; latido += 1) {
        const fondo = latido % 2 === 0 ? PALETA_PROMO.papel : PALETA_PROMO.marco;
        const barra = 36 + latido * (936 / LATIDOS_POR_PLAN);
        const insignia = pendiente
          ? `<rect x="72" y="1490" width="410" height="74" rx="37" fill="none" stroke="${PALETA_PROMO.rojo}" stroke-width="3"/>` +
            textoEnLineas(POR_CONFIRMAR, {
              x: 100, y: 1540, tamano: 36, maximo: 40, interlineado: 44, color: PALETA_PROMO.rojo, peso: 700,
            })
          : "";

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <rect width="${ANCHO}" height="${ALTO}" fill="${fondo}"/>
  <image href="data:image/svg+xml;base64,${marca}" x="72" y="72" width="128" height="128"/>
  ${textoEnLineas("Gasteiz", { x: 226, y: 160, tamano: 54, maximo: 20, interlineado: 60, color: PALETA_PROMO.tinta, peso: 900 })}
  <text x="452" y="160" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="900" fill="${PALETA_PROMO.rojo}">Click</text>
  <text x="${ANCHO - 72}" y="160" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="${PALETA_PROMO.tintaSuave}">${diapositiva.numero}/${NAVIDAD_2026.diapositivas.length}</text>
  <rect x="72" y="290" width="160" height="6" fill="${PALETA_PROMO.rojo}"/>
  ${textoEnLineas(cuando, { x: 72, y: 390, tamano: 36, maximo: 40, interlineado: 48, color: PALETA_PROMO.rojo, peso: 700 })}
  ${textoEnLineas(diapositiva.titulo, { x: 72, y: 560, tamano: 96, maximo: 18, interlineado: 108, color: PALETA_PROMO.tinta, peso: 700 })}
  ${textoEnLineas(diapositiva.texto, { x: 72, y: 1010, tamano: 46, maximo: 26, interlineado: 60, color: PALETA_PROMO.tintaSuave })}
  ${textoEnLineas(detalles, { x: 72, y: 1240, tamano: 36, maximo: 30, interlineado: 52, color: PALETA_PROMO.tinta })}
  ${insignia}
  <rect x="72" y="1680" width="936" height="2" fill="${PALETA_PROMO.filete}"/>
  <rect x="72" y="1680" width="${barra}" height="6" fill="${PALETA_PROMO.rojo}"/>
  ${textoEnLineas(diapositiva.fuente, { x: 72, y: 1750, tamano: 30, maximo: 40, interlineado: 42, color: PALETA_PROMO.tintaSuave })}
  ${textoEnLineas(AVISO_CAMBIOS, { x: 72, y: 1820, tamano: 30, maximo: 40, interlineado: 42, color: PALETA_PROMO.tintaSuave })}
  ${textoEnLineas(`Consultado el ${diaCortoNavidad(NAVIDAD_2026.consultado)}`, { x: 72, y: 1880, tamano: 26, maximo: 40, interlineado: 34, color: PALETA_PROMO.tintaTenue })}
</svg>`;

        await sharp(Buffer.from(svg))
          .png()
          .toFile(join(temporal, `foto-${String(indice).padStart(3, "0")}.png`));
        indice += 1;
      }
    }

    await mkdir(join(process.cwd(), "public", "navidad-2026"), { recursive: true });
    await ejecutar(
      ffmpegPath,
      [
        "-y",
        "-framerate", String(IMAGENES_POR_SEGUNDO),
        "-i", join(temporal, "foto-%03d.png"),
        "-vf", "fps=30",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        SALIDA,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );

    const ffprobe = (await import("ffprobe-static")).default.path;
    const { stdout } = await ejecutar(ffprobe, [
      "-v", "error",
      "-show_entries", "format=duration:stream=width,height,codec_type",
      "-of", "json",
      SALIDA,
    ]);
    const sonda = JSON.parse(stdout) as {
      format: { duration: string };
      streams: Array<{ width: number; height: number; codec_type: string }>;
    };
    const duracion = Number(sonda.format.duration);
    const video = sonda.streams.find((s) => s.codec_type === "video");
    if (!video || video.width !== ANCHO || video.height !== ALTO) {
      throw new Error(`El vídeo no es ${ANCHO}×${ALTO}: ${JSON.stringify(sonda.streams)}`);
    }
    if (duracion < 15 || duracion > 20) {
      throw new Error(`El vídeo dura ${duracion}s y tiene que estar entre 15 y 20`);
    }
    if (sonda.streams.some((s) => s.codec_type === "audio")) {
      throw new Error("El MP4 lleva audio: la música la añade la persona en Instagram");
    }
    console.log(`[OK] ${SALIDA} — ${ANCHO}×${ALTO}, ${duracion.toFixed(1)} s, sin audio`);
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
