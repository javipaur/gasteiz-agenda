/**
 * Un límite por IP para las rutas públicas de `/api`, que el middleware no cubre.
 *
 * ## Por qué existe esto
 *
 * `middleware.ts` tiene un limitador de 100 peticiones por minuto y por IP, y
 * está bien puesto para las rutas **protegidas**. Pero devuelve mucho antes, en
 * `isPublicApiRoute`: una ruta pública nunca llega a la comprobación de clave, y
 * por tanto tampoco al limitador. Con `/api/metric` en la lista, eso deja el
 * `POST` del contador **sin ningún límite**, y esa ruta está abierta por
 * necesidad: la llama un componente cliente que no puede traer `API_KEY`.
 *
 * ## Qué protege y qué no
 *
 * La lista cerrada de `lib/metricas.ts` ya impide escribir etiquetas inventadas, y
 * el techo de 1 KB impide meter texto Unlimited en cada fila. Lo que **no**
 * impedía era el volumen: un script que descubre la ruta puede mandar `visita`
 * tantas veces como quiera, y en un contador eso es peor que no tener nada, porque
 * es un número que miente.
 *
 * ## El límite es de peticiones, no de filas
 *
 * Cada petición aceptada escribe **exactamente una** fila, así que el límite de
 * peticiones es también un límite de filas. Por eso son 60 y no 600: el tráfico
 * real del sitio es de unas 2.000 visitas al día entre todo, y ningún visitante
 * legítimo manda más de uno, porque `Metricas` **no reintenta** — reintentar
 * sobre una visita ya contada la contaría dos veces.
 *
 * Y es un `Map` en memoria, con la limitación que ya está anotada en AGENTS.md
 * sobre el limitador del middleware: en varios procesos cada uno lleva su cuenta.
 * Aquí es aceptable porque el objetivo no es contabilidad exacta sino que el
 * número no se pueda inflar sin factura.
 *
 * ## De qué depende, y qué no garantiza
 *
 * Cuenta por IP leída de `x-forwarded-for`, así que **hereda el supuesto del
 * middleware**: que el proxy de delante sobrescribe esa cabecera y no deja pasar la
 * que manda el cliente. Si el despliegue no cumple eso, este limitador se puede
 * esquivar de dos formas a la vez —mandando un `x-forwarded-for` distinto en cada
 * petición, que es lo que agota el `Map`— y eso no es solo un agujero aquí: es el
 * mismo agujero que tiene el limitador de `middleware.ts`, que ya se aceptó
 * escribir así.
 *
 * Por eso el módulo no promete "no se puede inflar", que no puede prometer. Promete
 * **que no se puede inflar desde una sola IP y sin variar la cabecera**. Un
 * `uncontador inflado es peor que no tener contador` porque es un número que miente
 * y que nadie va a mirar dos veces, así que el listón se pone donde se puede
 * sostener y no donde quiseramos.
 *
 * Y las entradas viejas se barren: el `Map` es de módulo y vive para siempre, así
 * que sin limpieza un ataque con IP cambiante lo dejaría creciendo sin límite.
 */

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 60;

type Entrada = { count: number; resetAt: number };

const cuentas = new Map<string, Entrada>();

/** Cada cuánto se barren las cuentas viejas. */
const LIMPIEZA_CADA_MS = 5 * 60_000;
let ultimaLimpieza = Date.now();

function esIPReal(ip: string): boolean {
  return ip !== "" && ip !== "unknown";
}

/**
 * La IP de quien llama, o `null` si no se puede saber.
 *
 * Se lee de las mismas cabeceras que el middleware y con el mismo orden, y el
 * `null` es una decisión: sin IP no se puede limitar, y se **devuelve el evento**
 * en lugar de rechazarlo. Rechazarlo convertiría a todo el que venga detrás de un
 * proxy que no manda `x-forwarded-for` en un `400` permanente, que es un fallo
 * silencioso del contador mucho peor que un hueco en la protección.
 */
export function ipDe(req: Request): string | null {
  const reenviada = req.headers.get("x-forwarded-for");
  if (reenviada) {
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;

  // `Forwarded` es la cabecera estándar y la que some un `nginx` bienmontado. Se
  // mira al final porque es la que menos se usa y la que más formatos tiene.
  const forwarded = req.headers.get("forwarded");
  if (forwarded) {
    const ip = forwarded.match(/for=("?\[?)([^;,"\]]+)/i)?.[2]?.trim();
    if (ip && esIPReal(ip)) return ip;
  }

  return null;
}

/**
 * Si esta petición puede pasar.
 *
 * Devuelve el motivo para que el 429 pueda decirlo, que es más útil que un
 * "demasiadas peticiones" a secas cuando alguien lee un log de Dokploy.
 */
export function consume(ip: string | null): { ok: true } | { ok: false; reintentarEn: number } {
  if (ip === null) return { ok: true };

  const ahora = Date.now();
  if (ahora - ultimaLimpieza > LIMPIEZA_CADA_MS) {
    for (const [clave, entrada] of cuentas) {
      if (ahora > entrada.resetAt) cuentas.delete(clave);
    }
    ultimaLimpieza = ahora;
  }

  const entrada = cuentas.get(ip);
  if (!entrada || ahora > entrada.resetAt) {
    cuentas.set(ip, { count: 1, resetAt: ahora + VENTANA_MS });
    return { ok: true };
  }

  entrada.count += 1;
  if (entrada.count > MAX_POR_VENTANA) {
    return { ok: false, reintentarEn: Math.ceil((entrada.resetAt - ahora) / 1000) };
  }
  return { ok: true };
}

/**
 * Se llama en los tests para no arrastrar cuentas entre casos, y devuelve el
 * número de cuentas vivas, que es lo que permite comprobar que la limpieza hace
 * algo.
 */
export function reiniciaLimite(): number {
  const antes = cuentas.size;
  cuentas.clear();
  ultimaLimpieza = Date.now();
  return antes;
}