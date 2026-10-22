import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Los recursos gráficos de la ficha de Play Store.
 *
 * **La marca es de aquí.** `public/brand-mark.svg` y `public/icon-512.svg` son
 * el original, y la app los usa desde el 21 de octubre de 2026. La ficha de
 * Play tenía el logo viejo —el rojo de "GASTEIZ CLICK" de antes del
 * rebrand— y esa incongruencia es justo la que se complained: el mismo
 * producto con dos marcas.
 *
 * Salen aqui y no en el repo de la app porque el original esta aqui, y
 * duplicarlo seria crear la divergencia que se quiere evitar.
 *
 *     node scripts/generate-play-assets.mjs
 */
const PUBLIC = path.join(process.cwd(), "public");
const SALIDA = process.argv[2] || "C:/Users/javie/Desktop/CAPTURAS-PLAY";

const iconoSvg = await readFile(path.join(PUBLIC, "icon-512.svg"), "utf8");
const marcaSvg = await readFile(path.join(PUBLIC, "brand-mark.svg"), "utf8");

// El icono de la ficha: el mismo que el del lanzador, 512x512.
await sharp(Buffer.from(iconoSvg), { density: 300 })
  .resize(512, 512)
  .png()
  .toFile(path.join(SALIDA, "icono-ficha.png"));
console.log("OK icono-ficha.png (512x512)");

// El grafico de funciones: 1024x500, con la marca a la izquierda.
const marca = await sharp(Buffer.from(marcaSvg), { density: 300 })
  .resize(400, 400)
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 1024,
    height: 500,
    channels: 4,
    background: "#faf9f5",
  },
})
  .composite([{ input: marca, left: 72, top: 50 }])
  .png()
  .toFile(path.join(SALIDA, "grafico-funciones.png"));
console.log("OK grafico-funciones.png (1024x500)");
