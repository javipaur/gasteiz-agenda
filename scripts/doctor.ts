/**
 * El médico: comprueba que todo lo del paquete está en su sitio antes de confiar en ello.
 *
 * Uso: npx tsx scripts/doctor.ts
 *
 * **Por qué existe, y es por fallos reales de esta misma semana.** Tres cosas se rompieron
 * sin que nada lo dijera: las tres rutas de imágenes devuelven 502 desde octubre —Satori
 * corta la respuesta a mitad del stream y el cliente solo ve un error sin cuerpo—, el
 * script del correo se paraba en la puerta de salud con 36/37 porque no cargaba el `.env`,
 * y `tsx` no estaba declarado en `package.json`, así que en producción se descargaba en
 * cada ejecución. Los tres_tests_no los cazaron porque solo miraban las cabeceras, y
 * `next build` tampoco porque las rutas son dinámicas.
 *
 * **Ninguno de esos fallos daba error visible.** Por eso este script existe: porque
 * "funcionaba" y "no funcionaba" se parecían demasiado desde fuera.
 *
 * **No comprueba la publicación en Instagram y no necesita credenciales.** Eso es otro
 * hurdle, y queda fuera a propósito: mientras no haya token de Meta, esta comprobación
 * tiene que seguir siendo útil, y atarla a un trámite que tarda días la volvería inútil
 * justo cuando hace falta.
 *
 * **Sale con 1 si algo falla.** Es lo que lo hace utilizable desde el cron de Dokploy sin
 * que nadie tenga que leer la salida.
 */

type Estado = "ok" | "aviso" | "fallo";

type Comprobacion = {
  nombre: string;
  estado: Estado;
  detalle: string;
};

const comprobaciones: Comprobacion[] = [];

function anotar(nombre: string, estado: Estado, detalle: string): void {
  comprobaciones.push({ nombre, estado, detalle });
}

async function ok(nombre: string, detalle: string): Promise<void> {
  anotar(nombre, "ok", detalle);
}

async function aviso(nombre: string, detalle: string): Promise<void> {
  anotar(nombre, "aviso", detalle);
}

async function fallo(nombre: string, detalle: string): Promise<void> {
  anotar(nombre, "fallo", detalle);
}

/*
 * **Fecha de un día que sí publica, porque hoy puede que no.**
 *
 * Los `require()` están justificados aquí por lo mismo que en `__tests__/`: `doctor.ts` es
 * un programa síncrono que se ejecuta solo, y el `import` estático se resolvería antes de
 * que `prepararEntornoScript` haya puesto el `.env` y el `AsyncLocalStorage` —que es
 * exactamente lo que este script viene a comprobar.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { localDateStr } = require("@/lib/utils") as typeof import("@/lib/utils");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ventanaDelDia } = require("@/lib/promo") as typeof import("@/lib/promo");

function diaDePublicacion(offsetDias = 0): string {
  const hoy = localDateStr(new Date());
  for (let salto = offsetDias; salto < offsetDias + 8; salto += 1) {
    const dia = new Date(`${hoy}T12:00:00`);
    dia.setDate(dia.getDate() + salto);
    const fecha = localDateStr(dia);
    if (ventanaDelDia(fecha)) return fecha;
  }
  return hoy;
}

/**
 * **Las cuatro rutas de imagen, una a una, y se lee el cuerpo.**
 *
 * Es el punto donde está el fallo de octubre, y un `status` no lo habría visto:
 * `ImageResponse` es perezoso y el render ocurre al leer el cuerpo, así que una prueba
 * que solo mira las cabeceras ve un 200 sano de una imagen que no existe. Aquí se
 * comprueba además que lo que baja **empieza por la firma del PNG**, que es lo que
 * distingue una imagen de un 200 con un cuerpo vacío.
 */
