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
 * Y lo que sí lee son los eventos del agregador, no de un `fetch` a `/api/*`, por el
 * mismo motivo que `scripts/send-newsletter.ts`: un script del repo no debería depender
 * de que su propio despliegue le deje pasar.
 */

/** Los ficheros van aquí salvo que `PROMO_DESTINO` diga otra cosa. */
const DESTINO_POR_DEFECTO = "data/promo";

export async function main() {
  console.log("[promo] Calculando la ventana de hoy...");

  // `AsyncLocalStorage` no es global en Node 24 y `lib/agenda.ts` →
  // `lib/axiom/server.ts` → `@axiomhq/nextjs` lo lee de `globalThis` al importarse.
  // Dentro de Next ya está resuelto; en un script suelto con `tsx` no, y el fallo es un
  // `TypeError` que no dice qué lo ha provocado. Es el mismo apaño que hace
  // `jest.setup.ts` y que ya hace `scripts/send-newsletter.ts`.
  if (typeof (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage === "undefined") {
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
  const { getAgendaEventos, getAgendaSalud } = await import("@/lib/agenda");

  const salud = await getAgendaSalud();
  // `completa` **no es un campo de `AgendaMeta`**: es el `true` que `/api/v1/salud` se
  // calcula para el JSON. Aquí se deriva de los dos campos que sí existen, y se mira
  // los dos porque no son lo mismo: una fuente puede responder con lista vacía —eso es
  // `sourcesOk`— y aun así no haber consultado lo que le tocaba.
  const degradado = salud.sourcesFallidas.length > 0 || salud.sourcesOk < salud.sourcesTotal;

  if (degradado) {
    console.error(
      `[promo] El agregado está degradado (${salud.sourcesOk}/${salud.sourcesTotal}).`,
      `Fuentes caídas: ${salud.sourcesFallidas.map((s) => s.id).join(", ")}`
    );
    console.error(
      "[promo] No se manda nada. Con el agregado a medias, el paquete sería medio día."
    );
    process.exitCode = 1;
    return;
  }

  const { recomendados } = await import("@/lib/recomendados");
  const { MAX_DIAPOSITIVAS } = await import("@/lib/promo");

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde, hasta, limite: MAX_DIAPOSITIVAS });
  const { paqueteDePromo } = await import("@/lib/promo");
  const paquete = paqueteDePromo(lista, { desde, hasta });

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
  if (lista.length < 3) {
    console.warn(`[promo] Solo ${lista.length} planes en la ventana. No se manda correo.`);
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
  const titulos = lista.map((e) => e.title);

  const res = await sendMail({
    to: para,
    subject: asuntoDelCorreo(desde, hasta, lista.length),
    html: htmlDelCorreo(paquete, titulos),
    text: `${paquete.texto}\n\n${paquete.enlace}`,
    attachments: adjuntosDe(imagenes),
  });

  if (!res.ok) {
    console.error(`[promo] No se pudo mandar el correo: ${res.error}`);
    console.error("[promo] El paquete sigue en disco.");
    process.exitCode = 1;
    return;
  }

  console.log(`[promo] Mandado a ${para}. ${lista.length} diapositivas más la portada.`);
}

// Solo cuando el fichero es el programa que se ejecuta. Importado desde un test —o desde
// otro script— `main` se puede llamar sin que arranque nada solo.
if (require.main === module) {
  main().catch((error) => {
    console.error("[promo] Fallo grave:", error);
    process.exitCode = 1;
  });
}