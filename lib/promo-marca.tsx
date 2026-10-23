import type { ReactElement } from "react";
import { PALETA_PROMO } from "./promo";

/**
 * La marca del paquete de redes, en un solo sitio.
 *
 * **El trazo es el de `public/brand-mark.svg` y `app/components/LogoMark.tsx`, en su
 * versión reducida** —la G, el pincho y la txapela—, que es la única que se lee a 72 px.
 * Estaba escrito dentro de `app/api/promo/presentacion/route.tsx`, y las dos tarjetas
 * nuevas lo necesitan: con tres copias del mismo `path`, el día que la marca cambie de
 * forma habrá dos posts con la marca vieja y nadie sabrá cuál es la buena.
 *
 * **Se dibuja aquí y no se enlaza al SVG de `public/`.** Satori renderiza el `<svg>`
 * en línea —lo hace con `presentacion` desde el principio—, pero **no descarga ficheros
 * externos**: un `<img src="/brand-mark.svg">` sale como un hueco. No hay PNG de la
 * marca reducida en el repositorio, así que esta es la única forma.
 *
 * **El color va escrito y no heredado de `currentColor`.** El día que esto se abra
 * fuera de un navegador no hay tema que heredar, y una marca transparente sobre crema
 * es una marca invisible.
 */
export function MarcaPromo({ tamano = 72 }: { tamano?: number }): ReactElement {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 512 512" fill="none">
      <g transform="translate(256, 256)">
        <path
          d="M 85 -85 A 120 120 0 1 0 120 16 L 120 0 L 18 0 L 18 42 L 62 42 A 62 62 0 1 1 44 -44 L 85 -85 Z"
          fill={PALETA_PROMO.rojo}
        />
        <line
          x1="-126"
          y1="102"
          x2="107"
          y2="-130"
          stroke="#ca8a04"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <g transform="translate(-38, -120) rotate(-16)">
          <path d="M 0 -22 L 0 -11" stroke="#18181b" strokeWidth="11" strokeLinecap="round" />
          <path d="M -68 6 C -62 -22, 58 -28, 80 -2 C 84 14, -26 25, -68 6 Z" fill="#18181b" />
          <path
            d="M -54 8 C -20 20, 44 15, 66 5 C 46 13, -14 15, -54 8 Z"
            fill="#18181b"
            opacity="0.6"
          />
        </g>
      </g>
    </svg>
  );
}

/**
 * El logotipo escrito, igual que en la cabecera de la web: `Gasteiz` + `Click` en rojo.
 *
 * **Dos hijos y `display: flex`**, que en Satori no es opcional: un `<div>` con más de
 * un hijo y sin `display` explícito responde 502 sin cuerpo y sin log.
 *
 * **Y sin `text-transform`.** La cabecera no usa mayúsculas y el logotipo tampoco: en
 * caja alta, `GasteizClick` se convierte en una palabra de trece letras que no se lee
 * como dos.
 */
export function WordmarkPromo({
  tamano = 42,
  color = PALETA_PROMO.tinta,
}: {
  tamano?: number;
  color?: string;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "sans-serif",
        fontSize: tamano,
        fontWeight: 900,
        letterSpacing: "-0.045em",
        lineHeight: 1,
        color,
      }}
    >
      <span>Gasteiz</span>
      <span style={{ color: PALETA_PROMO.rojo }}>Click</span>
    </div>
  );
}

/**
 * Marca y logotipo en fila: la cabecera de todas las tarjetas del carrusel.
 *
 * **La misma en la portada y en las diapositivas de evento**, y por eso está aquí y no
 * copiada en las dos rutas. Un carrusel donde la primera imagen lleva la marca en una
 * esquina y las demás en otra se lee como imágenes de dos sitios distintos.
 */
export function CabeceraPromo({
  tamanoMarca = 78,
  tamanoTexto = 42,
  extra = null,
}: {
  tamanoMarca?: number;
  tamanoTexto?: number;
  extra?: ReactElement | null;
}): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <MarcaPromo tamano={tamanoMarca} />
        <WordmarkPromo tamano={tamanoTexto} />
      </div>
      {extra ? (
        <div style={{ display: "flex", marginLeft: "auto", alignItems: "center" }}>{extra}</div>
      ) : null}
    </div>
  );
}
