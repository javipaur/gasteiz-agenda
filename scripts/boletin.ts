/**
 * El boletín del día, en texto, para pegarlo en WhatsApp.
 *
 * Uso: `npm run boletin` (o `npx tsx scripts/boletin.ts`).
 *
 * ## Qué sale por la salida y qué por el error
 *
 * **La salida estándar lleva solo el boletín**, sin una línea de más: es lo que
 * se copia, y un `[boletin] Obteniendo eventos…` en medio se pega en el chat. Los
 * diagnósticos van a `stderr`, que es lo que un flujo de n8n puede registrar sin
 * que acabe dentro del mensaje.
 *
 * ## Cuándo sale con 1
 *
 * Solo cuando **no se puede afirmar nada con honestidad**: cero planes y un
 * agregado que no es de fiar. Un día sin planes de verdad sale con 0 y un boletín
 * que lo dice; una agenda a medias porque se han caído las fuentes no se manda.
 * Es la misma puerta que `lib/digest.ts` aplica al push, y se reutiliza en vez de
 * copiarla: dos copias de esa regla divergen el día que se toque una.
 *
 * ## Lo que no entra
 *
 * El formato de referencia trae tiempo, gasolina y titulares de política. Aquí no
 * hay fuente para nada de eso, así que no se escribe. Un bloque inventado en un
 * boletín es el mismo fallo de siempre: un texto que afirma algo que nadie ha
 * comprobado. Lo único fuera de la agenda son las farmacias de guardia, que sí
 * tienen fuente propia —y si esa fuente falla, el bloque no aparece—.
 */

import { prepararEntornoScript } from "./entorno";
import { localDateStr } from "../lib/utils";

/**
 * La fecha del boletín, con la hora local de la máquina.
 *
 * **No se pasa como argumento y no se lee dentro de `lib/boletin.ts`.** El
 * módulo del boletín es puro a propósito —recibe `hoy`— para que un test pueda
 * fijar el día; la lectura del reloj, que es lo único que no se puede probar sin
 * esperar, se queda aquí, en el borde.
 */
function fechaDeHoy(): string {
  return localDateStr(new Date());
}

/**
 * Todo lo que la aplicación escriba por consola se va al error, no a la salida.
 *
 * **No es cosmética.** El agregador avisa con `logger.warn` cuando una fuente se
 * cae, y el `ConsoleTransport` de Axiom escribe con `console.log` —o sea, en la
 * salida estándar—. En la web eso da igual, porque nadie lee la salida. Aquí la
 * salida estándar **es el boletín**, y el aviso de `municipal-deporte` son seis
 * líneas de objeto que acaban pegadas en el chat del grupo antes del saludo.
 *
 * Se cambian las funciones de `console` y no el transporte porque el transporte
 * es el de producción y un script no lo reconfigura. `process.stdout.write`, que
 * es lo único que escribe el boletín, no pasa por `console`: queda aislado.
 *
 * `warn` y `error` ya van a `stderr` en Node y se dejan como están.
 */
function mandarLaConsolaAlError(): void {
  console.log = console.error;
  console.info = console.error;
  console.debug = console.error;
}

export async function main(): Promise<number> {
  mandarLaConsolaAlError();

  await prepararEntornoScript();

  const { getProximosEventos } = await import("../lib/eventos");
  const { textoDelBoletin } = await import("../lib/boletin");
  const { agregadoNoEsConfiable } = await import("../lib/digest");
  const { scrapeGuardiasDe } = await import("../lib/sources/farmacias-guardia");

  const fecha = fechaDeHoy();

  console.error(`[boletin] armando el boletín de ${fecha}`);

  const eventos = await getProximosEventos();

  /**
   * Las farmacias van en su propio `try` y **no** tumban el boletín.
   *
   * El Colegio es un tercero: si su web cambia o su WAF decide bloquear, el
   * boletín se queda sin el bloque de guardias y sigue siendo verdad. Lo que no
   * se hace es pasarle una lista vacía a `bloqueDeFarmacias`, porque eso
   * imprimiría "no hay farmacias de guardia" cuando lo que pasa es que no se
   * pudo preguntar. Sin lista, el bloque no existe.
   */
  let farmacias: import("../lib/sources/farmacias-guardia").FarmaciaGuardia[] | undefined;
  try {
    farmacias = await scrapeGuardiasDe(fecha);
    console.error(`[boletin] ${farmacias.length} farmacias de guardia`);
  } catch (error) {
    console.error(
      `[boletin] sin farmacias de guardia: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const boletin = textoDelBoletin({ fecha, eventos, farmacias });

  if (boletin.eventos.length === 0) {
    if (await agregadoNoEsConfiable()) {
      console.error(
        "[boletin] el agregado vino vacío y no es de fiar: no se manda nada. " +
          "Un boletín que dice que no hay planes cuando no lo sabemos es peor que no mandarlo."
      );
      return 1;
    }

    console.error(
      "[boletin] hoy no hay planes en el agregado, y eso es la respuesta: sale el boletín sin bloques."
    );
  }

  console.error(`[boletin] ${boletin.eventos.length} planes, ${boletin.texto.length} caracteres`);

  process.stdout.write(`${boletin.texto}\n`);

  return 0;
}

if (require.main === module) {
  main()
    .then((codigo) => {
      process.exitCode = codigo;
    })
    .catch((error) => {
      console.error("[boletin] fallo:", error);
      process.exitCode = 1;
    });
}
