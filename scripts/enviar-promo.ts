/**
 * Manda por correo el carrusel del día o del finde.
 * Uso: npx tsx scripts/enviar-promo.ts
 *
 * También se ejecuta como cron (Dokploy), todos los días.
 *
 * **Este script no publica.** No hay token de Instagram ni llamada a la Graph API en
 * ninguna parte de este proyecto: el correo llega con las imágenes numeradas y quien lo
 * recibe decide si el día lo merece y lo sube. Publicar es una decisión editorial, y
 * automatizarla metería una credencial en el repo a cambio de nada.
 *
 * **Depende de que su propio despliegue esté vivo, y es a conciencia.** Se pide el
 * paquete a `/api/promo` en vez de montarlo en local. El motivo está medido y escrito en
 * `pedirPaquete`: con las dos copias de la lista, cada imagen que no estuviera en la
 * caché de producción salía como un 404. Un script que dibuja sus imágenes no depende de
 * la web para nada; este elige que la web sea la única que sabe qué se publica.
 *
 * Y lo que sí lee son los eventos del agregador para la **puerta de salud**, y el paquete
 * ya montado para las imágenes. Ver `pedirPaquete` para por qué son dos cosas distintas.
 */
import type { PaquetePromo } from "@/lib/promo";

/** Los ficheros van aquí salvo que `PROMO_DESTINO` diga otra cosa. */
const DESTINO_POR_DEFECTO = "data/promo";

/*
 * Las fuentes cuya ausencia **no** impide publicar, y por qué son esas y no otras.
 *
 * **`rula` es la única tolerable porque es la única que depende de una credencial.** Las
 * otras 36 son públicas: se consultan con una URL y funcionan o no según esté su sitio
 * vivo, sin token, sin cuenta y sin nada que mantener. `rula` llama a un API de
 * La Genterula con `MEC_TOKEN`, así que su disponibilidad depende de un token que puede
 * caducar y de un tercero que puede caer.
 *
 * **Medido: esa dependencia ya ha parado el cron durante días.** Un 500 del API —no un
 * fallo de código— dejó la fuente caída, la puerta de salud detenía el envío y no había
 * forma de publicar el paquete del día con las otras 36 fuentes perfectamente sanas.
 *
 * **Que sea tolerable no significa que no se note.** El aviso por consola dice cuántas son
 * y cuáles, porque perder `rula` se ve en el post: es la fuente de eventos de Runa, una de
 * las que más pesa en el agregado.
 *
 * **Añadir una fuente aquí es una decisión editorial y va en un sitio.** Con un `||` en la
 * condición, el criterio quedaría repartido y no se vería de un vistazo.
 */
const FUENTES_TOLERABLES = new Set(["rula"]);

/**
 * La imagen del post de presentación, bajada del despliegue.
 *
 * **El `cid` es `presentacion` y no un número, y esa es la parte que importa.** `adjuntosDe`
 * numera lo que le pasa, así que si esta imagen entrara por ahí saldría como `promo-01` y
 * en el correo se leería `01 · Presentación`, que es exactamente la confusión que este
 * bloque existe para evitar: que alguien lo suba como si fuera la primera diapositiva del
 * carrusel.
 *
 * **Un fallo aquí no tumba el correo.** Si la presentación no se baja, lo que se pierde es
 * el material de apoyo y el carrusel —que es lo urgente— sigue saliendo entero. Es al revés
 * que la puerta de salud, que sí detiene todo: aquí una imagen que falta no puede impedir
 * que llegue el paquete del día.
 */
async function descargarPresentacion() {
  const { URL_PRESENTACION, TEXTO_PRESENTACION, ENLACE_PRESENTACION } =
    await import("@/lib/promo");

  try {
    const res = await fetch(URL_PRESENTACION);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = Buffer.from(await res.arrayBuffer());

    return {
      texto: TEXTO_PRESENTACION,
      enlace: ENLACE_PRESENTACION,
      adjunto: {
        filename: "presentacion.png",
        content,
        contentDisposition: "inline" as const,
        cid: "presentacion",
      },
      adjuntoColgado: {
        filename: "presentacion.png",
        content,
        contentDisposition: "attachment" as const,
      },
    };
  } catch (error) {
    console.warn(
      `[promo] La presentación no se pudo bajar (${
        error instanceof Error ? error.message : String(error)
      }). El carrusel se manda igualmente.`
    );
    return null;
  }
}

