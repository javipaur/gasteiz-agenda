import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Los objetivos táctiles por debajo de 44×44.
 *
 * Por qué se mide por parsing y no con jsdom: jsdom no calcula layout, así que
 * `getBoundingClientRect()` devuelve ceros en todos los elementos y cualquier
 * aserción sobre el tamaño real daría 0×0, que "cumple" y no comprueba nada. Un
 * snapshot del `className` tampoco sirve: daría verde con un `h-9` igual que con
 * un `h-11`, y el único cambio que importa es el número. La comprobación útil es
 * la aritmética: ¿declarados estos píxeles, el control mide al menos 44×44?
 *
 * Por qué una lista de controles y no `app/components/**`: el medidor sabe leer
 * un tamaño declarado, y con relleno más contenido compone una cota inferior
 * razonable. No sabe medir lo que viene del padre (`w-full`), ni distinguir un
 * botón de un acción de texto en línea — que WCAG 2.5.8 exime explícitamente por
 * la excepción "inline"—. Pasarle el directorio entero produciría una lista de
 * excepciones tan larga como el directorio y volvería a no mirar nada. La lista
 * es la de los controles corregidos, y se Amplía con el mismo criterio: un
 * control nuevo entra cuando alguien lo revisa.
 *
 * El mínimo son 44 CSS px. Es más exigente que AA —2.5.8 pide 24 px con
 * excepciones— pero es la cifra que ya usan el header, `BottomNav` e
 * `InstallBanner`, y el motivo por el que un botón de 36 px parece normal en el
 * repo y no lo es: por debajo de 44 la tasa de acierto con el pulgar cae en
 * torno al 60 %.
 */

// Este test vive en `__tests__/components/`, así que la raíz del repo está dos
// niveles arriba, no uno.
const ROOT = resolve(__dirname, "..", "..");
const MINIMO = 44;

/** Escala de espaciado de Tailwind: `--spacing` es 0.25rem, o sea 4 px por unidad. */
const UNIDAD = 4;

/** `text-*` de Tailwind, en px de alto de línea. */
const ALTO_DE_LINEA: Record<string, number> = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 32,
};

type Medida = { ancho: number | null; alto: number | null };

/**
 * Controles vigilados. El marcador es un atributo o un texto que **ya estaba** en
 * el elemento: no se añade para que el test lo encuentre, así que el fallo
 * sigue siendo identificable aunque el componente cambie de forma.
 */
const CONTROLES: { fichero: string; marcador: string; queEs: string }[] = [
  { fichero: "app/components/ThemeToggle.tsx", marcador: "aria-label={label}", queEs: "los tres botones de tema" },
  { fichero: "app/components/BusPageClient.tsx", marcador: 'aria-label="Limpiar búsqueda"', queEs: "la X de limpiar" },
  { fichero: "app/components/NextDaysSection.tsx", marcador: 'aria-label="Cerrar panel"', queEs: "Cerrar" },
  { fichero: "app/components/NextDaysSection.tsx", marcador: "role=\"tab\"", queEs: "las pestañas de día" },
  { fichero: "app/components/NextDaysSection.tsx", marcador: "setCategoryFilter(cat)", queEs: "los chips de categoría" },
  { fichero: "app/components/GastronomiaPageClient.tsx", marcador: 'role="tab"', queEs: "las pestañas de sección" },
  { fichero: "app/components/GastronomiaPageClient.tsx", marcador: "aria-pressed=", queEs: "los chips de barrio" },
  { fichero: "app/components/CategoryCarousel.tsx", marcador: 'aria-label="Siguiente"', queEs: "la flecha del riel" },
  { fichero: "app/components/TopEventsSection.tsx", marcador: 'aria-label="Anterior"', queEs: "la flecha del riel" },
  { fichero: "app/components/CookieConsent.tsx", marcador: "onClick={accept}", queEs: "el botón de aceptar" },
];

