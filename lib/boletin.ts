import { normalizeCategory } from "./categories";
import { localDateKey } from "./slug";
import { normalizarTituloPromo, ORIGEN_PROMO } from "./promo";
import { desescaparHtml } from "./html-entities";
import { colapsarDiasConsecutivos, ordenarPorInteres } from "./recomendados";
import type { AgendaEvento } from "./agenda";
import type { FarmaciaGuardia } from "./sources/farmacias-guardia";

/**
 * El boletín de WhatsApp: la agenda del día escrita como se lee en un chat.
 *
 * ## Por qué es texto y no imágenes
 *
 * El carrusel es el producto de Instagram y se mira deslizando. El boletín se
 * lee en una notificación, con el móvil en la mano y sin desbloquear nada más:
 * si el primer renglón no dice qué hay hoy, no se abre. Por eso aquí no hay
 * portada, ni marca, ni contador de planes — la marca ya la lleva el nombre del
 * grupo, y lo que se viene a buscar es el plan.
 *
 * ## Lo que no se inventa
 *
 * El formato de referencia —`GASTEIZNEWS`— trae bloques de tiempo, gasolina,
 * sopa y política. Aquí no hay fuente para eso, así que **no se escriben**.
 * Este módulo compone solo lo que el repositorio sabe de verdad: la agenda del
 * agregado y, si se la pasan, las farmacias de guardia. Un boletín corto es
 * mejor que uno con un bloque inventado, que es el mismo modo de fallo que este
 * proyecto lleva corrigiendo desde el principio: una lista vacía que no dice
 * que está vacía.
 *
 * ## Los títulos se corrigen con el dueño del carrusel, no con una copia
 *
 * `normalizarTituloPromo` vive en `lib/promo.ts` y se importa desde aquí. Una
 * segunda copia de "quita el paréntesis con la fecha y corrige Vitoira" sería
 * una regla que diverge el día que se toque una, y las dos seguirían
 * funcionando: el fallo caro, el que nadie ve.
 *
 * **Pero no se pone en mayúsculas.** El carrusel puede permitirse un titular en
 * caja alta porque va debajo de una foto; un chat no. Además es la regla
 * tipográfica del proyecto: las mayúsculas son de las etiquetas, no de los
 * títulos.
 */

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Lo que vale un plan que no dice dónde es. Es la constante de `lib/agenda.ts`. */
const SIN_LUGAR = "Vitoria-Gasteiz";

/** Cuántos planes entran en el boletín. Más de diez no se lee en un chat. */
export const LIMITE_BOLETIN = 10;

/** Cuántas farmacias se listan antes de resumir el resto. */
const LIMITE_FARMACIAS = 8;

/**
 * El emoji de cada categoría, con las dieciséis de `lib/categories.ts`.
 *
 * **Es un mapa y no una regla derivada del nombre**, porque el emoji es una
 * decisión editorial: `Música` es 🎵 y `Festival` 🎪 aunque las dos compartan
 * color. `Otros` tiene el suyo —✨— y no un hueco, para que un evento sin
 * categoría no parezca un error de formato.
 */
export const EMOJI_CATEGORIA: Record<string, string> = {
  Música: "🎵",
  Teatro: "🎭",
  Cine: "🎬",
  Exposiciones: "🖼️",
  Infantil: "🧸",
  Deporte: "🏃",
  Danza: "💃",
  Festival: "🎪",
  Conferencias: "🗣️",
  Fiestas: "🎉",
  Visitas: "🚶",
  Talleres: "🛠️",
  Gastronomía: "🍽️",
  Senderismo: "🥾",
  Mercados: "🧺",
  Otros: "✨",
};

export function emojiDeCategoria(categoria: string): string {
  return EMOJI_CATEGORIA[normalizeCategory(categoria)] ?? EMOJI_CATEGORIA.Otros;
}

