import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { localDateKey, slugify } from "./slug";
import { logger } from "./axiom/server";

/**
 * El registro de eventos vistos: la memoria que la agenda no tenía.
 *
 * El agregado se reconstruye entero en cada petición desde las fuentes, así que
 * no hay ningún sitio donde un evento que desaparece deje rastro. Un plan que
 * estaba ayer y hoy no está se sirve igual de bien —y se pierde igual de
 * silencio— que uno que nunca existió. Este módulo guarda qué se vio y en qué
 * importación, para que una ausencia sea un dato y no un hueco.
 *
 * Es SQLite por lo mismo que las métricas y el push: ya está en el proyecto, ya
 * tiene sus migraciones, y ya hay un volumen persistente montado en `.data/`.
 *
 * **Shadow mode.** Nada de lo que hay aquí decide qué se sirve todavía. Escribe
 * el registro y nada más; la detección de ausencias y el 410 llegan después, y
 * por eso el registro no puede tumbar la agenda: `registrarImportacionSegura`
 * envuelve todo y, si la base no se puede abrir, avisa y devuelve `null`.
 */

const DB_DIR = process.env.EVENT_LEDGER_DB_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "event-ledger.db");

/**
 * El tiempo que espera un `INSERT` a que otro suelte el lock.
 *
 * Copiado de `lib/metricas-store.ts` y por el mismo motivo medido allí: sin
 * esto, `PRAGMA busy_timeout` sale `{timeout: 0}` y el segundo escritor falla
 * **al instante** con `SQLITE_BUSY`, sin reintentar. Aquí el segundo escritor
 * puede existir de verdad: dos peticiones concurrentes que llenen la caché
 * llaman al agregado a la vez.
 */
const BUSY_TIMEOUT_MS = 5_000;

const SCHEMA_VERSION = 7;

/**
 * Ausencias consecutivas en importaciones sanas necesarias para confirmar
 * que un evento ha dejado de estar disponible en origen. Menos de esto es
 * ausencia no confirmada (caída puntual, cambio temporal, orden de importación).
 */
export const AUSENCIAS_PARA_CONFIRMAR = 3;

/**
 * Migraciones en orden. Cada paso debe ser aplicable sobre una base existente
 * sin perder datos; por eso la evolución de esquema va aquí y no en
 * CREATE TABLE IF NOT EXISTS.
 */