async function comprobarImagenes(fecha: string): Promise<void> {
  const { getAgendaEventos } = await import("@/lib/agenda");
  const { recomendados } = await import("@/lib/recomendados");
  const { MAX_DIAPOSITIVAS, urlDePromo, urlHistoria, URL_PRESENTACION } =
    await import("@/lib/promo");

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde: fecha, hasta: fecha, limite: MAX_DIAPOSITIVAS });

  if (lista.length === 0) {
    await aviso(
      "imagenes: hay eventos",
      `No hay planes recomendados el ${fecha}. Las rutas de abajo no se pueden comprobar.`
    );
    return;
  }

  const primero = lista[0];
  const rutas: Array<[string, string]> = [
    ["portada", urlDePromo(fecha)],
    ["historia", urlHistoria(fecha)],
    ["presentacion", URL_PRESENTACION],
    ["evento", urlDePromo(fecha, primero.slug)],
  ];

  let malas = 0;
  const detalles: string[] = [];

  for (const [nombre, url] of rutas) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        malas += 1;
        detalles.push(`${nombre}: HTTP ${res.status}`);
        continue;
      }

      const bytes = Buffer.from(await res.arrayBuffer());
      const esPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50;

      if (!esPng) {
        malas += 1;
        detalles.push(`${nombre}: no es PNG (${bytes.length} bytes)`);
        continue;
      }
      detalles.push(`${nombre}: ${Math.round(bytes.length / 1024)} KB`);
    } catch (error) {
      malas += 1;
      detalles.push(`${nombre}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (malas === 0) {
    await ok("imagenes: las cuatro rutas", detalles.join(" · "));
  } else {
    await fallo(
      "imagenes: las cuatro rutas",
      `${malas} de ${rutas.length} no sirven. ${detalles.join(" · ")}`
    );
  }
}

/** El paquete que consume el correo, y que las imágenes del paquete existan de verdad. */
async function comprobarPaquete(fecha: string): Promise<void> {
  const { ORIGEN_PROMO } = await import("@/lib/promo");
  const url = `${ORIGEN_PROMO}/api/promo?desde=${fecha}&hasta=${fecha}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      await fallo("paquete del despliegue", `${url} responde HTTP ${res.status}`);
      return;
    }
    const paquete = (await res.json()) as {
      portada: string;
      imagenes: string[];
      titulos: string[];
    };

    if (paquete.imagenes.length === 0) {
      await fallo("paquete del despliegue", `No trae imágenes para el ${fecha}.`);
      return;
    }
    if (paquete.titulos.length !== paquete.imagenes.length) {
      await fallo(
        "paquete del despliegue",
        `${paquete.titulos.length} títulos para ${paquete.imagenes.length} imágenes.`
      );
      return;
    }

    await ok(
      "paquete del despliegue",
      `${paquete.imagenes.length} diapositivas con sus ${paquete.titulos.length} títulos`
    );
  } catch (error) {
    await fallo("paquete del despliegue", error instanceof Error ? error.message : String(error));
  }
}

/** El agregado: sin esto el cron no manda nada, y es la puerta que hoy paraba el correo. */
async function comprobarAgregado(): Promise<void> {
  const { getAgendaSalud } = await import("@/lib/agenda");
  const salud = await getAgendaSalud();
  const degradado = salud.sourcesFallidas.length > 0 || salud.sourcesOk < salud.sourcesTotal;

  if (degradado) {
    await fallo(
      "agregado",
      `${salud.sourcesOk}/${salud.sourcesTotal}. Caídas: ` +
        salud.sourcesFallidas.map((s) => s.id).join(", ")
    );
  } else {
    await ok("agregado", `${salud.sourcesOk}/${salud.sourcesTotal} fuentes, ninguna caída`);
  }
}

/**
 * Las variables de las que depende el correo.
 *
 * **`MEC_TOKEN` se comprueba por lo que vale y no por estar presente.** Medido: con un
 * token inventado —que es exactamente lo que pasa cuando caduca o cuando alguien pega el
 * equivocado— la variable está puesta y esta comprobación la daba por buena, mientras que
 * la fuente caía y el cron se paraba. Un chequeo de presencia no sirve para una credencial
 * que puede estar caducada: para eso hace falta preguntarle a quien la usa.
 *
 * Se pregunta a `rula` y no a la API de Meta directamente, porque es la fuente que de
 * verdad la consume y su fallo es el que para el correo.
 */