/**
 * Quita las interpolaciones `${…}` de un cuerpo JSX.
 *
 * Un regex no vale: dentro de un `className` de este repo hay plantillas
 * anidadas con su propio `}` dentro, y `${[^}]*}` se corta por la mitad y
 * devuelve una clase basura. Se recorre contando profundidad y tratando los
 * acentos graves como delimitadores opacos, que es lo que separa el
 * interpolado de su contenido.
 */
function sinInterpolaciones(cuerpo: string): string {
  let salida = "";
  let i = 0;
  while (i < cuerpo.length) {
    if (cuerpo[i] === "$" && cuerpo[i + 1] === "{") {
      let profundidad = 1;
      i += 2;
      while (i < cuerpo.length && profundidad > 0) {
        const c = cuerpo[i];
        if (c === "`") {
          // Cadena anidada: se salta entera, con su `}` dentro.
          i++;
          while (i < cuerpo.length && cuerpo[i] !== "`") {
            if (cuerpo[i] === "\\") i++;
            i++;
          }
          i++;
          continue;
        }
        if (c === "{") profundidad++;
        else if (c === "}") profundidad--;
        i++;
      }
      salida += " ";
      continue;
    }
    salida += cuerpo[i];
    i++;
  }
  return salida;
}

/**
 * Extrae el literal estático de un `className`.
 *
 * Se descartan las clases que decide el padre en tiempo de ejecución, y medirlas
 * aquí sería inventarse un tamaño. `FavoriteButton` es el caso que importa —guarda
 * su caja en una constante del fichero— y tiene su comprobación propia.
 */
function clasesEstaticas(cuerpo: string): string[] {
  const limpio = sinInterpolaciones(cuerpo);
  const valor =
    limpio.match(/className="([^"]*)"/)?.[1] ?? limpio.match(/className=\{`([^`]*)`\}/)?.[1] ?? "";
  return valor.split(/\s+/).filter(Boolean);
}

/** Quita los prefijos de variante: `hover:`, `md:`, `disabled:`, `active:`… */
function sinVariantes(clase: string): string {
  const partes = clase.split(":");
  return partes[partes.length - 1];
}

function px(clase: string): number | null {
  const arbitrario = clase.match(/^\[(\d+(?:\.\d+)?)px\]$/);
  if (arbitrario) return Number(arbitrario[1]);
  const escala = clase.match(/^(\d+(?:\.\d+)?)$/);
  if (escala) return Number(escala[1]) * UNIDAD;
  return null;
}

/**
 * Cota inferior del tamaño declarado por las clases.
 *
 * Con `size-*`, `w-*`/`h-*` o `min-w`/`min-h` el tamaño está escrito y se lee
 * directo. Sin nada de eso el control se dimensiona con su relleno más el
 * contenido, así que se suman `padding` y el alto de línea del texto. Lo que no
 * se puede determinar devuelve `null` en ese eje, y entonces el control **no se
 * juzga**: preferimos no comprobar a dar un verde falso.
 */
