import fs from "fs";
import path from "path";

/**
 * Dónde viven los suscriptores, y por qué es configurable.
 *
 * Antes era `path.join(process.cwd(), "data", "subscribers.json")` a secas, y
 * ese fichero estaba versionado con ocho entradas y sus tokens de baja. Las ocho
 * eran de prueba, así que no había datos personales reales; lo que había era un
 * formato que no distingue un correo de prueba de uno de verdad, en un repo
 * público, con un `removeSubscriber(token)` que da de baja a quien tenga el
 * token. En cuanto se suscribiera alguien de verdad, su correo y su token
 * estarían en el historial para siempre.
 *
 * `SUBSCRIBERS_PATH` deja el fichero donde lo monte el volumen persistente de
 * Dokploy, que es el sitio donde no se pierde en cada redeploy. Sin la variable
 * se sigue usando `data/subscribers.json` relative al directorio de trabajo,
 * que es lo que hace falta para desarrollar sin configurar nada.
 *
 * La ruta se resuelve en cada llamada y no al importar el módulo, para que
 * cambiar la variable tenga efecto sin recargar nada.
 */
export function subscribersPath(): string {
  const override = process.env.SUBSCRIBERS_PATH?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "data", "subscribers.json");
}

type Subscriber = {
  email: string;
  /** Cuándo se pidió el alta. No cuándo empezó a recibir correo. */
  subscribedAt: string;
  /**
   * Si esta dirección entra en la lista de envío.
   *
   * Antes el alta lo ponía en `true` sin más y el enlace de confirmación no
   * miraba nada: escribir una dirección en el formulario bastaba para empezar a
   * recibir la agenda. Con la doble confirmación, el alta solo deja constancia
   * del interés y el correo es lo que activa.
   */
  active: boolean;
  /**
   * Cuándo se confirmó, o `null` si nunca se confirmó.
   *
   * Hace falta aparte de `active` porque con la doble confirmación `false`
   * significa dos cosas distintas: «se oyó y no ha abierto el correo» y «se dio
   * de baja». Sin este campo, un enlace de confirmación viejo podría devolver a
   * la lista a quien pidió salir, que es justo lo contrario de lo que pidió.
   * Opcional para tolerar filas escritas antes de que el campo existiera.
   */
  confirmedAt?: string | null;
  /** UUID v4. Es a la vez el token de confirmación y el de baja. */
  token: string;
};

/**
 * Crea el directorio y el fichero si no existen.
 *
 * El directorio intermedio importa tanto como el fichero: con
 * `SUBSCRIBERS_PATH=/datos/suscriptores.json`, un despliegue cuyo volumen está en
 * `/datos` pero vacío fallaría con ENOENT en el primer alta, y el alta es
 * justamente lo que se ejecuta en producción. Un alta que no puede escribir tiene
 * que fallar ruidosamente, no dejar a medias.
 */
function ensureFichero(): string {
  const destino = subscribersPath();
  const dir = path.dirname(destino);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(destino)) {
    fs.writeFileSync(destino, "[]", "utf-8");
  }
  return destino;
}

function readSubscribers(): Subscriber[] {
  const destino = ensureFichero();
  let filas: unknown;
  try {
    filas = JSON.parse(fs.readFileSync(destino, "utf-8"));
  } catch {
    return [];
  }
  // Un `subscribers.json` que contiene JSON válido pero no una lista —un `{}`
  // que dejó una escritura a medias, por ejemplo— devolvía el valor tal cual y el
  // `.find` de quien llamara reventaba con un TypeError que no dice de dónde
  // viene. Con la migración de abajo hay que recorrerlo, así que el
  // `Array.isArray` pasa a ser necesario de verdad.
  if (!Array.isArray(filas)) return [];
  return migrarConfirmedAt(destino, filas as Subscriber[]);
}

/**
 * Rellena `confirmedAt` en las filas que no lo tienen.
 *
 * El campo se añadió con la doble confirmación. Las filas escritas antes de eso
 * no lo tienen, y como `undefined` es falsy el guard de `confirmSubscriber` —
 * `if (found.confirmedAt && !found.active)`— no se disparaba con ellas: una
 * suscripción que se había dado de baja antes de esa fase volvía a la lista de
 * envío con el enlace de confirmación, que puede seguir años en una bandeja de
 * entrada. Reproducido contra el código real: `confirmSubscriber` devolvía
 * `true` y la persona volvía a recibir la agenda sin haberlo pedido.
 *
 * El valor que se pone es `subscribedAt`, y es la única lectura fiel: con el
 * alta automática de antes, subscriptarse *era* confirmar, así que la fecha del
 * alta es la de la confirmación que no se escribió.
 *
 * Solo rellena lo que falta. Los `null` de las filas nuevas se quedan en `null`:
 * un `null` es «pendiente de confirmar» y rellenar ese hueco convertiría una
 * suscripción recién creada en una que el guard rechaza, que es justo el bug del
 * commit anterior.
 *
 * Es idempotente y converge: después de la primera lectura ya no queda nada que
 * rellenar, así que no vuelve a escribir. Importa, porque `readSubscribers` se
 * llama en cada alta, cada confirmación y cada envío, y un despliegue con la
 * lista montada no puede estar reescribiendo el fichero en cada petición.
 */
function migrarConfirmedAt(destino: string, filas: Subscriber[]): Subscriber[] {
  let cambio = false;
  for (const fila of filas) {
    if (fila.confirmedAt === undefined) {
      fila.confirmedAt = fila.subscribedAt;
      cambio = true;
    }
  }
  if (cambio) {
    fs.writeFileSync(destino, JSON.stringify(filas, null, 2), "utf-8");
  }
  return filas;
}

