/**
 * El casting del post: qué eventos se publican y en qué orden.
 *
 * Uso: npx tsx scripts/casting.ts [YYYY-MM-DD]
 *
 * **No escribe nada y no manda nada.** Imprime el casting y su motivo, y ahí acaba.
 *
 * **Lo que sale es una propuesta, no una decisión.** La lista que de verdad se publica la
 * sigue haciendo `lib/recomendados.ts`, que es la misma que usan el post, `/hoy` y la
 * home: este script solo ordena y descarta dentro de lo que esa lista ya eligió. Un
 * casting guardado aparte que se publica sin revisar sería una tercera lista, y tres
 * listas divergen el día que se toque una.
 *
 * **El modelo solo ordena y descarta, nunca inventa.** El prompt de `prompts/casting.md`
 * lo dice, y el script lo comprueba: todo `id` que devuelve tiene que existir en la lista
 * que se le pasó. Un modelo que se cuela un evento que no está en la agenda publicaría un
 * plan que no existe, que es el peor fallo posible en una agenda.
 *
 * **Por qué `opencode run` y no una llamada a la API.** Va por la misma vía que el
 * resto del proyecto y no añade ninguna credencial: en el servidor ya está instalado, y
 * así el prompt vive en `scripts/prompts/`, versionado y con `git diff` —que es la única
 * forma de saber por qué el post de tal día salió como salió.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function main(): Promise<void> {
  // Antes de nada: `AsyncLocalStorage` y el `.env`. Ver `entorno.ts`, que explica por
  // qué tienen que estar puestos antes de importar `lib/agenda.ts` y no después.
  const { prepararEntornoScript } = await import("./entorno");
  await prepararEntornoScript();

  const argFecha = process.argv[2];
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(argFecha ?? "")
    ? argFecha!
    : (await import("@/lib/utils")).localDateStr(new Date());

  const { getAgendaEventos } = await import("@/lib/agenda");
  const { recomendados } = await import("@/lib/recomendados");
  const { MAX_DIAPOSITIVAS } = await import("@/lib/promo");

  const eventos = await getAgendaEventos();
  const candidatos = recomendados(eventos, {
    desde: fecha,
    hasta: fecha,
    // Se le pasan más que los que entran en el post: elegir entre 6 candidatos de los
    // que ya son los 6 mejores es dejar la decisión al modelo sin margen. Con 20, puede
    // descartar de verdad.
    limite: 20,
  });

  if (candidatos.length === 0) {
    console.log(`[casting] No hay eventos recomendados el ${fecha}.`);
    return;
  }

  // Solo lo que el modelo necesita: título, lugar y categoría. La fecha y el slug los
  // necesita para devolver ids válidos, pero no para decidir, y mandarle más campos es
  // darle la tentación de opinar sobre ellos.
  const entrada = candidatos.map((e) => ({
    id: e.id,
    titulo: e.title,
    lugar: e.location || "",
    categoria: e.category,
  }));

  const prompt = await readFile(
    join(process.cwd(), "scripts", "prompts", "casting.md"),
    "utf8"
  );
  const mensaje = [
    prompt,
    "",
    "Estos son los candidatos del " + fecha + ":",
    JSON.stringify(entrada, null, 2),
    `Elige como mucho ${MAX_DIAPOSITIVAS}.`,
  ].join("\n");

  const { modeloDeCasting, preguntarAOpencode } = await import("./opencode");
  const modelo = modeloDeCasting();

  console.log(`[casting] ${entrada.length} candidatos · modelo ${modelo}...`);

  /*
   * **La llamada está en `scripts/opencode.ts`.** Estaba aquí, se copió al médico y la
   * copia se quedó con `execFile`, que no encadena stdin, así que falló con `Command
   * failed` sin decir por qué. Dos copias de la misma llamada divergen en cuanto se toca
   * una, y el síntoma sale en la que no se ha tocado.
   *
   * **El prompt va por entrada estándar y no como argumento.** Medido: pasado como
   * argumento, `cmd` lo parte por los espacios y por los `>` del formato del JSON de
   * salida, y opencode recibe una frase y media en vez de las instrucciones. El fallo
   * parece del modelo —contesta sobre un fragmento— cuando lo único que falla es cómo se
   * le ha pasado la pregunta.
   */
  let salida: string;
  try {
    salida = await preguntarAOpencode(modelo, mensaje);
  } catch (error) {
    const err = error as { message?: string };
    console.error("[casting] El modelo no respondió:", err.message);
    process.exitCode = 1;
    return;
  }

  const castings: unknown = extraerJson(salida);
  if (!esValido(castings)) {
    console.error("[casting] El modelo no devolvió un casting válido.");
    console.error(salida.slice(0, 400));
    process.exitCode = 1;
    return;
  }

  const porId = new Map(candidatos.map((e) => [e.id, e]));
  const desconocidos = castings.elige.filter((id) => !porId.has(id));
  if (desconocidos.length > 0) {
    // El prompt lo prohíbe y aun así puede pasar: un modelo alucina un id. Publicar un
    // plan inexistente es peor que no publicar, así que aquí no se avisa: se cae.
    console.error(
      `[casting] El modelo invención ${desconocidos.length} evento(s) que no están en la ` +
        "agenda. No se publica nada."
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n[casting] ${fecha} — ${castings.elige.length} de ${candidatos.length}`);
  console.log(`motivo: ${castings.motivo}\n`);
  castings.elige.forEach((id, i) => {
    const e = porId.get(id)!;
    console.log(`  ${String(i + 1).padStart(2, "0")}. [${e.category}] ${e.title}`);
    if (e.location) console.log(`      ${e.location}`);
  });
}


/** Lo único que se acepta: `{ elige: string[], motivo: string }`. */
type Casting = { elige: string[]; motivo: string };

function esValido(valor: unknown): valor is Casting {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as { elige?: unknown; motivo?: unknown };
  return (
    Array.isArray(v.elige) &&
    v.elige.every((x) => typeof x === "string") &&
    typeof v.motivo === "string"
  );
}

/**
 * Saca el JSON de lo que devuelve el modelo.
 *
 * **Los modelos,json?** y luego texto: el prompt dice «solo JSON», pero casi ninguno es
 * tan literal como pide. Se busca el primer `{` y el último `}` en vez de.parsear todo,
 * porque los bloques de ``` son el caso habitual y Romper toda la salida por eso sería
 * tirar la única respuesta que hay.
 */
function extraerJson(salida: string): unknown {
  const inicio = salida.indexOf("{");
  const fin = salida.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  try {
    return JSON.parse(salida.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

void main().catch((error) => {
  console.error("[casting] Fallo grave:", error);
  process.exitCode = 1;
});