async function comprobarVariables(): Promise<void> {
  const necesarias = [
    "PROMO_PARA",
    "EMAIL_USER",
    "EMAIL_PASS",
    "MEC_TOKEN",
  ] as const;

  const faltan = necesarias.filter((n) => !process.env[n]?.trim());

  if (faltan.length > 0) {
    anotar(
      "variables de correo",
      "fallo",
      `Faltan: ${faltan.join(", ")}. El cron NO mandará nada mientras falte alguna.`
    );
  } else {
    anotar("variables de correo", "ok", "las cuatro están puestas");
  }

  // **La de `rula` se prueba, no se supone.** `MEC_TOKEN` es la única que puede estar
  // puesta y no servir, y es la que hace que el agregado caiga a 36/37 sin que se vea
  // ningún error rojo: el cron sale con 1 y no manda nada.
  if (!process.env.MEC_TOKEN?.trim()) return;

  try {
    const { scrapeRula } = await import("@/lib/sources/rula");
    const eventos = await scrapeRula();

    if (eventos.length === 0) {
      /*
       * **No se puede fiar de `scrapeRula` para esto, y está medido.**
       *
       * Con `MEC_TOKEN` inventado, la API responde 500 y `scrapeRula` **devuelve `[]` en
       * vez de lanzar**: el `if (!res.ok)` se come el error y sale una lista vacía. Con el
       * token bueno devuelve cientos. Es decir, `[]` significa las dos cosas a la vez.
       *
       * **Y el agregado no lo delata**: se consulta en paralelo, y una lista vacía no es una
       * caída, así que la salud sigue en 37/37 con el token inventado. Probado: el primer
       * médico dio `37/37` con un token que no servía.
       *
       * Por eso la pregunta se hace **contra la API, saltándose el scraper**. Es la única
       * forma de distinguir "no hay token" de "hoy no hay eventos", y el motivo está
       * escrito porque es el fallo más difícil de ver de todo lo que hay aquí: nada falla,
       * nada avisa, y el correo simplemente no llega.
       *
       * Sigue siendo un **aviso** y no un fallo: la respuesta correcta a "el token no vale"
       * la tiene que dar la puerta de salud del cron, no este script, para que el fallo siga
       * siendo de un solo sitio.
       */
      const token = process.env.MEC_TOKEN!;
      try {
        const res = await fetch("https://www.lagenterula.com/wp-json/mec/v1.0/events?limit=1", {
          headers: { "mec-token": token, "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(20_000),
        });
        anotar(
          "MEC_TOKEN sirve",
          res.ok ? "aviso" : "fallo",
          res.ok
            ? "La Genterula responde, pero la fuente no devolvió eventos. Puede ser un día sin agenda."
            : `La Genterula responde HTTP ${res.status} con este token. Es lo que pasa con un ` +
              "token caducado o equivocado: `scrapeRula` devuelve `[]` en vez de fallar, así " +
              "que un token malo se ve igual que un día sin eventos."
        );
      } catch (error) {
        anotar(
          "MEC_TOKEN sirve",
          "aviso",
          `No se pudo comprobar el token contra la API (${String(error)}).`
        );
      }
    } else {
      anotar("MEC_TOKEN sirve", "ok", `${eventos.length} eventos desde La Genterula`);
    }
  } catch (error) {
    anotar(
      "MEC_TOKEN sirve",
      "fallo",
      `La Genterula no responde con este token (${
        error instanceof Error ? error.message : String(error)
      }). Sin él, rula cae y el cron no manda.`
    );
  }
}

/** Lo que el cron necesita para funcionar, y que no se ve en el log de la web. */
function comprobarDependencias(): void {
  // **Se lee el `package.json` de este repositorio y no el que haya en el cwd.** Con un
  // `require` de valor relativo el módulo se resuelve desde este fichero, así que el
  // `../` es correcto aunque el cron se ejecute desde otro directorio —y el cron se
  // ejecuta desde `/`. Con `process.cwd()` bastaría en local y fallaría en Dokploy, que es
  // exactamente donde este script tiene que servir.
  //
  // El `eslint-disable` es por lo mismo que más arriba: un `import` de `package.json` es
  // estático y se resolvería antes de que este script llegue a comprobar nada.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const paquete = require("../package.json") as {
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };

  // `tsx` y `dotenv` se declararon a mano porque `npx` los resolvía en local y no en el
  // contenedor. Un `npm ls` es más barato que descubrirlo en el cron de las nueve.
  const necesarias = ["tsx", "dotenv"];
  const faltan = necesarias.filter((n) => !paquete.dependencies?.[n]);

  if (faltan.length > 0) {
    anotar(
      "dependencias del cron",
      "fallo",
      `No declaradas en "dependencies": ${faltan.join(", ")}. npx las bajaría en cada ejecución.`
    );
    return;
  }

  anotar("dependencias del cron", "ok", "tsx y dotenv están declaradas en dependencies");

  if (!paquete.scripts?.["promo:send"]) {
    anotar("scripts de npm", "fallo", 'Falta el script "promo:send" en package.json.');
  } else {
    anotar("scripts de npm", "ok", "promo:send existe");
  }
}

