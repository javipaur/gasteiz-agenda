import { eventSlug } from "@/lib/slug";
// `import type` y no `import`: TypeScript lo borra al compilar, y este módulo lo
// importan los tests sin DOM. El tipo vive en el contexto porque es el tipo
// público del store, pero lo que se persiste es lo que este fichero define.
import type { FavoriteEvent } from "./FavoritesContext";

/**
 * Los favoritos se guardaban con el id que ponía `lib/eventos.ts`, que era un
 * `crypto.randomUUID()` distinto en cada re-scraping. Como el slug se deriva de
 * título, fecha y enlace —los tres sí estaban guardados— el id se puede rehacer
 * al leer, y los favoritos que la gente ya tenía sobreviven a la unificación.
 *
 * Esto no es prevención: es reparación. Sin esto, cada visita posterior al
 * despliegue que unificaba el agregador habría dejado los corazones vacíos.
 */
export function migrateFavorites(stored: unknown): FavoriteEvent[] {
  if (!Array.isArray(stored)) return [];

  const out: FavoriteEvent[] = [];
  for (const raw of stored as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;

    const title = typeof f.title === "string" ? f.title : "";
    const date = typeof f.date === "string" ? f.date : "";
    // Sin título o sin fecha no hay slug que rehacer. Se descartan en vez de
    // inventarles uno: un id falso daría un favorito que cuenta en la cabecera y
    // ocupa sitio en `/favoritos`, pero cuyo corazón no puede encenderse ni
    // apagarse nunca.
    if (!title || !date) continue;

    // El `"#"` lo emiten algunas fuentes y `normalizeRaw` del agregador lo
    // descarta. Si la migración no hiciera lo mismo, un favorito guardado con
    // `"#"` y el mismo evento ya scraped con su URL real darían dos ids.
    const link = typeof f.link === "string" && f.link !== "#" ? f.link : "";
    const slug = eventSlug({ title, date, link });

    out.push({ ...(f as unknown as FavoriteEvent), id: slug, slug });
  }
  return out;
}

/**
 * Lectura del `localStorage`: parseo y migración en un solo sitio, para que el
 * JSON corrupto no dependa de un `try` en el componente y quede probado.
 * `null` es lo que devuelve `getItem` cuando no hay nada guardado.
 */
export function readFavorites(raw: string | null): FavoriteEvent[] {
  if (!raw) return [];
  try {
    return migrateFavorites(JSON.parse(raw));
  } catch {
    return [];
  }
}