/**
 * El titular de un plan: el mismo que el carrusel, sin tocar el resto.
 *
 * `normalizarTituloPromo` solo corrige erratas conocidas y quita paréntesis con
 * fechas que la fuente pega al título. Ni traduce, ni reescribe, ni cambia la
 * caja: lo que se lee en el chat tiene que ser lo mismo que hay en la ficha.
 */
export function titularDeBoletin(evento: AgendaEvento): string {
  return normalizarTituloPromo(evento.title);
}

/**
 * El resumen de un plan, en una línea larga de chat.
 *
 * **240 caracteres y no más**, porque a partir de ahí WhatsApp mete "Leer más"
 * y el bloque deja de leerse de un vistazo. Se corta por frase si hay una
 * entera dentro del margen, y si no por la última palabra: cortar una palabra
 * por la mitad se ve como un error, no como un resumen.
 *
 * Devuelve `null` cuando no hay descripción, y entonces el bloque no lleva
 * línea de resumen. Una línea vacía sí se nota.
 *
 * **Y devuelve `null` por debajo de `MINIMO_RESUMEN`, que no es un capricho de
 * longitud.** El calendario municipal no publica descripción: publica el
 * **destinatario** en ese campo, así que media agenda trae `Otros`, `Adulto` o
 * `Familiar` donde debería haber una frase. Suelto debajo de un titular, eso no
 * se lee como un resumen, se lee como un error de formato. Un texto tan corto no
 * es una descripción: es una etiqueta sin nombre.
 */
const MINIMO_RESUMEN = 50;