const MIGRASIONES: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS eventos_vistos (
        tracking_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        fecha TEXT NOT NULL,
        link TEXT NOT NULL,
        primera_vez INTEGER NOT NULL,
        ultima_vez INTEGER NOT NULL,
        fallos INTEGER NOT NULL DEFAULT 0,
        visto_en INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS eventos_vistos_source ON eventos_vistos (source);
      CREATE INDEX IF NOT EXISTS eventos_vistos_ultima ON eventos_vistos (ultima_vez);
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE eventos_vistos ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo';
      ALTER TABLE eventos_vistos ADD COLUMN missing_runs INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE eventos_vistos ADD COLUMN first_seen_run INTEGER;
      ALTER TABLE eventos_vistos ADD COLUMN last_seen_run INTEGER;
      UPDATE eventos_vistos SET
        missing_runs = fallos,
        estado = CASE
          WHEN fallos <= 0 THEN 'activo'
          WHEN fallos < ${AUSENCIAS_PARA_CONFIRMAR} THEN 'ausencia_no_confirmada'
          ELSE 'ausencia_confirmada'
        END,
        first_seen_run = visto_en,
        last_seen_run = CASE WHEN fallos <= 0 THEN visto_en ELSE NULL END;
    `,
  },
  {
    version: 3,
    sql: `
      CREATE INDEX IF NOT EXISTS eventos_vistos_slug ON eventos_vistos (slug);
      CREATE INDEX IF NOT EXISTS eventos_vistos_estado ON eventos_vistos (estado);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS importaciones (
        n INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL,
        fuentes_total INTEGER NOT NULL,
        fuentes_sanas INTEGER NOT NULL,
        fuentes_fallidas INTEGER NOT NULL,
        eventos_vistos INTEGER NOT NULL,
        eventos_nuevos INTEGER NOT NULL,
        ausencias INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS importaciones_ts ON importaciones (ts);
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS importacion_fuentes (
        n INTEGER NOT NULL,
        source TEXT NOT NULL,
        ok INTEGER NOT NULL,
        eventos_vistos INTEGER NOT NULL,
        error TEXT,
        PRIMARY KEY (n, source)
      );
      CREATE INDEX IF NOT EXISTS importacion_fuentes_source ON importacion_fuentes (source);
    `,
  },
  {
    version: 6,
    sql: `
      -- Historial de slugs/canónicos por identidad estable (tracking_id/source).
      -- Permite redirecciones deterministas cuando el slug público cambia sin adivinar colisiones.
      CREATE TABLE IF NOT EXISTS evento_aliases (
        alias_slug TEXT NOT NULL,
        tracking_id TEXT NOT NULL,
        source TEXT NOT NULL,
        canonical_slug TEXT NOT NULL,
        primera_vez INTEGER NOT NULL,
        ultima_vez INTEGER NOT NULL,
        PRIMARY KEY (alias_slug, tracking_id)
      );
      CREATE INDEX IF NOT EXISTS evento_aliases_tracking ON evento_aliases (tracking_id);
      CREATE INDEX IF NOT EXISTS evento_aliases_canonical ON evento_aliases (canonical_slug);
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE eventos_vistos ADD COLUMN external_id TEXT;
      CREATE INDEX IF NOT EXISTS eventos_vistos_source_external ON eventos_vistos (source, external_id);
    `,
  },
];

export type EstadoEventoVisto =
  | "activo"
  | "ausencia_no_confirmada"
  | "ausencia_confirmada";

/** Una fila del registro, tal cual está en la tabla. */
export type FilaLedger = {
  tracking_id: string;
  source: string;
  slug: string;
  title: string;
  fecha: string;
  link: string;
  primera_vez: number;
  ultima_vez: number;
  fallos: number;
  visto_en: number;
  estado: EstadoEventoVisto;
  missing_runs: number;
  first_seen_run: number | null;
  last_seen_run: number | null;
  external_id?: string | null;
};

export type FilaImportacion = {
  n: number;
  ts: number;
  fuentes_total: number;
  fuentes_sanas: number;
  fuentes_fallidas: number;
  eventos_vistos: number;
  eventos_nuevos: number;
  ausencias: number;
};

/** Lo mínimo que el agregador tiene que dar de cada evento para anotarlo. */
export type EventoVisto = {
  source: string;
  title: string;
  date: string;
  slug: string;
  link: string;
  /** ID externo estable de la fuente, si se conoce. */
  externalId?: string;
};

export type ResultadoImportacion = {
  /** El número de esta importación, empezando en 1. */
  importacion: number;
  /** Cuántos eventos distintos se vieron. */
  vistos: number;
  /** Cuántas filas de fuentes sanas no se vieron y sumaron un fallo. */
  ausentes: number;
  /** Cuántas filas se dieron de alta por primera vez. */
  nuevos: number;
  /** Fuentes que respondieron (lectura válida, aunque vacía). */
  fuentesSanas: number;
  /** Fuentes que fallaron o quedaron incompletas y no cuentan como sanas. */
  fuentesFallidas: number;
};

export type FuenteImportacion = {
  n: number;
  source: string;
  ok: number;
  eventos_vistos: number;
  error: string | null;
};

const CLAVE_IMPORTACION = "importacion";

let db: DatabaseSync | null = null;

function versionDe(conexion: DatabaseSync): number {
  const fila = conexion.prepare("PRAGMA user_version").get() as
    | { user_version?: number }
    | undefined;
  return fila?.user_version ?? 0;
}

function migrar(conexion: DatabaseSync): void {
  const desde = versionDe(conexion);
  for (const paso of MIGRASIONES) {
    if (paso.version <= desde) continue;
    conexion.exec(paso.sql);
    conexion.exec(`PRAGMA user_version = ${paso.version}`);
  }

  /**
   * La comprobación de que el número y la lista están de acuerdo sale al
   * **abrir**, no al insertar, por lo mismo que en `lib/metricas-store.ts`:
   * subir `SCHEMA_VERSION` sin añadir el paso dejaría la base en la versión
   * vieja para siempre, sin error y con la columna nueva sin existir.
   */
  const queda = versionDe(conexion);
  if (queda !== SCHEMA_VERSION) {
    throw new Error(
      `event-ledger.db queda en la versión ${queda} y el código espera la ${SCHEMA_VERSION}: falta un paso en MIGRASIONES`
    );
  }
}

function getDb(): DatabaseSync {
  if (db) return db;

  mkdirSync(DB_DIR, { recursive: true });
  const conexion = new DatabaseSync(DB_PATH);

  try {
    conexion.exec("PRAGMA journal_mode = WAL");
    conexion.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    migrar(conexion);
  } catch (err) {
    /**
     * La conexión se cierra y **no** se guarda si algo falla. Guardarla a medias
     * dejaría el singleton apuntando a una base sin migrar, y las siguientes
     * llamadas volverían a crearla: el error saldría una vez y el resto de la
     * vida del proceso escribiría contra un esquema que el código no reconoce.
     */
    try {
      conexion.close();
    } catch {
      // Si ni cerrar se puede, el proceso ya está peor.
    }
    throw err;
  }

  db = conexion;
  return db;
}

/**
 * La identidad de un evento, y **no** el `id` del scraper.
 *
 * Los scrapers ponen un `id` —`evento.codigo`, `e.id`, o directamente un
 * `crypto.randomUUID()`— pero ninguno es estable: el municipal no siempre trae
 * `codigo`, el de euskadi cambia si cambia el enlace, y GasteizHoy no trae nada.
 * Y da igual, porque `RawLike` no declara `id` y el agregador lo descarta antes
 * de construir el `AgendaEvento`. La única clave que se puede reconstruir en
 * cada importación es esta: la fuente, el día local y el título normalizado.
 *
 * Se normaliza con `slugify` y no con el título crudo a propósito: una tilde que
 * una fuente escribe y otra no, o un espacio de más, no pueden convertir el
 * mismo evento en dos filas. El id es interno —no es el slug que se sirve—, así
 * que puede perder esa información sin coste.
 */
export function trackingId(source: string, date: string, title: string): string {
  return `${source}|${localDateKey(date)}|${slugify(title)}`;
}

function leerContador(conexion: DatabaseSync): number {
  const fila = conexion
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(CLAVE_IMPORTACION) as { value?: string } | undefined;
  const n = Number(fila?.value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function contarFilas(conexion: DatabaseSync): number {
  const fila = conexion.prepare("SELECT COUNT(*) AS n FROM eventos_vistos").get() as {
    n: number;
  };
  return fila.n;
}

/**
 * Anota una importación entera: los eventos vistos, los fallos de los ausentes y
 * el número de importación, todo en una transacción.
 *
 * `vistos` es la lista **antes del dedupe** del agregador. Dos sesiones del mismo
 * título el mismo día llegan aquí como dos entradas y se colapsan a una sola
 * fila: contarlas dos veces inflaría `vistos` sin que nada más lo notara.
 *
 * `fuentesSanas` son las fuentes que **respondieron** en esta importación, aunque
 * respondieran con lista vacía. Es lo que hace que una ausencia sea un dato: si
 * la fuente no respondió, no se sabe si el evento desapareció, y darlo por
 * ausente convertiría cada caída en una alarma falsa sobre cientos de eventos a
 * la vez. Una fuente que ya no está en el registro tampoco acumula fallos: no
 * aparece en `fuentesSanas` y sus filas se quedan quietas.
 */
export function registrarImportacion(
  vistos: readonly EventoVisto[],
  fuentesSanas: readonly string[],
  ahora: number = Date.now(),
  fuentesIntentadas: number = fuentesSanas.length,
  fuentesFallidasDetalle: readonly { id: string; error: string }[] = []
): ResultadoImportacion {
  const conexion = getDb();

  const unicos = new Map<string, EventoVisto>();
  for (const ev of vistos) {
    const id = trackingId(ev.source, ev.date, ev.title);
    if (!unicos.has(id)) unicos.set(id, ev);
  }

  conexion.exec("BEGIN");
  try {
    const importacion = leerContador(conexion) + 1;
    const antes = contarFilas(conexion);

    const selectSlug = conexion.prepare(
      "SELECT slug FROM eventos_vistos WHERE tracking_id = ?"
    );
    const selectByExternal = conexion.prepare(
      "SELECT tracking_id, slug FROM eventos_vistos WHERE source = ? AND external_id = ?"
    );
    const upsert = conexion.prepare(
      `INSERT INTO eventos_vistos
         (tracking_id, source, slug, title, fecha, link, primera_vez, ultima_vez, fallos, visto_en, estado, missing_runs, first_seen_run, last_seen_run, external_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'activo', 0, ?, ?, ?)
       ON CONFLICT(tracking_id) DO UPDATE SET
         source = excluded.source,
         slug = excluded.slug,
         title = excluded.title,
         fecha = excluded.fecha,
         link = excluded.link,
         ultima_vez = excluded.ultima_vez,
         fallos = 0,
         visto_en = excluded.visto_en,
         estado = 'activo',
         missing_runs = 0,
         first_seen_run = COALESCE(eventos_vistos.first_seen_run, excluded.first_seen_run),
         last_seen_run = excluded.last_seen_run,
         external_id = COALESCE(excluded.external_id, eventos_vistos.external_id)`
    );
    const upsertAlias = conexion.prepare(
      `INSERT INTO evento_aliases
         (alias_slug, tracking_id, source, canonical_slug, primera_vez, ultima_vez)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(alias_slug, tracking_id) DO UPDATE SET
         canonical_slug = excluded.canonical_slug,
         source = excluded.source,
         ultima_vez = excluded.ultima_vez`
    );

    for (const [id, ev] of unicos) {
      const previo = selectSlug.get(id) as { slug?: string } | undefined;
      const slugPrevio = previo?.slug;
      if (slugPrevio && slugPrevio !== ev.slug) {
        // Alias determinista: mismo tracking_id (misma identidad estable observada) cambió de slug.
        upsertAlias.run(slugPrevio, id, ev.source, ev.slug, ahora, ahora);
      }

      // Alias por ID externo estable de la fuente (misma fuente + mismo external_id).
      if (ev.externalId) {
        const previosExt = selectByExternal.all(ev.source, ev.externalId) as {
          tracking_id: string;
          slug: string;
        }[];
        if (previosExt.length === 1) {
          const prevExt = previosExt[0];
          if (prevExt.slug && prevExt.slug !== ev.slug) {
            upsertAlias.run(prevExt.slug, prevExt.tracking_id, ev.source, ev.slug, ahora, ahora);
          }
        }
      }
      upsert.run(
        id,
        ev.source,
        ev.slug,
        ev.title,
        localDateKey(ev.date),
        ev.link,
        ahora,
        ahora,
        importacion,
        importacion,
        importacion,
        ev.externalId ?? null
      );
    }

    const nuevos = contarFilas(conexion) - antes;

    /**
     * La ausencia solo cuenta para las fuentes sanas, y una fila recién vista en
     * esta misma importación queda fuera por `visto_en <> importacion`. Sin
     * fuentes sanas no se toca nada: no hay contra quién comparar.
     */
    let ausentes = 0;
    if (fuentesSanas.length > 0) {
      const marcas = fuentesSanas.map(() => "?").join(", ");
      const resultado = conexion
        .prepare(
          `UPDATE eventos_vistos
             SET
               fallos = fallos + 1,
               missing_runs = missing_runs + 1,
               estado = CASE
                 WHEN (missing_runs + 1) >= ? THEN 'ausencia_confirmada'
                 ELSE 'ausencia_no_confirmada'
               END
           WHERE visto_en <> ? AND source IN (${marcas})`
        )
        .run(AUSENCIAS_PARA_CONFIRMAR, importacion, ...fuentesSanas);
      ausentes = Number(resultado.changes ?? 0);
    }

    const fuentesFallidas = Math.max(0, fuentesIntentadas - fuentesSanas.length);
    conexion
      .prepare(
        `INSERT INTO importaciones
          (n, ts, fuentes_total, fuentes_sanas, fuentes_fallidas, eventos_vistos, eventos_nuevos, ausencias)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        importacion,
        ahora,
        fuentesIntentadas,
        fuentesSanas.length,
        fuentesFallidas,
        unicos.size,
        nuevos,
        ausentes
      );

    // Trazabilidad por fuente y ejecución: resultado de cada fuente conocida.
    const eventosPorFuente = new Map<string, number>();
    for (const ev of unicos.values()) {
      eventosPorFuente.set(ev.source, (eventosPorFuente.get(ev.source) ?? 0) + 1);
    }
    const insertFuente = conexion.prepare(
      `INSERT OR REPLACE INTO importacion_fuentes
        (n, source, ok, eventos_vistos, error)
       VALUES (?, ?, ?, ?, ?)`
    );
    const fallidasMap = new Map(fuentesFallidasDetalle.map((f) => [f.id, f.error]));
    for (const source of fuentesSanas) {
      insertFuente.run(importacion, source, 1, eventosPorFuente.get(source) ?? 0, null);
    }
    for (const [source, error] of fallidasMap) {
      // Una fuente no puede ser sana y fallida a la vez en la misma ejecución.
      if (fuentesSanas.includes(source)) continue;
      insertFuente.run(importacion, source, 0, eventosPorFuente.get(source) ?? 0, error);
    }

    conexion
      .prepare(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(CLAVE_IMPORTACION, String(importacion));

    conexion.exec("COMMIT");

    return {
      importacion,
      vistos: unicos.size,
      ausentes,
      nuevos,
      fuentesSanas: fuentesSanas.length,
      fuentesFallidas,
    };
  } catch (err) {
    try {
      conexion.exec("ROLLBACK");
    } catch {
      // Si ni deshacer se puede, el error original es el que importa.
    }
    throw err;
  }
}

