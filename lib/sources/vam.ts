import * as cheerio from "cheerio";

const VAM_API = "https://app.vamcultura.es/functions/getPublicEvents";

/**
 * La caché de `og:image` es un `Map` a nivel de módulo, o sea que **dura lo que
 * dura el proceso** del servidor de Next. Antes de esto no tenía ni TTL ni tope:
 *
 * - Un `og:image` viejo se servía para siempre. Si el sitio cambiaba la imagen de
 *   un evento, la agenda seguía con la anterior, y como `enrichWithImages` corre en
 *   cada `scrapeVamEvents` —que entra en `agenda-all` cada 5 minutos— la imagen
 *   rancia se repinta indefinidamente. Solo un reinicio lo arreglaba.
 * - El `Map` crecía sin límite: una entrada por cada enlace distinto que aparece en
 *   el catálogo, y el catálogo rota eventos nuevos cada semana.
 *
 * **Lo que no pasaba, y conviene no dar por hecho:** las entradas negativas —las
 * que guardaban `undefined` cuando el `fetch` fallaba— no se leían nunca, porque el
 * guard era `if (cached !== undefined)` y un `undefined` guardado equivale a no
 * tener entrada. O sea que un 503 no dejaba imágenes sin imagen para siempre; lo
 * que dejaba era una entrada muerta por cada URL fallida. Aun así no se guardan:
 * una entrada que no se va a leer no tiene por qué ocupar sitio, y quitarlas es lo
 * que hace que el tope de tamaño signifique algo.
 *
 * El TTL es de una hora porque es una foto de una cartelera que cambia cada
 * semana, y `next: { revalidate: 86400 }` ya da la capa de abajo. El tope de 200
 * cubre de sobra el catálogo completo —el que más se ha visto son 13 eventos en
 * Vitoria— y existe para que un proceso de días no acumule entradas para siempre.
 */
const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_CACHE_MAX = 200;

type ImageCacheEntry = { url: string; expira: number };

const imageCache = new Map<string, ImageCacheEntry>();

/**
 * Vacía la caché de imágenes del módulo.
 *
 * La usan los tests, que si no comparten la primera respuesta entre casos, y
 * sirve para forzar un re scrape desde código. Es la misma puerta que exportan
 * `mercado-abastos.ts`, `civitatis.ts` y `kora.ts`, que este scraper no tenía.
 */
export function invalidateVamImages(): void {
  imageCache.clear();
}

function leerImagenCacheada(url: string): string | undefined {
  const entrada = imageCache.get(url);
  if (!entrada) return undefined;
  if (Date.now() >= entrada.expira) {
    imageCache.delete(url);
    return undefined;
  }
  return entrada.url;
}

function guardarImagenCacheada(clave: string, url: string): void {
  // El `Map` de JavaScript mantiene el orden de inserción y `keys()` los devuelve en
  // ese orden, así que el primero es el más antiguo y basta con borrar el primero
  // que salga. Con `size >= MAX` y no con `size > MAX` para no llegar a `MAX + 1`.
  if (imageCache.size >= IMAGE_CACHE_MAX) {
    const masAntigua = imageCache.keys().next();
    if (!masAntigua.done) imageCache.delete(masAntigua.value);
  }
  imageCache.set(clave, { url, expira: Date.now() + IMAGE_CACHE_TTL_MS });
}

const DEFAULT_EVENT_IMAGE =
  "https://opendata.euskadi.eus//contenidos/evento/2026070810071363/es_def/images/22.jpg";

function esVitoria(city: unknown): boolean {
  return /^vitoria/i.test(String(city || "").trim());
}

function inferCategory(vamCategory: string): string {
  const cat = vamCategory.toLowerCase();
  if (cat.includes("concierto") || cat.includes("música")) return "Música";
  if (cat.includes("teatro")) return "Teatro";
  if (cat.includes("danza")) return "Danza";
  if (cat.includes("cine")) return "Cine";
  if (cat.includes("exposic")) return "Exposiciones";
  if (cat.includes("festival")) return "Festival";
  if (cat.includes("infantil") || cat.includes("familiar")) return "Infantil";
  if (cat.includes("conferencia") || cat.includes("charla")) return "Conferencias";
  if (cat.includes("deporte") || cat.includes("senderismo")) return "Deporte";
  return "Otros";
}

function resolveImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  return `https://www.kulturklik.euskadi.eus${raw}`;
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  const cached = leerImagenCacheada(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    // Y los fallos **no** se guardan. Antes se guardaba `undefined`, que ocupaba
    // una entrada para siempre sin poder servirse nunca, porque el guard de
    // lectura comprobaba `!== undefined`. Lo que se hace es no escribir nada: el
    // siguiente intento vuelve a pedir la ficha, que es lo único que puede hacer que
    // aparezca. Tampoco se cachea el "200 sin imagen", que puede ser una página que
    // se pinta con JavaScript y que un despliegue posterior sí trae con `og:image`.
    if (!res.ok) return undefined;

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (ogImage) {
      const absolute = ogImage.startsWith("http")
        ? ogImage
        : new URL(ogImage, url).href;
      guardarImagenCacheada(url, absolute);
      return absolute;
    }

    const firstImg = $("article img, .content img, main img, .entry-content img")
      .first()
      .attr("src");
    if (firstImg) {
      const absolute = firstImg.startsWith("http")
        ? firstImg
        : new URL(firstImg, url).href;
      guardarImagenCacheada(url, absolute);
      return absolute;
    }

    return undefined;
  } catch {
    // Un error de red o un plazo agotado sí puede ser pasajero: no se guarda nada
    // para que el siguiente `scrapeVamEvents` vuelva a intentarlo.
    return undefined;
  }
}

async function enrichWithImages<T extends { image?: string; link: string; title?: string }>(
  events: T[],
  concurrency = 5
): Promise<T[]> {
  const needsOgImage = events.filter((e) => !e.image && e.link && e.link !== "#");
  const chunks: T[][] = [];
  for (let i = 0; i < needsOgImage.length; i += concurrency) {
    chunks.push(needsOgImage.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (e) => {
        const ogImage = await fetchOgImage(e.link);
        if (ogImage) e.image = ogImage;
      })
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.warn(`Failed to fetch og:image for ${chunk[i].link}`);
      }
    });
  }

  for (const e of events) {
    if (!e.image) {
      e.image = DEFAULT_EVENT_IMAGE;
    }
  }

  return events;
}

export type VamEvent = {
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
  description: string;
  time: string;
};

async function fetchAllVamEvents(): Promise<any[]> {
  const res = await fetch(VAM_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: "{}",
    next: { revalidate: 3600 },
    // Es la petición grande del scraper —trae todo el catálogo de eventos—, y sin
    // plazo una Function de Azure que acepta y no contesta deja la agenda entera
    // esperando en `Promise.allSettled`.
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? data.data ?? [];
}

export async function scrapeVamEvents(): Promise<VamEvent[]> {
  const allEvents = await fetchAllVamEvents();

  const events = allEvents
    .filter((e: any) => esVitoria(e.city))
    .map((e: any) => {
      const image = resolveImageUrl(e.image_url);
      const dateStr = e.date_start || e.date_end;
      const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      return {
        title: e.title || "Sin título",
        date,
        image,
        location: e.place || e.city || "Vitoria-Gasteiz",
        link: e.source_url || "#",
        category: inferCategory(e.category || ""),
        source: "vam",
        description: e.description || "",
        time: e.schedule_raw || "",
      };
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  await enrichWithImages(events);
  return events;
}

export async function scrapeVamConciertos(): Promise<any[]> {
  const allEvents = await fetchAllVamEvents();

  const events = allEvents
    .filter(
      (e: any) =>
        esVitoria(e.city) &&
        e.category?.includes("Concierto")
    )
    .map((e: any) => {
      const image = resolveImageUrl(e.image_url);
      const dateStr = e.date_start || e.date_end;
      const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      return {
        title: e.title || "Sin título",
        date,
        image,
        location: e.place || e.city || "Vitoria-Gasteiz",
        link: e.source_url || "#",
      };
    })
    .sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  await enrichWithImages(events);
  return events;
}
