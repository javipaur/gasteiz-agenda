/**
 * El casting: qué eventos se publican, en qué orden y por qué motivo.
 *
 * **No es una fuente de verdad.** La lista la sigue haciendo `lib/recomendados.ts`, que es
 * la misma que usan el post, `/hoy` y la home. Esto solo **ordena y descarta dentro** de lo
 * que esa lista ya eligió, y por eso hay dos módulos con la misma idea: este y
 * `scripts/casting.ts`, que es el mismo código para ver el resultado desde la terminal.
 *
 * **Se separa para que el correo y la terminal no puedan divergir.** La terminal enseñaba
 * un casting que el correo no usaba, y eso es exactamente el fallo caro: dos copias de la
 * misma decisión, las dos funcionando, y nadie enterándose hasta que el post sale mal. Una
 * decisión editorial que no se puede revisar, no es una decisión.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Lo que el modelo devuelve, y lo único que se acepta. */
export type Casting = { elige: string[]; motivo: string };

/** Un candidato con lo mínimo para que el modelo decida, y lo necesario para reordenar. */
export type CandidatoCasting = {
  id: string;
  titulo: string;
  lugar: string;
  categoria: string;
};

/** El resultado, con lo que hace falta para saber si se ha usado. */
export type ResultadoCasting = {
  orden: string[];
  motivo: string;
  /** `false` si el modelo no respondió y se publica con el orden por puntuación. */
  aplicado: boolean;
};

/**
 * Pide el casting al modelo y devuelve el orden.
 *
 * **Nunca lanza.** Si el modelo falla, si devuelve algo que no es JSON o si inventa un
 * evento, se devuelve el orden original con `aplicado: false` y el caller publica
 * igualmente. El correo del día es lo urgente, y que el casting no esté es una pérdida de
 * calidad, no un motivo para no publicar. Es al revés que la puerta de salud, que sí detiene
 * todo: la una es contenido y la otra son datos.
 */
export async function pedirCasting(
  candidatos: CandidatoCasting[]
): Promise<ResultadoCasting> {
  const original = candidatos.map((c) => c.id);
  const sinCambio: ResultadoCasting = {
    orden: original,
    motivo: "El modelo no respondió; se publica con la selección por puntuación.",
    aplicado: false,
  };

  if (candidatos.length === 0) return sinCambio;

  try {
    const { preguntarAOpencode, modeloDeCasting } = await import("./opencode");
    const prompt = await readFile(
      join(process.cwd(), "scripts", "prompts", "casting.md"),
      "utf8"
    );

    const mensaje = [
      prompt,
      "",
      "Estos son los candidatos:",
      JSON.stringify(
        candidatos.map((c) => ({
          id: c.id,
          titulo: c.titulo,
          lugar: c.lugar,
          categoria: c.categoria,
        })),
        null,
        2
      ),
      `Elige como mucho ${candidatos.length}.`,
    ].join("\n");

    const salida = await preguntarAOpencode(modeloDeCasting(), mensaje);
    const parsed = extraerJson(salida);

    if (!esValido(parsed)) {
      console.warn("[casting] El modelo no devolvió un casting válido; se publica sin él.");
      return sinCambio;
    }

    // **Un id inventado se descarta entero, no se filtra.** Un casting con medio casting
    // válido y medio inventado no es un casting: es medio casting y medio Fiction. Publicar
    // un plan que no existe en la agenda es el peor fallo posible aquí, y si el modelo
    // alucina una vez puede haber acertado otras. Se cae entero y se publica el original.
    const conocidos = new Set(original);
    const desconocidos = parsed.elige.filter((id) => !conocidos.has(id));
    if (desconocidos.length > 0) {
      console.warn(
        `[casting] El modelo nombró ${desconocidos.length} evento(s) que no están en la ` +
          "agenda. Se descarta el casting entero y se publica con el orden por puntuación."
      );
      return sinCambio;
    }

    // Menos de dos no es un casting: es ruido. Con uno solo no hay ni orden ni contraste.
    if (parsed.elige.length < 2) return sinCambio;

    return { orden: parsed.elige, motivo: parsed.motivo, aplicado: true };
  } catch (error) {
    console.warn(
      `[casting] No se pudo pedir el casting (${
        error instanceof Error ? error.message.slice(0, 120) : "?"
      }). Se publica con el orden por puntuación.`
    );
    return sinCambio;
  }
}

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
 * tan literal como pide. Se busca el primer `{` y el último `}` en vez de parsear todo,
 * porque los bloques de ``` son el caso habitual y romper toda la salida por eso sería
 * tirar la única respuesta que hay.
 */
export function extraerJson(salida: string): unknown {
  const inicio = salida.indexOf("{");
  const fin = salida.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  try {
    return JSON.parse(salida.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}