/**
 * El registro entero, para quien lo lea desde fuera —el informe de salud, el
 * `doctor`—. Sin ordenar: la consulta no impone ninguno y quien lo consume sabe
 * qué pregunta hace.
 */
export function leerLedger(): FilaLedger[] {
  return getDb()
    .prepare("SELECT * FROM eventos_vistos")
    .all() as unknown as FilaLedger[];
}

/** Último estado conocido por slug público (si existe en el registro). */
export function leerEstadoPorSlug(slug: string): FilaLedger | undefined {
  try {
    return getDb()
      .prepare(
        "SELECT * FROM eventos_vistos WHERE slug = ? ORDER BY ultima_vez DESC, visto_en DESC LIMIT 1"
      )
      .get(slug) as FilaLedger | undefined;
  } catch {
    return undefined;
  }
}

/**
 * La inversa de anotar un evento: borra **esa** fila y ninguna más.
 *
 * Va por identidad —el `tracking_id` completo— y no por reloj, por el mismo
 * motivo que `desanotar()` en `lib/metricas-store.ts`: una poda por tiempo o se
 * deja la fila o se lleva la tabla entera. Devuelve cuántas se fueron; un `0` es
 * una respuesta legítima y no un error.
 */
export function desanotarEvento(id: string): number {
  const resultado = getDb()
    .prepare("DELETE FROM eventos_vistos WHERE tracking_id = ?")
    .run(id);
  return Number(resultado.changes ?? 0);
}