/**
 * El paquete, pidiéndoselo a quien dibuja las imágenes.
 *
 * **Por qué se pide y no se calcula aquí. Medido, no razonado:** el script llegaba a
 * producción con una lista montada en local y se pedían sus imágenes. Las dos listas las
 * calcula el mismo código, pero en instantes distintos y desde cachés distintas —la del
 * despliegue va con `revalidate: 1800`—, así que no tienen por qué coincidir. Cuando no
 * coincidían, el script pedía la imagen de un slug que producción **nunca había
 * dibujado**, y `/api/promo/[fecha]/evento/[slug]` respondía 404. Medido en un jueves
 * real: la lista local pedía `feria-del-libro-presentacion-y-firma-con-katixa-agirre`, y
 * ese slug seguía dando 404 mientras los seis que tenía producción bajaban sin problema.
 *
 * O sea: el fallo no era de imágenes, era que el script y el sitio tenían **dos copias
 * de la lista**, y el que dibujaba no era el que la nombraba. Por eso ahora se pide el
 * paquete ya montado, que es la única forma de que la URL de una imagen y el título que
 * va debajo suyo sean la misma verdad.
 *
 * **La puerta de salud sigue siendo local y a propósito.** `/api/v1/salud` informa de las
 * fuentes del despliegue, que es exactamente lo que hay que vigilar antes de publicar: si
 * la lista de producción viene de un agregado a medias, el paquete heredaría ese defecto
 * y ni el tamaño ni los 404 lo delatarían. Comprobarlo donde nacen los datos —y no
 * donde se sirven— es lo que hace que esa puerta siga significando algo.
 */
