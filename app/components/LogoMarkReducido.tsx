/**
 * La marca en los tamaños donde la completa no se lee.
 *
 * **Son tres piezas y el motivo está medido, no supuesto.** La marca completa
 * rasterizada: a 16 px no sobrevive nada —una mancha roja con una raya—; a 24 px,
 * que es exactamente lo que mide el `LogoMark` en la cabecera (`Header.tsx` la pinta
 * a `w-6 h-6 md:w-7 md:h-7`), solo quedan la G, la txapela y la raya del pincho, y las
 * otras tres son ruido; a 96 px sí se leen las seis. **Cuatro de seis piezas no existen
 * al tamaño en el que se pintaban.**
 *
 * Las tres que quedan son las que merecen quedarse, y ninguna por capricho: la
 * **txapela** es lo que dice que la marca es de aquí, y el **pincho en diagonal** es
 * la silueta —es lo único que distingue esta G roja de las otras mil, y por eso no se
 * endereza aunque de_enderseme cuadre más. La **G** es la G.
 *
 * **El pincho va más gordo, y esa es la mitad del trabajo.** No es solo borrar tres
 * grupos: el de la marca completa va con `strokeWidth="9"` sobre un lienzo de 512, que
 * a 32 px son 0,56 píxeles de grosor. Por debajo del píxel no se ve. Aquí sube a 17,
 * en las mismas unidades del mismo lienzo, así que engorda sin tocar la geometría.
 *
 * **No es un logo nuevo y no sustituye al otro.** `public/icon-512.svg` sigue siendo la
 * marca completa, porque a 192 y 512 px las seis piezas se leen y quitar tres sería
 * tirar información. Las dos van juntas: `Header` usa esta, los iconos usan la otra.
 * `__tests__/logo-marca.test.ts` vigila las dos y que no se confundan.
 *
 * **No lleva fondo crema**, igual que `LogoMark`: va sobre el fondo de la web, que
 * cambia con el tema, y un cuadrado crema sería un parche.
 */
export function LogoMarkReducido({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" aria-hidden="true">
      {/*
       * El mismo `translate` que lleva `LogoMark` y que este componente copiaba
       * sin. Las piezas van alrededor del origen y el `viewBox` es el cuadrado
       * entero, así que sin él la marca se pinta en la esquina y solo se ve un
       * cuadrante. El de `LogoMark` llevaba años así y por eso el logo de la cabecera
       * no se parecía al del icono de la pantalla de inicio.
       */}
      <g transform="translate(256, 256)">
      {/* La G: cuenco circular con abertura a la derecha y travesaño, para que se
          lea como letra y no como un anillo roto. Es el mismo trazado que en
          `LogoMark`, y lo es a propósito: una G con otro radio es otra marca. */}
      <path
        d="M 85 -85 A 120 120 0 1 0 120 16 L 120 0 L 18 0 L 18 42 L 62 42 A 62 62 0 1 1 44 -44 L 85 -85 Z"
        fill="var(--color-accent)"
      />

      {/* El pincho cruza en diagonal por delante de la G, y va después del path de la
          letra porque el orden de dibujo es el orden de las capas.

          **Más gordo que en la marca completa, de 9 a 17.** A 24 px el de 9 son 0,42
          píxeles: se ve una raya pálida o no se ve nada. Los 17 son justo lo que hace
          falta para que la diagonal se lea, que es lo que hace que esta marca se
          distinga de una G roja con un gorro negro encima. */}
      <line
        x1="-126"
        y1="102"
        x2="107"
        y2="-130"
        stroke="#ca8a04"
        strokeWidth="17"
        strokeLinecap="round"
      />

      {/* La txapela, con el tallo del txuntxurro que la hace boina y no sombrero.
          Es la única pieza que sobrevive intacta: es una masa negra maciza, y a 24 px
          una masa maciza se lee igual que a 96. */}
      <g transform="translate(-38, -120) rotate(-16)">
        <path d="M 0 -22 L 0 -11" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
        <path
          d="M -68 6 C -62 -22, 58 -28, 80 -2 C 84 14, -26 25, -68 6 Z"
          fill="currentColor"
        />
        <path
          d="M -54 8 C -20 20, 44 15, 66 5 C 46 13, -14 15, -54 8 Z"
          fill="currentColor"
          opacity="0.6"
        />
      </g>
      </g>
    </svg>
  );
}