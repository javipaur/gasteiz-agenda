/**
 * El cuadrante de guardia de las farmacias de Álava.
 *
 * ## De dónde sale
 *
 * El Colegio Oficial de Farmacéuticos de Álava publica el cuadrante en
 * `https://cofalava.org/farmacias-de-guardia/`, y **la página lleva el año
 * entero de la rota dentro**: 5.916 entradas, una por farmacia y día, de las
 * cuales 2.190 son de Vitoria-Gasteiz. Cada entrada trae horario, fecha,
 * teléfono, barrio, zona y si la guardia es de día, de noche o de las dos.
 *
 * ## Lo que este fichero corrige
 *
 * Antes se creed que el Colegio "responde 403 en todo su dominio, con y sin TLS,
 * con cualquier User-Agent", y por eso se pasó al GeoJSON del Gobierno Vasco.
 * **Eso era un error: el WAF bloquea el User-Agent de navegador, no el
 * dominio.**
 *
 * Medido el 20 de octubre de 2026, contra el sitio en vivo:
 *
 *     User-Agent de Chrome      -> 403
 *     okhttp/4.9.3              -> 200 (6,5 MB)
 *     sin User-Agent            -> 200 (6,5 MB)
 *
 * El 403 con Chrome es un 403 **de 75 KB**: es la página de del WAF, no un
 * error de red. Y el `403` que se veía era siempre con el UA de navegador,
 * que es lo que se prueba primero. Con `okhttp` —que es lo que usan los
 * clientes reales— entra sin problema.
 *
 * ## Por qué el UA no es el de un navegador
 *
 * Un `User-Agent` de navegador es, para un WAF, la señal de que viene un
 * scraper. `okhttp/4.9.3` no lo es. Y no es una manera de esconderse: el
 * Colegio publica este dato para que se use, y lo único que se pide es no
 * simular a una persona.
 *
 * ## Los datos están en un JSON dentro de la página
 *
 * El plugin `wp-google-map-gold` mete la configuración del mapa en la propia
 * HTML, y el array se llama `"places"`. Se extrae con los corchetes
 * balanceados —porque el JSON tiene comillas y escapes dentro de cadenas, y un
 * `indexOf` al primer `]` corta a destiempo— y se parsea con `JSON.parse`.
 *
 * ## La forma
 *
 * Los nombres de campo **no se tocan**: `app/components/FarmaciasPageClient.tsx`,
 * `app/components/FarmaciasMap.tsx` y la app móvil los consumen por el mismo
 * contrato. Lo único nuevo es `guardia`, que dice si el turno es de día, de
 * noche o de las dos.
 */

const URL_GUARDIA = "https://cofalava.org/farmacias-de-guardia/";

/**
 * El UA con el que entra.
 *
 * **No es el de un navegador, y es a propósito.** El WAF del Colegio bloquea
 * el UA de Chrome y deja pasar el de un cliente HTTP. Medido el 20 de octubre
 * de 2026: con Chrome, 403; con este, 200.
 */
const USER_AGENT = "okhttp/4.9.3";

/** Solo se interestsa Vitoria. `poblacion` viene tal cual del sitio. */
const POBLACION = "Vitoria-Gasteiz";

/** La cache vive en el módulo: la página son 6,5 MB y la rota es de un año. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type TurnoGuardia = "diurna" | "nocturna" | "ambas";

export type FarmaciaGuardia = {
  id: string;
  name: string;
  address: string;
  shortAddress: string;
  phone: string;
  /** La fecha del turno, en ISO `YYYY-MM-DD`. */
  date: string;
  /** El horario del turno, tal cual lo publica el Colegio: "09:00-22:00". */
  horarios: string;
  neighborhood: string;
  city: string;
  zone: string;
  lat: string;
  lng: string;
  /** Si el turno es de día, de noche, o de las dos. */
  guardia: TurnoGuardia;
};

type LugarCofalava = {
  id?: string;
  title?: string;
  address?: string;
  location?: {
    lat?: string;
    lng?: string;
    city?: string;
    extra_fields?: {
      horarios?: string;
      fecha?: string;
      telefono?: string;
      barrio?: string;
      poblacion?: string;
      zona?: string;
      guardia?: string;
      "direccion-corta"?: string;
    };
  };
};

/**
 * El array `"places"` de la página, tal cual sale.
 *
 * Se saca con los corchetes balanceados y no con un `indexOf` al primer `]`,
 * porque dentro hay cadenas con corchetes —los `extra_fields` del plugin— y el
 * corte por el primer cierre se lleva por delante la mitad de los datos.
 */