export function resumenDeBoletin(
  descripcion: string | undefined | null,
  maximo = 240
): string | null {
  if (!descripcion) return null;

  const plano = desescaparHtml(descripcion.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  if (!plano || plano.length < MINIMO_RESUMEN) return null;
  if (plano.length <= maximo) return plano;

  const recorte = plano.slice(0, maximo);
  const frase = Math.max(
    recorte.lastIndexOf(". "),
    recorte.lastIndexOf("! "),
    recorte.lastIndexOf("? "),
    recorte.lastIndexOf("… ")
  );

  if (frase >= maximo * 0.6) return recorte.slice(0, frase + 1).trimEnd();

  const espacio = recorte.lastIndexOf(" ");
  const base = espacio > 0 ? recorte.slice(0, espacio) : recorte;
  return `${base.trimEnd()}…`;
}

/** `AAAA-MM-DD` a fecha de mediodía. Es el mismo apaño que `diaCivil` de `lib/promo.ts`. */
function fechaCivil(ymd: string): Date | null {
  const d = new Date(`${ymd}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** `miércoles, 4 de noviembre`. Es la línea de cabecera del boletín. */
export function fechaLarga(ymd: string): string {
  const d = fechaCivil(ymd);
  if (!d) return ymd;
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/**
 * La etiqueta de un plan de un solo día: `HOY MIÉRCOLES` o `SÁBADO 7`.
 *
 * **`HOY` solo se escribe si de verdad es hoy**, y para eso `hoy` entra como
 * argumento en vez de leerse del reloj aquí. Una función que mira el reloj no
 * se puede probar sin esperar a que sea el día, y un texto que dice "hoy"
 * cuando se generó ayer es una mentira que nadie ve.
 */
export function etiquetaDeDia(ymd: string, hoy: string): string {
  const d = fechaCivil(ymd);
  if (!d) return ymd;

  const dia = DIAS_SEMANA[d.getDay()].toUpperCase();
  if (ymd === hoy) return `HOY ${dia}`;

  return `${dia} ${d.getDate()}`;
}

/**
 * La etiqueta de un plan que dura varios días: `HASTA EL 8 DE NOVIEMBRE`,
 * `DEL 4 AL 8 DE NOVIEMBRE` o, si empieza y acaba hoy, la de un día.
 *
 * `HASTA EL` se usa cuando la ventana **ya empezó** y sigue abierta: una
 * exposición que lleva un mes abierta no empieza hoy, y decir "del 5 de
 * septiembre" en un boletín del 4 de noviembre no ayuda a nadie.
 */
export function etiquetaDeVentana(desde: string, hasta: string, hoy: string): string {
  if (desde === hasta) return etiquetaDeDia(desde, hoy);

  const inicio = fechaCivil(desde);
  const fin = fechaCivil(hasta);
  if (!inicio || !fin) return `${desde} – ${hasta}`;

  const mesFin = MESES[fin.getMonth()].toUpperCase();

  if (desde <= hoy) return `HASTA EL ${fin.getDate()} DE ${mesFin}`;

  if (inicio.getMonth() === fin.getMonth()) {
    return `DEL ${inicio.getDate()} AL ${fin.getDate()} DE ${mesFin}`;
  }

  const mesInicio = MESES[inicio.getMonth()].toUpperCase();
  return `DEL ${inicio.getDate()} DE ${mesInicio} AL ${fin.getDate()} DE ${mesFin}`;
}

/**
 * La agenda del día, ordenada **por interés y no por hora**.
 *
 * **El orden lo decide `ordenarPorInteres`, que es el mismo que usan la portada,
 * `/hoy` y el carrusel.** Antes se ordenaba aquí por la hora de la fuente, y el
 * resultado era que el chat empezaba por el taller de las 10:00 y la portada por
 * el concierto de las 20:00: dos reglas de orden no fallan, **divergen**, y el
 * día que alguien toca una la otra sigue funcionando y diciendo otra cosa.
 *
 * **El filtro por día se hace con `localDateKey` y no con `slice(0, 10)`.** El
 * `date` de un `AgendaEvento` es un instante ISO completo, y un plan de las
 * 00:30 en Madrid guardado en UTC tiene un día menos en la cadena que el día en
 * que la persona lo vive. Es el mismo criterio que usan la rejilla y el slug.
 *
 * **Lo que ya está en marcha entra en la misma lista, no en un segundo bloque.**
 * Una exposición abierta desde septiembre es un plan de hoy, pero `scoreEvento`
 * le da el bono de cercanía por su fecha de inicio —que ya pasó— y no lo tiene,
 * así que se queda detrás de lo que empieza hoy sin necesidad de una regla
 * aparte. Eso es lo que se quiere: el boletín responde "qué hago hoy".
 */
export function seleccionarDelDia(
  eventos: AgendaEvento[],
  fecha: string,
  limite = LIMITE_BOLETIN
): AgendaEvento[] {
  const deHoy: AgendaEvento[] = [];
  const enMarcha: AgendaEvento[] = [];

  for (const evento of eventos) {
    const inicio = localDateKey(evento.date);

    if (inicio === fecha) {
      deHoy.push(evento);
      continue;
    }

    if (evento.dateEnd && inicio < fecha && localDateKey(evento.dateEnd) >= fecha) {
      enMarcha.push(evento);
    }
  }

  // El reloj es el día que se está pidiendo, no `Date.now()`: el bono de cercanía
  // de `scoreEvento` se mide contra esta fecha, así que el mismo día da el mismo
  // boletín a las 8:00 y a las 23:00. Una fecha ilegible deja `Invalid Date` y
  // `scoreEvento` simplemente no suma cercanía; no revienta.
  const hoy = new Date(`${fecha}T00:00:00`);

  const ordenados = ordenarPorInteres([...deHoy, ...enMarcha], hoy);

  // El mismo plan no se lista dos veces, y aquí la identidad es el slug. Hace
  // falta aunque `colapsarDiasConsecutivos` venga después: ese funde **títulos**
  // que coinciden y solo por encima de 20 caracteres, así que un título corto
  // repetido se le escapa.
  const vistos = new Set<string>();
  const unicos: AgendaEvento[] = [];
  for (const evento of ordenados) {
    if (vistos.has(evento.slug)) continue;
    vistos.add(evento.slug);
    unicos.push(evento);
  }

  // El fundido va **antes** del tope: fundir después de cortar dejaría fuera un
  // plan que sí cabía. `colapsarDiasConsecutivos` no reordena, así que de cada
  // grupo de títulos se queda el primero, que es el mejor puntuado.
  const seleccion = colapsarDiasConsecutivos(unicos).slice(0, limite);

  return conHuecoFamiliar(seleccion, unicos, limite);
}

/**
 * Si un plan es para familias. Es la misma regla que `lib/kids.ts`: la categoría
 * o la etiqueta, porque hay fuentes que marcan el público con `tags` y dejan la
 * categoría en `Otros`.
 */
function esFamiliar(evento: AgendaEvento): boolean {
  return evento.category === "Infantil" || evento.tags?.includes("infantil") === true;
}

/**
 * El hueco de las familias, y por qué es un hueco y no un peso.
 *
 * **`Infantil` ya pesa 26 en `lib/popularity.ts`, por encima de Teatro, y no
 * basta.** Medido el 4 de noviembre de 2026: el día tenía **un** plan infantil
 * —un cuentacuentos publicado por dos fuentes— y quedaba en el puesto 20 de 2010
 * eventos, así que con el peso solo el boletín salía sin nada para familias. Un
 * peso ordena lo que hay; no crea lo que no hay, y el problema no era el orden.
 *
 * Es un hueco porque un plan infantil compite en la misma lista contra toda la
 * agenda del día y pierde casi siempre: los hay una vez por semana, y los otros
 * cientos no. Si en el top no hay ninguno, se cambia **el último** por el mejor
 * plan familiar del día. El último y no el primero: el hueco es para que las
 * familias tengan algo, no para decir que su plan es el mejor del día.
 *
 * Si no hay ningún plan familiar, la lista se queda como está. Inventar uno, o
 * dejar el hueco vacío, sería peor que no tener el hueco.
 */
function conHuecoFamiliar(
  seleccion: AgendaEvento[],
  candidatos: readonly AgendaEvento[],
  limite: number
): AgendaEvento[] {
  if (limite < 1 || seleccion.length === 0) return seleccion;
  if (seleccion.some(esFamiliar)) return seleccion;

  const yaElegidos = new Set(seleccion.map((e) => e.slug));
  const familiar = candidatos.find((e) => esFamiliar(e) && !yaElegidos.has(e.slug));
  if (!familiar) return seleccion;

  return [...seleccion.slice(0, -1), familiar];
}

/** El enlace que se comparte: la ficha de aquí, no la web de origen. */
export function enlaceDeBoletin(evento: AgendaEvento): string {
  return `${ORIGEN_PROMO}/evento/${evento.slug}`;
}

/**
 * Un plan, con solo las líneas que existen.
 *
 * **`📍 Vitoria-Gasteiz` no se escribe.** Es el valor que el agregador pone
 * cuando la fuente no dice dónde es, y en un boletín de Vitoria repetirlo diez
 * veces no informa de nada: es ruido que empuja el resto del bloque hacia
 * abajo.
 *
 * **Ni se repite el titular.** El mercado municipal se llama como el sitio
 * donde está, y `Mercado de Lakua-Arriaga` dos veces seguidas con un pin en
 * medio no dice dónde es: dice que la fuente rellenó los dos campos con lo
 * mismo.
 *
 * **`🎟️` sale solo si la fuente publica precio.** No hay "consultar" por
 * defecto: un precio inventado es peor que un precio ausente, y el enlace está
 * justo debajo para ir a mirarlo.
 */
export function bloqueDeEvento(evento: AgendaEvento, opciones: { hoy: string }): string {
  const lineas: string[] = [`${emojiDeCategoria(evento.category)} ${titularDeBoletin(evento)}`];

  const resumen = resumenDeBoletin(evento.description);
  if (resumen) lineas.push(resumen);

  const inicio = localDateKey(evento.date);
  const fin = evento.dateEnd ? localDateKey(evento.dateEnd) : null;
  const dia = fin && fin !== inicio
    ? etiquetaDeVentana(inicio, fin, opciones.hoy)
    : etiquetaDeDia(inicio, opciones.hoy);

  const hora = (evento.time || "").trim();
  lineas.push(`🗓️ ${hora ? `${dia} · ${hora}` : dia}`);

  const lugar = (evento.location || "").trim();
  if (lugar && lugar !== SIN_LUGAR && lugar.toLowerCase() !== titularDeBoletin(evento).toLowerCase()) {
    lineas.push(`📍 ${lugar}`);
  }

  const precio = (evento.price || "").trim();
  if (precio) lineas.push(`🎟️ ${precio}`);

  lineas.push(`👉 ${enlaceDeBoletin(evento)}`);

  return lineas.join("\n");
}

/**
 * Las farmacias de guardia, si las hay.
 *
 * Es el único bloque que no viene de la agenda y el único que se puede quedar
 * fuera sin que el boletín mienta: si el Colegio no responde, el script no
 * llama a esta función con una lista vacía, llama sin lista. Un "no hay
 * farmacias de guardia" cuando lo que pasa es que no se pudo preguntar es
 * exactamente el fallo que `scrapeFarmaciasGuardia` documenta que no comete.
 */
export function bloqueDeFarmacias(farmacias: FarmaciaGuardia[]): string | null {
  if (farmacias.length === 0) return null;

  const lineas = ["💊 Farmacias de guardia"];

  for (const farmacia of farmacias.slice(0, LIMITE_FARMACIAS)) {
    const partes = [farmacia.name];
    if (farmacia.horarios) partes.push(farmacia.horarios);
    const donde = farmacia.shortAddress || farmacia.address;
    if (donde) partes.push(donde);

    lineas.push(`· ${partes.join(" — ")}`);
  }

  const resto = farmacias.length - LIMITE_FARMACIAS;
  if (resto > 0) lineas.push(`· y ${resto} más`);

  return lineas.join("\n");
}

export type EntradaBoletin = {
  /** `AAAA-MM-DD` del día que cubre el boletín. */
  fecha: string;
  /** Los eventos próximos del agregado. La selección la hace este módulo. */
  eventos: AgendaEvento[];
  /** El día desde el que se dice "hoy". Por defecto, `fecha`. */
  hoy?: string;
  /** Las guardias del día, si se pudieron leer. */
  farmacias?: FarmaciaGuardia[];
  limite?: number;
};

export type Boletin = {
  fecha: string;
  eventos: AgendaEvento[];
  texto: string;
};

/**
 * El boletín entero, y la selección va dentro para que no haya dos criterios.
 *
 * Quien llama recibe también los eventos elegidos porque el script necesita
 * saber **cuántos** hay: con cero no se manda nada, y esa decisión no puede
 * tomarla un texto que ya se ha construido.
 */
export function textoDelBoletin(entrada: EntradaBoletin): Boletin {
  const hoy = entrada.hoy ?? entrada.fecha;
  const eventos = seleccionarDelDia(
    entrada.eventos,
    entrada.fecha,
    entrada.limite ?? LIMITE_BOLETIN
  );

  const bloques: string[] = [
    "☀️ ¡Buenos días, Gasteiz! Egun on!",
    `ESTO ES GASTEIZNEWS, ${fechaLarga(entrada.fecha)}`,
  ];

  for (const evento of eventos) {
    bloques.push(bloqueDeEvento(evento, { hoy }));
  }

  const farmacias = entrada.farmacias ? bloqueDeFarmacias(entrada.farmacias) : null;
  if (farmacias) bloques.push(farmacias);

  bloques.push(`👉 Toda la agenda, en ${ORIGEN_PROMO}`);

  return { fecha: entrada.fecha, eventos, texto: bloques.join("\n\n") };
}