function medir(clases: string[]): Medida {
  let ancho: number | null = null;
  let alto: number | null = null;
  let pxX = 0;
  let pxY = 0;
  let texto: number | null = null;
  let dePadre = false;

  const subir = (eje: "ancho" | "alto", v: number) => {
    if (eje === "ancho") ancho = Math.max(ancho ?? 0, v);
    else alto = Math.max(alto ?? 0, v);
  };

  for (const bruta of clases) {
    const clase = sinVariantes(bruta);
    if (!clase) continue;
    if (clase === "full") {
      dePadre = true;
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = clase.match(/^size-(.+)$/))) {
      const v = px(m[1]);
      if (v !== null) {
        subir("ancho", v);
        subir("alto", v);
        continue;
      }
    }
    if ((m = clase.match(/^min-([wh])-(.+)$/))) {
      const v = px(m[2]);
      if (v !== null) subir(m[1] === "w" ? "ancho" : "alto", v);
      continue;
    }
    if ((m = clase.match(/^([wh])-(.+)$/))) {
      const v = px(m[2]);
      if (v === null) {
        // `w-1/2`, `w-full`, `h-screen`… no son un tamaño en píxeles.
        dePadre = true;
        continue;
      }
      subir(m[1] === "w" ? "ancho" : "alto", v);
      continue;
    }
    if ((m = clase.match(/^p([xy])?-(.+)$/))) {
      const v = px(m[2]);
      if (v === null) continue;
      if (!m[1]) {
        pxX += v;
        pxY += v;
      } else if (m[1] === "x") pxX += v;
      else pxY += v;
      continue;
    }
    if (clase.startsWith("text-")) {
      const resto = clase.slice(5);
      const arbitrario = resto.match(/^\[(\d+(?:\.\d+)?)px\]$/);
      if (arbitrario) {
        texto = Math.max(texto ?? 0, Number(arbitrario[1]));
        continue;
      }
      // `text-fg`, `text-white/40`, `text-red-500`… no son tamaños y no se tocan.
      if (resto in ALTO_DE_LINEA) texto = Math.max(texto ?? 0, ALTO_DE_LINEA[resto]);
    }
  }

  const contenido = texto ?? 0;
  // Sólo se compone cuando **ninguno** de los dos ejes está declarado. Si el
  // alto está escrito (`h-9`) y el ancho no, el ancho es el del texto que lleva
  // dentro y aquí no se sabe: se deja en `null` en vez de inventar un `0` que lo
  // marcaría como defecto falso.
  if (ancho === null && alto === null && !dePadre) {
    return { ancho: pxX + contenido, alto: pxY + contenido };
  }
  return { ancho, alto };
}

/**
 * Abre un elemento JSX desde `inicio` hasta su `>`.
 *
 * Hay que contar la profundidad de llaves, paréntesis y corchetes porque los
 * `className` de este repo son plantillas con `${…}`, y un `>` de arrow function
 * no cierra el elemento. Con texto entrecomillado o con acentos graves se
 * ignoran los caracteres de dentro.
 */
function apertura(fuente: string, inicio: number): string {
  let profundidad = 0;
  let comilla: string | null = null;
  for (let i = inicio + 1; i < fuente.length; i++) {
    const c = fuente[i];
    if (comilla) {
      if (c === "\\") i++;
      else if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      comilla = c;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") profundidad++;
    else if (c === "}" || c === ")" || c === "]") profundidad--;
    else if (c === ">" && profundidad === 0) return fuente.slice(inicio, i + 1);
  }
  return "";
}

function lineaDe(fuente: string, indice: number): number {
  return fuente.slice(0, indice).split("\n").length;
}

/** Los `<button>`/`<a>` de un fichero cuyo cuerpo contiene el marcador dado. */
function marcadosCon(fuente: string, marcador: string): { linea: number; clases: string[] }[] {
  const salida: { linea: number; clases: string[] }[] = [];
  const tag = /<(?:button|a)(?=[\s/>])/g;
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = tag.exec(fuente)) !== null) {
    const cuerpo = apertura(fuente, coincidencia.index);
    if (!cuerpo.includes(marcador)) continue;
    const clases = clasesEstaticas(cuerpo);
    if (clases.length === 0) continue;
    salida.push({ linea: lineaDe(fuente, coincidencia.index), clases });
  }
  return salida;
}

/**
 * `FavoriteButton` calcula su caja en una constante y la interpola, así que no
 * hay `className` estático que medir. Se lee la constante directamente: es el
 * mismo valor que la interpolación usa, y el test sigue dando rojo si alguien
 * deja cualquiera de los dos tamaños por debajo del mínimo.
 *
 * De las cadenas del inicializador sólo interesan las que parecen clases —las
 * que llevan un `size-`/`w-`/`h-`—, porque ahí también viven los nombres del
 * tamaño (`"sm"`, `"md"`), que medidos como clases no dicen nada.
 *
 * Cada rama se mide por separado a propósito. Juntas, el `Math.max` dejaría que
 * una rama buena tapara a una mala: con `sm: "w-9 h-9"` y `md: "w-11 h-11"` el
 * resultado sería 44 y el botón pequeño volvería a pasar sin que nadie lo note.
 */