/**
 * El casting: si el modelo no responde, el correo tiene que seguir saliendo igual.
 *
 * **La llamada vive en `scripts/opencode.ts` y no aquí.** Estaba copiada, la copia se
 * quedó con `execFile` y falló con `Command failed` sin decir por qué. Dos copias de la
 * misma llamada divergen en cuanto se toca una.
 */
async function comprobarCasting(fecha: string): Promise<void> {
  const { preguntarAOpencode, modeloDeCasting } = await import("./opencode");

  try {
    // Un saludo mínimo y no el prompt entero: aquí se comprueba que **opencode arranca y
    // responde**, que es lo que se quiere saber. El prompt entero y los veinte candidatos
    // los prueba `scripts/casting.ts`, y este tiene que caber en un segundo.
    const salida = await preguntarAOpencode(
      modeloDeCasting(),
      `Responde solo con la palabra LISTO y nada más. Fecha de prueba ${fecha}.`
    );

    anotar(
      "casting con el modelo",
      salida.includes("LISTO") ? "ok" : "aviso",
      salida.includes("LISTO")
        ? "opencode responde"
        : "opencode respondió algo que no es el esperado"
    );
  } catch (error) {
    anotar(
      "casting con el modelo",
      "aviso",
      `No se pudo comprobar (${error instanceof Error ? error.message.slice(0, 120) : "?"}). ` +
        "El correo sigue saliendo sin casting: es un aviso, no un fallo."
    );
  }
}

async function mainDoctor(): Promise<void> {
  const { prepararEntornoScript } = await import("./entorno");
  await prepararEntornoScript();

  console.log("\n  GASTEIZ CLICK · comprobación del paquete de redes\n");

  const fecha = diaDePublicacion();
  console.log(`  Probando el ${fecha} (día de publicación)\n`);

  comprobarDependencias();
  await comprobarVariables();
  await comprobarAgregado();
  await comprobarImagenes(fecha);
  await comprobarPaquete(fecha);
  await comprobarCasting(fecha);

  const simbolo: Record<Estado, string> = { ok: "OK   ", fallo: "FALLO", aviso: "AVISO" };

  console.log("");
  for (const c of comprobaciones) {
    console.log(`  [${simbolo[c.estado]}] ${c.nombre}`);
    console.log(`         ${c.detalle}`);
  }

  const fallos = comprobaciones.filter((c) => c.estado === "fallo").length;
  const avisos = comprobaciones.filter((c) => c.estado === "aviso").length;

  console.log("");
  if (fallos > 0) {
    console.log(`  ${fallos} fallo(s). El cron no publicará.\n`);
    process.exitCode = 1;
    return;
  }
  if (avisos > 0) {
    console.log(`  Todo lo esencial está bien. ${avisos} aviso(s).\n`);
    return;
  }
  console.log("  Todo correcto.\n");
}

void mainDoctor().catch((error) => {
  console.error("[doctor] Fallo grave:", error);
  process.exitCode = 1;
});