/**
 * La misma importación, pero sin poder tumbar la agenda.
 *
 * El registro es vigilancia, no servicio: si el volumen no está montado, el peor
 * resultado aceptable es que la detección de ausencias no funcione, **no** que la
 * web deje de servir. Por eso el fallo se convierte en un aviso y en un `null`, y
 * el agregado sigue devolviendo eventos.
 */
export function registrarImportacionSegura(
  vistos: readonly EventoVisto[],
  fuentesSanas: readonly string[],
  ahora: number = Date.now(),
  fuentesIntentadas: number = fuentesSanas.length,
  fuentesFallidasDetalle: readonly { id: string; error: string }[] = []
): ResultadoImportacion | null {
  try {
    return registrarImportacion(vistos, fuentesSanas, ahora, fuentesIntentadas, fuentesFallidasDetalle);
  } catch (error) {
    logger.warn("event_ledger_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Historial de importaciones (más recientes primero). */
export function leerImportaciones(limit = 20): FilaImportacion[] {
  try {
    return getDb()
      .prepare(
        "SELECT n, ts, fuentes_total, fuentes_sanas, fuentes_fallidas, eventos_vistos, eventos_nuevos, ausencias FROM importaciones ORDER BY n DESC LIMIT ?"
      )
      .all(limit) as unknown as FilaImportacion[];
  } catch {
    return [];
  }
}

/** Detalle por fuente de una importación (trazabilidad por fuente y ejecución). */
export function leerFuentesDeImportacion(n: number): FuenteImportacion[] {
  try {
    return getDb()
      .prepare(
        "SELECT n, source, ok, eventos_vistos, error FROM importacion_fuentes WHERE n = ? ORDER BY ok ASC, source ASC"
      )
      .all(n) as unknown as FuenteImportacion[];
  } catch {
    return [];
  }
}

/**
 * Resuelve un slug alias a su canónico actual de forma determinista.
 * Si el alias no existe o apunta a más de un destino (colisión), devuelve undefined.
 */
export function resolverAliasSlug(
  aliasSlug: string
): { canonical: string; tracking_id: string; source: string } | undefined {
  try {
    const filas = getDb()
      .prepare(
        `SELECT canonical_slug, tracking_id, source
         FROM evento_aliases
         WHERE alias_slug = ?
         ORDER BY ultima_vez DESC`
      )
      .all(aliasSlug) as { canonical_slug: string; tracking_id: string; source: string }[];
    if (filas.length === 0) return undefined;
    const canonicos = new Set(filas.map((f) => f.canonical_slug));
    if (canonicos.size !== 1) return undefined;
    const f = filas[0];
    return { canonical: f.canonical_slug, tracking_id: f.tracking_id, source: f.source };
  } catch {
    return undefined;
  }
}

/** Estado por tracking_id (para resolver alias a evento conocido). */
export function leerEstadoPorTrackingId(trackingId: string): FilaLedger | undefined {
  try {
    return getDb()
      .prepare("SELECT * FROM eventos_vistos WHERE tracking_id = ?")
      .get(trackingId) as FilaLedger | undefined;
  } catch {
    return undefined;
  }
}
