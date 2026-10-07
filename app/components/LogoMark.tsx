/**
 * La marca en la cabecera.
 *
 * **Es el mismo dibujo que `public/brand-mark.svg`, y son dos ficheros a
 * propósito.** El del PWA lo sirve el sistema operativo, que no puede importar
 * un componente de React ni heredar el tema de la web, así que necesita el SVG
 * plano con el color escrito. Este es el que se pinta en el navegador, y por eso
 * lleva el acento por prop: la espiral era roja en verano y verde en otoño, y eso
 * es una decisión del rebrand que el logo del escritorio no puede tener.
 *
 * Lo que cambia aquí y no en el SVG del PWA es **solo el color de la G**, que
 * aquí es `var(--color-accent)` en vez de un rojo fijo. Todo lo demás —la
 * txapela, la nota, el pincho, la gilda, el cursor— es el mismo trazado, y
 * `__tests__/logo-marca.test.ts` es lo que vigila que los dos no se separen.
 *
 * **Lo que no lleva y por qué.** El fondo crema del SVG tampoco: este logo va
 * sobre el fondo de la página, que cambia con el tema, y un cuadrado crema sería
 * un parche. Y no lleva `width`/`height` en el `<svg>`, porque quien lo pinta le
 * pasa el tamaño por `className` y un tamaño fijo se lo ignores.
 */
type LogoMarkProps = {
  className?: string;
  /** La G. Por defecto el acento de la estación. */
  g?: string;
  /** Todo lo negro: txapela, nota y cursor. */
  ink?: string;
  /** El pincho. */
  pincho?: string;
  /** La gilda: aceituna y guindillo. */
  gilda?: string;
  /** El rojo del pimentón dentro de la aceituna, y las ondas del cursor. */
  rojo?: string;
  /** El crema del destello de la aceituna y del contorno del cursor. */
  crema?: string;
};

export function LogoMark({
  className,
  g = "var(--color-accent)",
  ink = "currentColor",
  pincho = "#ca8a04",
  gilda = "#65a30d",
  rojo = "#dc2626",
  crema = "#faf9f5",
}: LogoMarkProps) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" aria-hidden="true">
      {/* La G: cuenco circular con abertura a la derecha y travesaño, para que
          se lea como letra y no como un anillo roto. */}
      <path
        d="M 85 -85 A 120 120 0 1 0 120 16 L 120 0 L 18 0 L 18 42 L 62 42 A 62 62 0 1 1 44 -44 L 85 -85 Z"
        fill={g}
      />

      {/* La nota, dentro de la curva de la G. */}
      <g transform="translate(-18, -48)">
        <ellipse cx="0" cy="14" rx="14" ry="10" transform="rotate(-26, 0, 14)" fill={ink} />
        <rect x="7" y="-28" width="8" height="42" rx="4" fill={ink} />
        <path d="M 15 -28 C 30 -28 36 -12 36 6 C 30 -4 23 -12 15 -14 Z" fill={ink} />
      </g>

      {/* El pincho cruza en diagonal **por delante** de la G, y es por eso que
          va después del path de la letra: el orden de dibujo es el orden de las
          capas. */}
      <line x1="-135" y1="110" x2="115" y2="-140" stroke={pincho} strokeWidth="9" strokeLinecap="round" />

      {/* La gilda: la aceituna con el centro rojo del pimentón. */}
      <g transform="translate(-24, 2)">
        <circle cx="0" cy="0" r="22" fill={gilda} />
        <circle cx="0" cy="0" r="18" fill="#4d7c0f" />
        <circle cx="0" cy="0" r="8" fill={rojo} />
        <circle cx="-5" cy="-5" r="3.5" fill={crema} />
      </g>

      {/* El guindillo curvado rodeando el pincho. */}
      <path d="M -60 14 C -42 -22, 10 -28, 48 -6 C 22 18, -26 24, -60 14 Z" fill="#4d7c0f" />
      <path d="M -48 6 C -34 -14, 4 -18, 36 -2 C 18 10, -20 14, -48 6 Z" fill={gilda} />
      <path d="M -60 14 C -72 12, -80 6, -84 -4 C -80 2, -72 8, -64 12 Z" fill="#365314" />

      {/* La txapela, con el tallo del txuntxurro que la hace boina y no
          sombrero. */}
      <g transform="translate(-38, -120) rotate(-16)">
        <path d="M 0 -22 L 0 -11" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        <path d="M -68 6 C -62 -22, 58 -28, 80 -2 C 84 14, -26 25, -68 6 Z" fill={ink} />
        <path d="M -54 8 C -20 20, 44 15, 66 5 C 46 13, -14 15, -54 8 Z" fill={ink} opacity="0.75" />
      </g>

      {/* El cursor y sus ondas. El contorno crema es lo que lo separa de la G
          cuando se solapan. */}
      <g transform="translate(108, 18)">
        <path d="M -14 -22 A 26 26 0 0 1 -14 22" fill="none" stroke={rojo} strokeWidth="6.5" strokeLinecap="round" />
        <path d="M -4 -34 A 40 40 0 0 1 -4 34" fill="none" stroke={rojo} strokeWidth="5.5" strokeLinecap="round" />
        <path
          d="M 10 -16 L 40 28 L 24 29 L 34 50 L 23 55 L 13 34 L 1 42 Z"
          fill={ink}
          stroke={crema}
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}