async function pedirPaquete(desde: string, hasta: string) {
  const { ORIGEN_PROMO } = await import("@/lib/promo");
  const url = `${ORIGEN_PROMO}/api/promo?desde=${desde}&hasta=${hasta}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`El paquete no se pudo pedir a ${url}: HTTP ${res.status}`);
  }

  const paquete = (await res.json()) as PaquetePromo;

  // Una respuesta con la forma equivocada pasa el `res.ok` y revienta tres líneas más
  // abajo, en un sitio que no dice qué la rompió. Se comprueba aquí, donde el error
  // todavía significa algo.
  if (!paquete || !Array.isArray(paquete.imagenes) || !Array.isArray(paquete.titulos)) {
    throw new Error(`El paquete de ${url} no tiene la forma esperada.`);
  }
  if (paquete.titulos.length !== paquete.imagenes.length) {
    throw new Error(
      `El paquete de ${url} trae ${paquete.titulos.length} títulos para ` +
        `${paquete.imagenes.length} imágenes.`
    );
  }

  return paquete;
}

export async function main() {
  console.log("[promo] Calculando la ventana de hoy...");

  /*
   * **El `.env` se carga aquí y no lo carga Next, porque esto no es Next.**
   *
   * Medido: sin estas líneas, `npm run promo:send` se detiene en la puerta de salud con
   * `36/37` y `rula` en la lista de caídas —aunque `MEC_TOKEN` esté perfectamente puesto y
   * la API responda con 37/37 fuentes. El mensaje que escupe `rula` es «MEC_TOKEN no esta
   * definido», y en el proceso del script era verdad.
   *
   * **La causa no es que falte la variable sino quién la lee.** Dentro de Next,
   * `loadEnvConfig` la pone en el proceso al arrancar y todo lo que se importa después la
   * ve. Un script suelto con `tsx` no pasa por ahí: lee `process.env.MEC_TOKEN` y encuentra
   * `undefined`, aunque en la terminal la variable esté exportada.
   *
   * **Se leen los dos ficheros y en el orden de Next, no solo `.env`.** Next carga
   * `.env.local` por delante de `.env` —está en el orden de precedencia de `@next/env`— y
   * este repo tiene los dos. `MEC_TOKEN` está en `.env`, pero quien decide el orden es
   * `dotenv`, no la última llamada.
   *
   * **`override: false` en los dos.** Sin él, una variable ya presente en el entorno real
   * gana sobre el fichero, que es lo que quiere el contenedor de Dokploy: sus variables
   * mandan sobre lo que hay escrito en un `.env` de la imagen.
   */
  const { config } = await import("dotenv");
  config({ path: ".env.local", override: false, quiet: true });
  config({ path: ".env", override: false, quiet: true });

  // `AsyncLocalStorage` no es global en Node 24 y `lib/agenda.ts` →
  // `lib/axiom/server.ts` → `@axiomhq/nextjs` lo lee de `globalThis` al importarse.
  // Dentro de Next ya está resuelto; en un script suelto con `tsx` no, y el fallo es un
  // `TypeError` que no dice qué lo ha provocado. Es el mismo apaño que hace
  // `jest.setup.ts` y que ya hace `scripts/send-newsletter.ts`.
  //
  // **La comprobación mira que sea un constructor, y no solo que exista.** El
  // `typeof ... === "undefined"` original daba por bueno un `globalThis.AsyncLocalStorage`
  // que estaba presente pero no era construible, así que el apaño se saltaba y el fallo
  // reventaba más tarde, en `getAgendaSalud()`, con un `TypeError` que señalaba a
  // `AsyncLocalStorage` y a nada de lo que el mensaje hablaba: la puerta de salud y `rula`.
  const ALS = (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage;
  if (typeof ALS !== "function") {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage =
      AsyncLocalStorage;
  }

  const { ventanaDelDia } = await import("@/lib/promo");

  const hoy = (await import("@/lib/utils")).localDateStr(new Date());
  const ventana = ventanaDelDia(hoy);

  // Los cuatro días que no se publican **no son un día flojo**: son un día que no toca.
  // Salir con 0 y sin correo es lo que permite que el cron corra los siete días sin que
  // el martes llegue un paquete vacío.
  if (!ventana) {
    console.log(`[promo] Hoy ${hoy} no se publica. Nada que hacer.`);
    return;
  }

  const { desde, hasta } = ventana;
  console.log(`[promo] Ventana: ${desde} — ${hasta} (${ventana.etiqueta})`);

  // ---------------------------------------------------------------- puerta 1
  // El agregado entero. Comparar con los días anteriores **no vale**, y está medido por
  // qué: el agregado no guarda eventos pasados —cualquier ventana en el pasado devuelve
  // 0—, así que la línea base sería 0 y la comparación no se dispararía nunca.
  // `sourcesFallidas` sí lo dice.
  // **Solo la salud, no los eventos.** El script ya no los pide: el paquete viene montado
  // de `/api/promo` y sus eventos no se tocan. Lo que queda de lectura local es esta
  // puerta, y se lee aquí a propósito —está en `pedirPaquete`.
  const { getAgendaSalud } = await import("@/lib/agenda");

  const salud = await getAgendaSalud();
  /*
   * `sourcesOk` **no** ve la diferencia entre "respondió con lista vacía" y
   * "no consultó lo que le tocaba". Y no es que se le escape: por construcción no
   * puede. `lib/agenda.ts` lo deriva como `ordered.length - sourcesFallidas.length`,
   * y una fuente que resuelve con `[]` cuenta como cumplida. Por tanto
   * `sourcesOk < sourcesTotal` es exactamente lo mismo que
   * `sourcesFallidas.length > 0`, y aquí se escribían las dos como si fueran
   * comprobaciones distintas.
   *
   * La consecuencia es que la tercera disyunción de la puerta de abajo,
   * `(degradado && caidas.length === 0)`, era una **contradicción**: `degradado`
   * solo era verdad cuando `caidas` tenía algo. Siempre `false`. Llevaba ahí
   * respaldada por un comentario que explicaba —con detalle y con una razón que
   * sonaba buena— por qué hacía falta, y ese comentario describía una capacidad que
   * los datos de salud no tienen.
   *
   * Se quita, no se arregla: no hay forma de escribir esa disyunción que signifique
   * algo. Lo que sí falta, y es otra decisión, es poder distinguir caída de vacío,
   * y eso necesita que `AgendaMeta` diga cuántas filas trajo cada fuente. Está
   * anotado en AGENTS.md; no cabe en un parche de este sitio porque
   * `/api/v1/salud` es contrato con un cliente de fuera.
   */

  /*
   * **Una fuente caída solo para el correo si no es tolerable. Medido, no supuesto.**
   *
   * La regla era "si cae una fuente, no se publica nada", y ha sido correcta: un agregado
   * a medias es un paquete a medias. El problema es que no distingue **cuántas** han caído
   * de **cuáles**, y una sola fuente con credencial —que depende de un token y de un
   * tercero— ya ha dejado el cron sin poder publicar durante días.
   *
   * - **Cae solo tolerables** → se publica y se avisa. Se pierde un 3% de los eventos; el
   *   97% sigue siendo la agenda de Vitoria.
   * - **Cae alguna no tolerable, o cae más de la mitad** → no se publica, como antes.
   *
   * **`rula` es la única tolerable porque es la única con credencial.** Las otras 36 son
   * públicas y no dependen de un token. Y como es la que más pesa en el agregado, perderla
   * se nota: el aviso dice cuántas son, no solo que "no pasa nada".
   *
   * **La lista es un `Set` y no un `if` por id**, para que añadir una fuente a esa lista sea
   * una decisión visible en un sitio y no un `||` repartido por la condición.
   */
  const caidas = salud.sourcesFallidas.map((s) => s.id);
  const noTolerables = caidas.filter((id) => !FUENTES_TOLERABLES.has(id));

  // Más de la mitad caída, tolerables o no: el agregado a medias deja de ser la
  // agenda de Vitoria. Es la mitad del total, no un número de fuentes, y por eso
  // sale de `sourcesOk` y no de `noTolerables`.
  const sinMedioAgregado = salud.sourcesOk < salud.sourcesTotal / 2;

  if (noTolerables.length > 0 || sinMedioAgregado) {
    console.error(
      `[promo] El agregado está degradado (${salud.sourcesOk}/${salud.sourcesTotal}).`,
      `Fuentes caídas: ${caidas.join(", ") || "sin registrar"}`
    );
    console.error(
      "[promo] No se manda nada. Con el agregado a medias, el paquete sería medio día."
    );
    process.exitCode = 1;
    return;
  }

  if (caidas.length > 0) {
    console.warn(
      `[promo] Faltan ${caidas.length} fuentes tolerables (${caidas.join(", ")}). ` +
        "Se publica igualmente: el resto de la agenda está completa."
    );
  }

  const paqueteBase = await pedirPaquete(desde, hasta);

  /*
   * **El casting reordena el paquete, y solo lo reordena.**
   *
   * No se pide aquí la lista de eventos: ya vino del despliegue, y esa lista es la que
   * tiene las imágenes dibujadas. El casting devuelve **ids que ya están en el paquete** y
   * lo que se hace es cambiar el orden con el que se descargan y se nombran. Así, imagen y
   * título siguen siendo la misma verdad aunque el orden lo ponga un modelo.
   *
   * **Si el casting no llega, se publica igual.** Es la diferencia con la puerta de salud:
   * esa para todo porque los datos son la agenda, y el casting es una mejora de la
   * selección. Un día sin modelo es un día con el orden por puntuación, que es el que
   * llevaba días funcionando.
   */
  const { pedirCasting } = await import("./casting-logica");

  const casting = await pedirCasting(
    paqueteBase.titulos.map((titulo, i) => ({
      // El id es la posición: es lo único que la imagen y su título comparten, y lo que
      // el modelo devuelve. Un id inventado por el modelo no puede colarse en una posición
      // que existe, que es justo lo que `pedirCasting` descarta.
      id: String(i),
      titulo,
      lugar: "",
      categoria: "",
    }))
  );

  // Reordena títulos e imágenes **con el mismo índice**, que es lo que hace que la imagen
  // `03` siga siendo la del título que va debajo. Ordenar solo uno de los dos sería el
  // fallo más caro posible aquí: un post con las fotos de unos planes y los nombres de
  // otros.
  //
  // **Se recorre el casting y se busca por posición, y no al revés.** Un `filter` con un
  // `Set` de índices conservaría el orden en que venían, que es el orden por puntuación:
  // se quedarían los mismos eventos pero en el orden viejo, y el casting no habría hecho
  // nada. Un `Set` **membership** y un `Set` **no** son lo mismo, y aquí hacía falta lo
  // segundo.
  const posiciones = casting.orden.map(Number).filter((i) => i >= 0 && i < paqueteBase.titulos.length);

  const paquete = {
    ...paqueteBase,
    imagenes: posiciones.map((i) => paqueteBase.imagenes[i]),
    titulos: posiciones.map((i) => paqueteBase.titulos[i]),
    casting: casting.aplicado ? { motivo: casting.motivo, aplicado: true } : null,
  };

  if (!casting.aplicado) {
    console.log("[promo] Sin casting: se publica con el orden por puntuación.");
  } else {
    console.log(`[promo] Casting: ${casting.motivo}`);
  }

  // Los títulos vienen **en el paquete**, y no de una lista local aparte, porque tienen
  // que ser los de las imágenes que se mandan. De otro modo el pie puede nombrar un plan
  // que no está en la diapositiva de al lado, y eso solo se vería después de publicar.
  const titulos = paquete.titulos;

  const { descargarImagenes, escribirPaqueteEnDisco, adjuntosDe } =
    await import("@/lib/promo-ficheros");
  const destino = process.env.PROMO_DESTINO ?? DESTINO_POR_DEFECTO;

  /** Lo que siempre se hace: bajar, escribir en disco y decir dónde ha quedado. */
  const preparar = async () => {
    const imagenes = await descargarImagenes([paquete.portada, ...paquete.imagenes]);
    const dir = await escribirPaqueteEnDisco(destino, desde, imagenes, paquete);
    console.log(`[promo] ${imagenes.length} imágenes en ${dir}`);
    return imagenes;
  };

  // ---------------------------------------------------------------- puerta 2
  // Tres planes es el mínimo. Este paquete existe y solo es fino, así que **sí** se
  // escribe en disco: quien lo encuentre decide si lo publica.
  if (paquete.imagenes.length < 3) {
    console.warn(
      `[promo] Solo ${paquete.imagenes.length} planes en la ventana. No se manda correo.`
    );
    await preparar();
    console.warn("[promo] El paquete está en disco por si quieres mandarlo a mano.");
    process.exitCode = 1;
    return;
  }

  const imagenes = await preparar();

  const para = process.env.PROMO_PARA?.trim();
  if (!para) {
    console.error("[promo] Falta PROMO_PARA. El paquete está en disco y no se manda correo.");
    process.exitCode = 1;
    return;
  }

  const { sendMail } = await import("@/lib/mail");
  const { asuntoDelCorreo, htmlDelCorreo } = await import("@/lib/promo-correo");

  /*
   * **La presentación se baja aparte y con su propio `cid`, y va después del carrusel.**
   *
   * Su `cid` es `presentacion` y no `promo-08` a propósito: el número es para las
   * diapositivas, y una imagen sin número es justo la señal de que esto no es una más.
   * En `htmlDelCorreo` aparece en su propia sección, con su pie de foto, para que no se
   * confunda con el plan del último día.
   *
   * **Se manda cuando `PROMO_CON_PRESENTACION` lo dice y no por defecto.** El post de
   * presentación no caduca —el carrusel de la agenda cambia cada mañana—, así que
   * mandarlo todas las semanas solo consigue que deje de leerse. Quien decide cuándo
   *.presentar es el editorial, no el calendario.
   */
  const conPresentacion = process.env.PROMO_CON_PRESENTACION?.trim() === "1";
  const adjuntoPresentacion = conPresentacion
    ? await descargarPresentacion()
    : null;

  const res = await sendMail({
    to: para,
    subject: asuntoDelCorreo(desde, hasta, titulos.length),
    html: htmlDelCorreo(
      paquete,
      titulos,
      // Solo el texto y el enlace llegan al HTML; los adjuntos van aparte, en la lista de
      // `attachments`. Es la misma imagen en dos sitios, no dos imágenes.
      adjuntoPresentacion
        ? { texto: adjuntoPresentacion.texto, enlace: adjuntoPresentacion.enlace }
        : undefined
    ),
    text: `${paquete.texto}\n\n${paquete.enlace}`,
    attachments: [
      ...adjuntosDe(imagenes),
      ...(adjuntoPresentacion
        ? [adjuntoPresentacion.adjunto, adjuntoPresentacion.adjuntoColgado]
        : []),
    ],
  });

  if (!res.ok) {
    console.error(`[promo] No se pudo mandar el correo: ${res.error}`);
    console.error("[promo] El paquete sigue en disco.");
    process.exitCode = 1;
    return;
  }

  console.log(`[promo] Mandado a ${para}. ${titulos.length} diapositivas más la portada.`);

  /*
   * **Se dice si la presentación-travel o no, y no solo si falló.**
   *
   * Sin esta línea, un correo con la presentación dentro y otro sin ella dan exactamente
   * la misma salida, y la única forma de saberlo es abrir el correo y contar. Y no es
   * un detalle: mandarla es una decisión editorial y tiene que poder comprobarse desde
   * el log, que es donde se mira cuando algo no cuadra.
   */
  if (conPresentacion) {
    console.log(
      adjuntoPresentacion
        ? "[promo] Con el post de presentación al final, en su propia sección."
        : "[promo] Se pidió la presentación pero no se pudo incluir."
    );
  }
}

// Solo cuando el fichero es el programa que se ejecuta. Importado desde un test —o desde
// otro script— `main` se puede llamar sin que arranque nada solo.
if (require.main === module) {
  main().catch((error) => {
    console.error("[promo] Fallo grave:", error);
    process.exitCode = 1;
  });
}