// Farmacias de Vitoria-Gasteiz.
//
// La fuente **de guardia** no es accesible: `cofalava.org` responde 403 en todo
// su dominio —home, `/farmacias-de-guardia/` y el `wf_municipioGuardiaslst.aspx`
// que enlaza el Consejo General— con y sin TLS, con cualquier User-Agent. No es
// una ruta que haya caducado: es un WAF que bloquea por IP. El Consejo General
// (`farmaceuticos.com`) redirige al mismo sitio, `datos.gob.es` esta detras de
// Incapsula y el Ayuntamiento no publica el turno. Es decir: no hay ninguna
// fuente oficial del cuadrante, y esquivar el WAF a proposito no es una opcion.
//
// Lo que si es oficial, abierto y sin WAF es el GeoJSON del Gobierno Vasco, que
// es un **directorio**, no un cuadrante: no trae turno, ni horario, ni fecha.
// Se asume el cambio de significado de forma explicita —la pantalla se titula
// "Farmacias en Vitoria"— en vez de seguir diciendo "de guardia" sobre datos que
// no son de guardia.
//
//   https://opendata.euskadi.eus/contenidos/ds_localizaciones/farmacias_y_botiquines_euskadi/opendata/farmacias.geojson
//
// 843 farmacias en Euskadi, 78 en Vitoria-Gasteiz. CC BY, actualizacion mensual,
// sin autenticacion.
//
// **Los nombres de campo no se tocan.** `app/components/FarmaciasMap.tsx` y
// `app/components/FarmaciasPageClient.tsx` ya consumen `name`, `address`,
// `shortAddress`, `phone` y `horarios`, y la app movil los consume por el mismo
// contrato. Cambiar la fuente no es motivo para renombrar la forma: es la misma
// respuesta con otro origen.

const BASE_URL =
  "https://opendata.euskadi.eus/contenidos/ds_localizaciones/farmacias_y_botiquines_euskadi/opendata/farmacias.geojson";

/** El GeoJSON trae los 150 municipios de Euskadi; solo interesa Vitoria. */
const MUNICIPIO = "VITORIA-GASTEIZ";

/** Etiqueta para el registro sin `titular1`, que es uno de los 78 de Vitoria. */
const SIN_NOMBRE = "Farmacia (nombre no publicado)";

export type FarmaciaGuardia = {
  id: string;
  name: string;
  address: string;
  shortAddress: string;
  phone: string;
  date: string;
  horarios: string;
  neighborhood: string;
  city: string;
  zone: string;
  lat: string;
  lng: string;
};

type FeatureFarmacia = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    titular1?: string;
    idif?: string;
    direccion?: string;
    municipio?: string;
    cp?: string;
    provincia?: string;
    telefono?: string;
  };
};

let cache: FarmaciaGuardia[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6;

export function parseFarmaciasGeojson(raw: string): FarmaciaGuardia[] {
  let parsed: { features?: FeatureFarmacia[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const features = Array.isArray(parsed.features) ? parsed.features : [];

  return features
    .filter((f) => {
      const municipio = (f.properties?.municipio || "").trim().toUpperCase();
      return municipio === MUNICIPIO;
    })
    .map((f): FarmaciaGuardia => {
      const p = f.properties || {};
      // GeoJSON es [longitud, latitud]: el orden invertido al que los espera
      // Leaflet, que va [latitud, longitud].
      const [lng, lat] = f.geometry?.coordinates || [];
      const calle = (p.direccion || "").trim();
      const cp = (p.cp || "").trim();
      // Una de las 78 llega sin `titular1`: el Colegio tiene la direccion y el
      // telefono pero no el nombre del titular. Se conserva con una etiqueta en
      // vez de droparla, porque es una farmacia de verdad con un telefono al que
      // llamar, y filtrarla seria esconderla del usuario. Tirar el registro
      // entero haria que el recuento no cuadrase con la fuente.
      const titular = (p.titular1 || "").trim();

      return {
        // `idif` es el identificador de la farmacia en el registro sanitario.
        // Antes era el id del marcador del mapa, que no existe aqui; sin id
        // unico el mapa y la lista no tienen clave estable.
        id: (p.idif || "").trim(),
        name: titular || SIN_NOMBRE,
        shortAddress: calle,
        address: [calle, [cp, (p.municipio || "").trim()].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", "),
        phone: (p.telefono || "").trim(),
        // El directorio no publica turno ni horario de guardia: se dejan vacios
        // y no se inventan. `FarmaciasMap.tsx` ya trata "" como "no mostrar".
        date: "",
        horarios: "",
        neighborhood: "",
        city: (p.municipio || "").trim(),
        zone: "",
        // Se siguen exportando como string porque es lo que hacia el scraper
        // anterior y lo que el mapa ya consume con `Number(f.lat)`.
        lat: Number.isFinite(lat) ? String(lat) : "",
        lng: Number.isFinite(lng) ? String(lng) : "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function scrapeFarmacias(): Promise<FarmaciaGuardia[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) {
    return cache;
  }

  try {
    const res = await fetch(BASE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      if (cache) return cache;
      return [];
    }

    const farmacias = parseFarmaciasGeojson(await res.text());

    cache = farmacias;
    lastFetch = now;

    return farmacias;
  } catch (error) {
    console.error("Error obteniendo las farmacias de Vitoria:", error);
    if (cache) return cache;
    return [];
  }
}