function writeSubscribers(subscribers: Subscriber[]) {
  fs.writeFileSync(ensureFichero(), JSON.stringify(subscribers, null, 2), "utf-8");
}

/**
 * Da de alta a un correo y devuelve el token del enlace de confirmación.
 *
 * El alta **no** activa a nadie: deja la entrada en `active: false` y es
 * `confirmSubscriber` —o sea, abrir el correo— lo que la activa.
 *
 * Si el correo ya estaba, se reutiliza la fila y su token en vez de duplicar, y
 * hay dos casos distintos. Si la fila está activa, no se toca nada. Si está dada
 * de baja, se devuelve al estado pendiente limpiando `confirmedAt`: el alta sola
 * no reactiva, pero sin ese borrado la persona quedaba bloqueada para siempre,
 * porque el guard de `confirmSubscriber` se negaba a entrar y el enlace de
 * confirmación que recibía la devolvía a `?newsletter=invalid-token`, que ninguna
 * página lee. Se subscribía a algo que no funcionaba sin enterarse.
 *
 * El token **se conserva**, y es deliberado. Rotarlo dejaría muerto el enlace de
 * baja de la última newsletter que recibió la persona: `removeSubscriber` busca
 * por token, no encontraría a nadie y devolvería `false`, así que el enlace
 * dejaría de dar de baja. No puede dar de baja a la fila equivocada —los tokens
 * son UUID y no colisionan— pero sí fallar en silencio, que es peor para quien
 * solo quiere dejar de recibir correo. Conservarlo tampoco abre nada que no
 * estuviera abierto: el enlace de confirmación antiguo solo confirma una
 * suscripción que esa misma bandeja acaba de pedir con esa misma dirección. La
 * seguridad de la doble confirmación no está en que el token sea nuevo, está en
 * que la casilla la controle quien pidió la suscripción.
 *
 * `subscribedAt` no se toca: es cuándo se pidió el alta por primera vez, y
 * sobrescribirlo en cada re-alta perdería el histórico sin ganar nada.
 *
 * `active` vuelve porque el mensaje que se le manda a quien se suscribe depende
 * de los tres casos, y con el alta directa eran dos: antes, «ya estás suscrito»
 * era cierto siempre que el correo estaba. Con la doble confirmación hay un
 * tercero —se dio de baja y vuelve— y en ese caso decir «ya estás suscrito» es
 * mentira.
 */
export function addSubscriber(email: string): {
  token: string;
  exists: boolean;
  active: boolean;
} {
  const subscribers = readSubscribers();
  const existing = subscribers.find((s) => s.email === email);

  if (existing) {
    // Re-alta de alguien que se había dado de baja: vuelve a pendiente. Es lo
    // único que hay que cambiar. `active` sigue en `false`, así que el alta sola
    // no devuelve a nadie a la lista; lo que hace es devolver la fila al estado
    // en el que `confirmSubscriber` la acepta.
    if (!existing.active && existing.confirmedAt) {
      existing.confirmedAt = null;
      writeSubscribers(subscribers);
    }
    return { token: existing.token, exists: true, active: existing.active };
  }

  const token = crypto.randomUUID();
  subscribers.push({
    email,
    subscribedAt: new Date().toISOString(),
    active: false,
    confirmedAt: null,
    token,
  });
  writeSubscribers(subscribers);
  return { token, exists: false, active: false };
}

/**
 * Activa la suscripción cuyo token es el dado. `true` si queda activa.
 *
 * Idempotente a propósito: el enlace va en un correo, y los correos se releen.
 * Pulsarlo dos veces no puede romper nada.
 *
 * Devuelve `false` —sin activar a nadie— si el token no existe, si viene vacío,
 * o si la suscripción fue dada de baja. Este último caso es el que hace que el
 * enlace de baja sirva de algo: como el token es el mismo para confirmar y para
 * cancelar, un correo antiguo no puede devolver a nadie a la lista.
 */
export function confirmSubscriber(token: string): boolean {
  if (!token) return false;
  const subscribers = readSubscribers();
  const found = subscribers.find((s) => s.token === token);
  if (!found) return false;
  // Ya estuvo confirmada y luego se dio de baja. El alta por sí sola no puede
  // traerla de vuelta: haría falta volver a confirmar.
  if (found.confirmedAt && !found.active) return false;
  found.active = true;
  found.confirmedAt = found.confirmedAt ?? new Date().toISOString();
  writeSubscribers(subscribers);
  return true;
}

/**
 * Da de baja sin borrar la fila.
 *
 * Borrarla haría que un alta posterior generase un token distinto y que el
 * enlace de baja antiguo dejara de funcionar; y como el token es lo único que
 * protege a un suscriptor de que lo den de baja, reutilizar un token ya retirado
 * sería peor que conservarlo.
 *
 * Idempotente también: pulsar dos veces sin querer el enlace de baja es lo más
 * normal del mundo, y no debería llevar a la página de error.
 */
export function removeSubscriber(token: string): boolean {
  if (!token) return false;
  const subscribers = readSubscribers();
  const found = subscribers.find((s) => s.token === token);
  if (!found) return false;
  found.active = false;
  writeSubscribers(subscribers);
  return true;
}

export function getActiveSubscribers(): Subscriber[] {
  return readSubscribers().filter((s) => s.active);
}

export function getAllSubscribers(): Subscriber[] {
  return readSubscribers();
}
