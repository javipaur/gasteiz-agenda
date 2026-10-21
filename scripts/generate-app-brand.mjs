import sharp from "sharp";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Los assets de marca de la app móvil, generados desde los SVG de esta web.
 *
 * ## Por qué un script que escribe en OTRO repositorio
 *
 * **La marca tiene un solo dueño, y es aquí.** `public/brand-mark.svg`,
 * `public/icon-512.svg`, `public/icon-maskable.svg` y `public/logo-reducido.svg`
 * son el original, y `__tests__/logo-marca.test.ts` vigila que los componentes
 * JSX que los dibujan digan lo mismo.
 *
 * La app móvil necesita esa marca en PNG, porque no tiene `react-native-svg` y
 * porque el icono del lanzador de Android **tiene** que ser un raster: el
 * sistema lo recorta con su propia máscara y no lee vectores.
 *
 * Las dos opciones eran duplicar el SVG en el repo de la app —y que las dos
 * copias se separen sin que nada lo diga— o generar el PNG desde el original.
 * **El logo de la app era un rectángulo negro** —`img/logotop.png`, que no lo
 * usaba nadie— y el icono del lanzador era otro logo entero, el rojo de
 * "GASTEIZ CLICK" de antes del rebrand. Dos marcas distintas para la misma app.
 *
 * ## Dónde está el repo de la app
 *
 * Por defecto, el hermano del de la web: `../React-native/V2/GasteizClick`.
 * Se puede cambiar con `APP_REPO`. Si no está, el script **avisa y no
 * escribe nada**: medio actualizar la marca de la app es peor que no
 * actualizarla.
 *
 *     node scripts/generate-app-brand.mjs
 *     APP_REPO=ruta/otra node scripts/generate-app-brand.mjs
 */

const WEB = process.cwd();
const APP = path.resolve(
  WEB,
  process.env.APP_REPO || path.join("..", "React-native", "V2", "GasteizClick")
);

/**
 * Las densidades de Android y el tamaño del icono en cada una.
 *
 * **El icono del lanzador tiene 48 dp**, no 512: `48 × (mdpi 1, hdpi 1.5,
 * xhdpi 2, xxhdpi 3, xxxhdpi 4)`. Los iconos **adaptativos** son de 108 dp
 * porque el sistema recorta un anillo por fuera y la zona segura es el 72 dp
 * central; el icono entero es de 48 dp y va dentro de esos 108.
 */
const DENSIDADES = [
  { carpeta: "mdpi", legacy: 48, adaptativo: 108 },
  { carpeta: "hdpi", legacy: 72, adaptativo: 162 },
  { carpeta: "xhdpi", legacy: 96, adaptativo: 216 },
  { carpeta: "xxhdpi", legacy: 144, adaptativo: 324 },
  { carpeta: "xxxhdpi", legacy: 192, adaptativo: 432 },
];

/** El crema de la marca, medido en el SVG que sale de Stitch. */
const CREMA = "#faf9f5";

async function existe(ruta) {
  try {
    await readFile(ruta);
    return true;
  } catch {
    return false;
  }
}

async function principal() {
  if (!(await existe(path.join(APP, "package.json")))) {
    console.error(
      `[FALLO] No encuentro la app en ${APP}.\n` +
        `       Apunta con APP_REPO=/ruta/a/la/app, o deja la ruta por defecto.`
    );
    process.exitCode = 1;
    return;
  }

  const leerSvg = async (nombre) =>
    await readFile(path.join(WEB, "public", nombre), "utf8");

  const marca = await leerSvg("brand-mark.svg");
  const icono = await leerSvg("icon-512.svg");
  const reducido = await leerSvg("logo-reducido.svg");

  /**
   * El primer plano del icono adaptativo: **la marca sola, sin fondo**.
   *
   * El fondo va en su propia capa, que es lo que el sistema recorta por
   * detrás. Si el fondo fuese parte del primer plano, el recorte del sistema
   * se vería: un cuadrado crema dentro de un cuadrado crema, con la esquina
   * del primero marking la del segundo.
   *
   * **La marca se recentra y se agranda un 5%.** El dibujo va alrededor del
   * origen con el grupo `translate(256, 256)`, y su caja no está centrada:
   * llega más a la derecha que a la izquierda —el cursor sale hasta 148— y
   * más arriba que abajo —la txapela sube a -142—. El centro real está en
   * (6.5, -16), y sin corregirlo el icono se ve desplazado en su máscara.
   *
   * El 5% es lo que separa "se ve" de "se recorta": la marca ocupa el 55% del
   * lienzo, y la zona segura del icono adaptativo es el 66%. Con el 5% son el
   * 58%, que llena el icono sin que la txapela ni el cursor lleguen a tocarla.
   */
  const primero = marca
    .replace(/\s*<rect[^>]*width="512"[^>]*\/>\s*/, "\n")
    .replace(
      /translate\(256,\s*256\)/,
      "translate(256, 256) scale(1.05) translate(-6.5, 16)"
    );

  const png = async (svg, tamano) =>
    await sharp(Buffer.from(svg), { density: 300 })
      .resize(tamano, tamano)
      .png()
      .toBuffer();

  const escribir = async (destino, buffer) => {
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, buffer);
  };

  // ---- Los assets dentro de la app -----------------------------------------
  const img = path.join(APP, "img");
  await escribir(path.join(img, "brand-mark.png"), await png(marca, 512));
  console.log("OK img/brand-mark.png (512x512) — la marca completa, para las cards");
  await escribir(
    path.join(img, "brand-mark-reducido.png"),
    await png(reducido, 512)
  );
  console.log("OK img/brand-mark-reducido.png (512x512) — para la cabecera");
  await escribir(path.join(img, "ic_launcher.png"), await png(icono, 512));
  console.log("OK img/ic_launcher.png (512x512) — la pantalla de carga");

  // ---- Los iconos del lanzador de Android ----------------------------------
  const res = path.join(APP, "android", "app", "src", "main", "res");
  for (const d of DENSIDADES) {
    const destino = path.join(res, `mipmap-${d.carpeta}`);

    // El icono antiguo, para los lanzadores que no saben de adaptativos.
    await escribir(
      path.join(destino, "ic_launcher.png"),
      await png(icono, d.legacy)
    );

    // El primer plano: la marca sola, con el fondo aparte.
    await escribir(
      path.join(destino, "ic_launcher_adaptive_fore.png"),
      await png(primero, d.adaptativo)
    );

    // El fondo: crema liso. El sistema lo recorta por detrás.
    await escribir(
      path.join(destino, "ic_launcher_adaptive_back.png"),
      await sharp({
        create: {
          width: d.adaptativo,
          height: d.adaptativo,
          channels: 4,
          background: CREMA,
        },
      })
        .png()
        .toBuffer()
    );

    console.log(
      `OK mipmap-${d.carpeta}: ic_launcher ${d.legacy}px · adaptativos ${d.adaptativo}px`
    );
  }

  console.log(`\nMarca generada en ${APP}`);
}

await principal();