function cajaDeFavoriteButton(): string[][] {
  const fuente = readFileSync(join(ROOT, "app/components/FavoriteButton.tsx"), "utf8");
  const asignacion = fuente.match(/const\s+(?:box|caja|CAJA)\s*=\s*([^;]+);/);
  if (!asignacion) return [];
  return [...asignacion[1].matchAll(/["']([^"']*)["']/g)]
    .map((m) => m[1])
    .filter((s) => /(^|\s)(size|w|h|min-w|min-h)-/.test(s))
    .map((s) => s.split(/\s+/).filter(Boolean));
}

/**
 * Texto del fallo: sin clases y sin números, un rojo de tamaño no es accionable.
 *
 * Basta con que **un** eje conocido quede por debajo: el ancho puede ser `null`
 * —no medible— sin que eso absuelva al control. Un botón con `h-9` mide 36 de
 * alto por mucho que su ancho no se sepa aquí.
 */
function detalles(controles: { linea: number; clases: string[] }[], fichero: string): string[] {
  return controles.flatMap(({ linea, clases }) => {
    const m = medir(clases);
    const ancho = m.ancho === null ? "?" : String(m.ancho);
    const alto = m.alto === null ? "?" : String(m.alto);
    if (m.ancho === null && m.alto === null) return [];
    if ((m.ancho !== null && m.ancho >= MINIMO) || (m.alto !== null && m.alto >= MINIMO)) return [];
    return [`${fichero}:${linea} — ${ancho}x${alto} < ${MINIMO} — clases: ${clases.join(" ")}`];
  });
}

describe("objetivos táctiles de 44x44", () => {
  it.each(CONTROLES)("$fichero: $queEs", ({ fichero, marcador }) => {
    const fuente = readFileSync(join(ROOT, fichero), "utf8");
    const controles = marcadosCon(fuente, marcador);
    // Si el marcador dejara de encontrar nada, el test daría verde por no haber
    // comprobado nada. Se avisa de ello explícitamente.
    expect(controles.length).toBeGreaterThan(0);
    expect(detalles(controles, fichero)).toEqual([]);
  });

  it("FavoriteButton declara una caja de 44 para los dos tamaños", () => {
    const ramas = cajaDeFavoriteButton();
    // Tiene que haber al menos dos: `sm` y `md`. Con una sola, el test no
    // comprobaría el tamaño pequeño, que es el que estaba mal.
    expect(ramas.length).toBeGreaterThanOrEqual(2);
    const fallos = ramas.flatMap((clases, i) =>
      detalles([{ linea: i + 1, clases }], `FavoriteButton[${i}]`)
    );
    expect(fallos).toEqual([]);
  });

  it("el patrón de referencia del repo se mide bien", () => {
    // El medidor contra sí mismo: si su aritmética no cuadra, el resto de la
    // suite no significa nada. `InstallBanner` usa `p-2.5 min-w-[44px] min-h-[44px]`,
    // el patrón que ya estaba bien y que el resto de la lista imita.
    const fuente = readFileSync(join(ROOT, "app/components/InstallBanner.tsx"), "utf8");
    const referencia = fuente.match(/className="p-2\.5 min-w-\[44px\] min-h-\[44px\][^"]*"/);
    expect(referencia).not.toBeNull();
    expect(medir(referencia![0].slice('className="'.length, -1).split(/\s+/))).toEqual({
      ancho: MINIMO,
      alto: MINIMO,
    });
  });
});
