/**
 * Preguntar a opencode desde un script.
 *
 * **Un solo sitio, y no tres copias.** La primera versión de esta llamada estaba dentro
 * de `scripts/casting.ts`; el médico la copió, la copia se quedó con `execFile` y falló
 * con `Command failed` sin decir por qué. Dos copias de la misma llamada divergen en
 * cuanto una de ellas se toca, y el síntoma aparece en el sitio que no se ha tocado.
 */
import { spawn } from "node:child_process";

/**
 * Le pregunta a opencode y devuelve lo que contestó.
 *
 * **`spawn` y no `execFile`, y la diferencia es que este sí encadena stdin.** Medido: el
 * mismo prompt por `execFile` falla con `Command failed` sin más, y a mano por la terminal
 * responde con código 0. `opencode run` lee la instrucción de stdin, y `cmd /c` —necesario
 * en Windows porque `spawn` no lanza un `.cmd`— no lo propaga.
 *
 * **En Windows el comando pasa por `cmd /c`; en Linux, no.** `spawn` no puede lanzar un
 * `.cmd` y devuelve `EINVAL` desde Node 20, y `cmd /c` en Linux no existe. El separador
 * se elige aquí y no en el resto del código.
 *
 * **El temporizador mata al hijo y no solo rechaza.** Si solo se rechazara la promesa, el
 * proceso seguiría corriendo y el cron acumularía opencode zombis hasta que el contenedor
 * no tenga memoria.
 *
 * @param modelo `provider/model`. Sin él usa `CASTING_MODELO` o el gratuito por defecto.
 * @param mensaje El prompt entero. Se cierra `stdin` después, que es lo que hace que
 *   opencode deje de esperar y conteste.
 * @param ms Timeout. Por defecto 180 s, que es de sobra para una respuesta corta y
 *   suficiente para un casting de veinte candidatos.
 */
export async function preguntarAOpencode(
  modelo: string,
  mensaje: string,
  ms = 180_000
): Promise<string> {
  const esWindows = process.platform === "win32";
  const ejecutable = esWindows ? "cmd" : "opencode";
  const argumentos = esWindows
    ? ["/c", "opencode.cmd", "run", "--model", modelo]
    : ["run", "--model", modelo];

  return new Promise<string>((resolve, reject) => {
    const hijo = spawn(ejecutable, argumentos, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let salida = "";
    let error = "";

    hijo.stdout.on("data", (trozo: Buffer) => {
      salida += trozo.toString();
    });
    hijo.stderr.on("data", (trozo: Buffer) => {
      error += trozo.toString();
    });

    hijo.stdin.write(mensaje);
    hijo.stdin.end();

    const temporizador = setTimeout(() => {
      hijo.kill();
      reject(new Error(`opencode no respondió en ${ms} ms.`));
    }, ms);

    hijo.on("error", (e) => {
      clearTimeout(temporizador);
      reject(e);
    });

    hijo.on("close", (codigo) => {
      clearTimeout(temporizador);
      if (codigo !== 0) {
        // **El error se corta a 4000 caracteres** porque el prompt entero suele venir
        // dentro, y una línea de "Command failed" sin explicación ayuda menos que las
        // primeras letras de lo que pasó.
        reject(
          new Error(`opencode salió con ${codigo}. ${(error || salida).slice(0, 4000)}`)
        );
        return;
      }
      resolve(salida);
    });
  });
}

/**
 * El modelo por defecto: `CASTING_MODELO`, o el gratuito si no está puesto.
 *
 * **El default se cambia cuando el modelo deja de existir.** El que estaba
 * aquí —`opencode/space-bunny-free`— ya no está en el catálogo, y el casting
 * fallaba con `Model unavailable` sin llegar a la parte que decide: el
 * script que decide se cayó por el modelo que le responde. Con
 * `CASTING_MODELO` en el `.env` el modelo se cambia sin tocar el código, que
 * es donde debería estar la decisión.
 */
export function modeloDeCasting(): string {
  return process.env.CASTING_MODELO?.trim() || "opencode/minimax-m3.1-flash-free";
}