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
 * se sigue usando `data/subscribers.json` relative al directorio de trabajo, que
 * es lo que hace falta para desarrollar sin configurar nada.
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
  subscribedAt: string;
  active: boolean;
  token: string;
};

/**
 * Crea el directorio y el fichero si no existen.
 *
 * El directorio intermediate importa tanto como el fichero: con
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
  try {
    const raw = fs.readFileSync(destino, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeSubscribers(subscribers: Subscriber[]) {
  fs.writeFileSync(ensureFichero(), JSON.stringify(subscribers, null, 2), "utf-8");
}

export function addSubscriber(email: string): { token: string; exists: boolean } {
  const subscribers = readSubscribers();
  const existing = subscribers.find((s) => s.email === email);

  if (existing) {
    if (!existing.active) {
      existing.active = true;
      writeSubscribers(subscribers);
    }
    return { token: existing.token, exists: true };
  }

  const token = crypto.randomUUID();
  subscribers.push({
    email,
    subscribedAt: new Date().toISOString(),
    active: true,
    token,
  });
  writeSubscribers(subscribers);
  return { token, exists: false };
}

export function removeSubscriber(token: string): boolean {
  const subscribers = readSubscribers();
  const index = subscribers.findIndex((s) => s.token === token);
  if (index === -1) return false;
  subscribers[index].active = false;
  writeSubscribers(subscribers);
  return true;
}

export function getActiveSubscribers(): Subscriber[] {
  return readSubscribers().filter((s) => s.active);
}

export function getAllSubscribers(): Subscriber[] {
  return readSubscribers();
}
