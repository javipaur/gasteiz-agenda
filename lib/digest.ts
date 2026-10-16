import { getAgendaEventos, getAgendaSalud } from "./agenda";
import { FUENTES_TOLERABLES } from "./source-data";
import type { PushPayload } from "./push";

/**
 * El digest del día, o `null` si **no se puede afirmar nada con honestidad**.
 *
 * ## Por qué existe el `null`
 *
 * Antes, un agregado vacío producía un digest perfectamente assertivo: _"Hoy no hay
 * eventos programados en Vitoria-Gasteiz"_. Ese mensaje es una afirmación sobre el
 * mundo, y hay dos maneras muy distintas de que la agenda venga vacía:
 *
 * - **No hay eventos.** Un martes de enero, y el digest es correcto y útil.
 * - **Las fuentes están caídas.** Y entonces se le dice a toda la lista de
 *   suscriptores que el martes no hay nada, cuando en realidad no lo sabemos.
 *
 * Lo segundo es el modo de fallo que este repo lleva corrigiendo desde el principio:
 * una fuente caída y una fuente vacía se parecían, y se acababa contando la segunda
 * como la primera. Solo que aquí el que se lo cree es **el usuario**, y no un panel:
 * se pierde la agenda del día y nadie tiene por qué sospechar que la web sigue de
 * pie con la mitad de las fuentes.
 *
 * ## Por qué devuelve `null` en vez de un digest con matiz
 *
 * Porque `markDigestSent()` quema el día. Un digest con matiz que sale es un digest
 * que se envía a todos y que no se reintenta. Devolver `null` deja la decisión donde
 * tiene que estar —en `lib/scheduler.ts`, que no marca el día y reintenta en el
 * siguiente tick—, y hace que el silencio sea un logs explícito y no un mensaje
 * erróneo.
 *
 * ## Qué no bloquea
 *
 * Solo bloquea lo que el correo de Instagram ya considera no tolerable: una fuente
 * **no tolerable** caída, o menos de la mitad del agregado. Perder `rula` —la única
 * tolerable, porque es la única con credencial— **no** impide el digest, porque
 * entonces volveríamos al problema de siempre: una dependencia de un tercero
 * haciendo que el digest no saliera nunca.
 *
 * Con lo que queda (`caidas` tolerables) **sí** sale, y con los eventos que hay: un
 * digest corto es mejor que un digest mentiroso.
 */
export async function buildDailyDigest(): Promise<PushPayload | null> {
  const eventos = await getAgendaEventos({ days: 1 });

  if (eventos.length === 0) {
    if (await agregadoNoEsConfiable()) return null;

    return {
      title: "Gasteiz Click",
      body: "Hoy no hay eventos programados en Vitoria-Gasteiz. Buen día para pasear por el Anillo Verde.",
      url: "/",
    };
  }

  const titulos = eventos
    .slice(0, 3)
    .map((ev) => ev.title)
    .join(" · ");

  return {
    title:
      eventos.length === 1
        ? "1 evento hoy en Vitoria-Gasteiz"
        : `${eventos.length} eventos hoy en Vitoria-Gasteiz`,
    body: titulos + (eventos.length > 3 ? " y más…" : ""),
    url: `/evento/${eventos[0].slug}`,
  };
}

/**
 * Si el vacío del agregado **puede** ser una caída en vez de un día sin planes.
 *
 * Misma regla que la puerta de `scripts/enviar-promo.ts`, y a propósito idéntica: la
 * pregunta "si cae esto, ¿paramos o publicamos a medias?" tiene que tener la misma
 * respuesta en los dos envíos, o uno de los dos miente. Por eso la lista de tolerables
 * está en `lib/source-data.ts` y no copiada en cada sitio.
 *
 * Y una cosa que no se puede hacer aquí, para que conste: esta función **no** puede
 * distinguir "respondió con lista vacía" de "está caída". `getAgendaSalud` cuenta
 * como sana a la fuente que cumplió con `[]` —AGENTS.md lo dice en "Las dos mitades
 * del rojo"—. Por eso solo se llama cuando el agregado **ya** viene vacío: es un
 * filtro sobre un síntoma, no un diagnóstico. Ver el comentario de `enviar-promo.ts`,
 * donde está escrito por qué arreglarlo necesita tocar `/api/v1/salud`, que es
 * contrato con un cliente de fuera.
 */
async function agregadoNoEsConfiable(): Promise<boolean> {
  const salud = await getAgendaSalud();
  const caidas = salud.sourcesFallidas.map((s) => s.id);
  const noTolerables = caidas.filter((id) => !FUENTES_TOLERABLES.has(id));

  const noConfiable =
    noTolerables.length > 0 || salud.sourcesOk < salud.sourcesTotal / 2;

  if (noConfiable) {
    console.error(
      `[push] el agregado vino vacío con ${salud.sourcesOk}/${salud.sourcesTotal} fuentes: ` +
        `caídas ${caidas.join(", ") || "sin registrar"}. No se manda digest, porque decir ` +
        `"no hay eventos" cuando no lo sabemos es peor que no decir nada.`
    );
  }

  return noConfiable;
}