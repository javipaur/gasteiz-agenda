import { ImageResponse } from "next/og";
import { TAMANO_PROMO, ORIGEN_PROMO } from "@/lib/promo";

export const runtime = "nodejs";
// La presentación no cambia de un día a otro, así que se cachea mucho más que las
// tarjetas de eventos: si el texto no cambia, la imagen tampoco.
export const revalidate = 86400;

/**
 * La imagen del post de presentación: quiénes somos y qué hay en la cuenta.
 *
 * **Es una ruta y no un fichero estático por el mismo motivo que las otras dos del
 * paquete.** `ImageResponse` la dibuja, el sistema operativo no la puede pintar —sin
 * tipografías del sistema— y un PNG generado en build se quedaría congelado el día que
 * se generara. Con una ruta, corregir una palabra es desplegar y nada más.
 *
 * **El logo va con los colores escritos, no con `var(--color-accent)`.** En el SVG del
 * navegador la G hereda el color del tema; aquí no hay tema, y una variable de CSS
 * dentro de `ImageResponse` sale en negro. Son los mismos trazados de
 * `app/components/LogoMark.tsx` y `public/brand-mark.svg`, en su versión reducida —G,
 * txapela y pincho— que es la que se lee a este tamaño.
 *
 * **Y el tamaño es el del resto del paquete, 1080×1350**, para que la serie de posts
 * tenga la misma gramática y no seem un añadido suelto.
 */
export async function GET() {
  const marca = (
    <svg
      width="200"
      height="200"
      viewBox="0 0 512 512"
      fill="none"
      style={{ marginBottom: 28 }}
    >
      <g transform="translate(256, 256)">
        <path
          d="M 85 -85 A 120 120 0 1 0 120 16 L 120 0 L 18 0 L 18 42 L 62 42 A 62 62 0 1 1 44 -44 L 85 -85 Z"
          fill="#dc2626"
        />
        <line x1="-126" y1="102" x2="107" y2="-130" stroke="#ca8a04" strokeWidth="17" strokeLinecap="round" />
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

  const renglon = (titulo: string, detalle: string) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginBottom: 26 }}>
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          color: "#18181b",
          width: 300,
          flexShrink: 0,
        }}
      >
        {titulo}
      </div>
      <div style={{ fontSize: 30, color: "#57534e" }}>{detalle}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#faf9f5",
          color: "#1c1917",
          padding: 96,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {marca}
          <div
            style={{
              // `display: flex` no es decorativo aquí: Satori rechaza un `<div>` con más
              // de un hijo que no lo declare, y este tiene el texto "GASTEIZ" y el
              // `<span>` de "CLICK". Sin esto el build falla con un error que no
              // señala la causa.
              display: "flex",
              fontSize: 104,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              marginTop: 8,
            }}
          >
            <span>GASTEIZ</span>
            <span style={{ color: "#dc2626" }}>CLICK</span>
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: "#a16207",
              letterSpacing: "0.06em",
              marginTop: 26,
              lineHeight: 1.25,
            }}
          >
            TODO VITORIA-GASTEIZ, EN UN SOLO SITIO
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {renglon("Qué hay", "conciertos, teatro, cine, deporte y planes con niños")}
          {renglon("Sin buscar", "no tienes que revolver 30 webs ni grupo de Facebook")}
          {renglon("Cada día", "te decimos qué merece la pena, y por qué")}
          {renglon("Gratis", "sin cuenta y sin instalar nada")}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 70, height: 3, background: "#dc2626" }} />
          <div style={{ fontSize: 30, color: "#78716c" }}>
            {ORIGEN_PROMO.replace("https://", "")}
          </div>
        </div>
      </div>
    ),
    TAMANO_PROMO
  );
}