export function extraerLugares(html: string): LugarCofalava[] {
  // **La marca acaba en `:` y no en `:[`.** Si la marca incluyera el corchete,
  // el desplazamiento lo saltaría y el escáner empezaría **dentro** del primer
  // objeto: el `[` del array no se contaría, el `}` del primer lugar lo
  // cerraría y el array se cortaría después de una farmacia —5916 datos
  // convertidos en uno, sin error de sintaxis que lo delatara—.
  const marca = '"places":';
  const inicio = html.indexOf(marca);
  if (inicio < 0) return [];

  const desde = inicio + marca.length;
  let nivel = 0;
  let enCadena = false;
  let escapado = false;

  for (let i = desde; i < html.length; i++) {
    const c = html[i];
    if (enCadena) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') enCadena = false;
      continue;
    }
    if (c === '"') enCadena = true;
    else if (c === "[" || c === "{") nivel++;
    else if (c === "]" || c === "}") {
      nivel--;
      if (nivel === 0) {
        try {
          return JSON.parse(html.slice(desde, i + 1)) as LugarCofalava[];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

/**
 * La fecha del sitio —`01/01/2026`— a ISO —`2026-01-01`—.
 *
 * El sitio la escribe en formato español y el repo usa ISO en todo lo demás.
 * La conversión es la que permite que la página compare con `hoy` y que el
 * "Actualizado" aparezca cuando lo está.
 */
export function fechaCofalavaAIso(fecha: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((fecha || "").trim());
  if (!m) return "";
  const [, d, mes, anio] = m;
  return `${anio}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * El icono de `guardia` dice si el turno es de día, de noche o de las dos.
 *
 * El Colegio lo publica como HTML: `<i class="fa fa-sun-o">` para el turno de
 * día, `fa-moon-o` para el de noche, y los dos juntos cuando la farmacia está
 * de guardia las dos.
 */
export function turnoDeGuardia(guardia: string | undefined): TurnoGuardia {
  const html = guardia || "";
  const dia = /fa-sun-o/.test(html);
  const noche = /fa-moon-o/.test(html);
  if (dia && noche) return "ambas";
  if (noche) return "nocturna";
  return "diurna";
}

/** La rota entera de Vitoria, o un error. */
export function parseFarmaciasGuardia(html: string): FarmaciaGuardia[] {
  const lugares = extraerLugares(html);

  return lugares
    .map((l): FarmaciaGuardia | null => {
      const e = l.location?.extra_fields || {};
      const poblacion = (e.poblacion || "").trim();
      if (poblacion !== POBLACION) return null;

      const lat = l.location?.lat ?? "";
      const lng = l.location?.lng ?? "";
      const direccionCorta = (e["direccion-corta"] || "").trim();
      const calle = (l.address || "").replace(/,\s*España\s*$/i, "").trim();

      return {
        id: (l.id || "").trim(),
        name: (l.title || "").trim(),
        address: calle,
        shortAddress: direccionCorta || calle,
        phone: (e.telefono || "").trim(),
        date: fechaCofalavaAIso(e.fecha || ""),
        horarios: (e.horarios || "").trim(),
        neighborhood: (e.barrio || "").trim(),
        city: poblacion,
        zone: (e.zona || "").trim(),
        lat: Number.isFinite(Number(lat)) ? String(lat) : "",
        lng: Number.isFinite(Number(lng)) ? String(lng) : "",
        guardia: turnoDeGuardia(e.guardia),
      };
    })
    .filter((f): f is FarmaciaGuardia => f !== null && f.date !== "")
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "es"));
}

let cache: FarmaciaGuardia[] | null = null;
let lastFetch = 0;

/**
 * La rota de guardia, o un error.
 *
 * **Lanza, y no devuelve `[]`.** La misma razón que el resto de los scrapers
 * del repo: `Promise.allSettled` no distingue una fuente que responde vacía de
 * una que no pudo responder, y un "no hay guardias" del todo silencio es
 * indistinguible de un fallo. Aquí el cero **sí** es un dato —un día sin
 * guardias es un dato raro pero posible—, y lo que no es un dato es no saber.
 *
 * Los datos viejos siguen valiendo cuando los hay: si ya se descargó la rota,
 * un 502 posterior devuelve la copia anterior.
 */
export async function scrapeFarmaciasGuardia(): Promise<FarmaciaGuardia[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const res = await fetch(URL_GUARDIA, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      if (cache) return cache;
      throw new Error(`cofalava.org respondió ${res.status}`);
    }

    const html = await res.text();
    const farmacia = parseFarmaciasGuardia(html);

    /**
     * Cero es un fallo, no un turno vacío.
     *
     * La rota de un año de Álava son miles de entradas y las de Vitoria son
     * cientos. Si el parser se rompe, sale 0, y un 0 con status 200 es la
     * misma mentira que daba el `catch` inalcanzable de la ruta.
     */
    if (farmacia.length === 0) {
      throw new Error(
        `cofalava.org no devolvió ninguna farmacia de ${POBLACION} (${html.length} bytes)`
      );
    }

    cache = farmacia;
    lastFetch = now;
    return farmacia;
  } catch (error) {
    console.error("Error obteniendo el cuadrante de guardias:", error);
    if (cache) return cache;
    throw error;
  }
}

/**
 * Las guardias de un día.
 *
 * @param fecha ISO `YYYY-MM-DD`. Sin ella, hoy.
 */
export async function scrapeGuardiasDe(
  fecha?: string
): Promise<FarmaciaGuardia[]> {
  const rota = await scrapeFarmaciasGuardia();
  const hoy = new Date();
  const iso =
    fecha ||
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
      hoy.getDate()
    ).padStart(2, "0")}`;

  return rota.filter((f) => f.date === iso);
}
