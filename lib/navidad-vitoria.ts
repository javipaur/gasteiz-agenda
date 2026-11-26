import type { Evento } from "./eventos";
import { recomendados } from "./recomendados";
import { agendaSlug } from "./slug";
import { localDateStr } from "./utils";

/** El texto que no se puede omitir en ninguna pieza: los datos pueden cambiar. */
export const AVISO_CAMBIOS = "Consulta cambios en la web oficial";

/** La marca literal de lo que no tiene fuente para 2026. Nunca se rellena. */
export const POR_CONFIRMAR = "POR CONFIRMAR";

/** Todo lo que aquí se consultó se miró el mismo día. */
const CONSULTADO = "2026-11-26";

export type FuenteNavidad = {
  titulo: string;
  url: string;
  consultado: string;
};

export type EventoNavidad = {
  id: string;
  titulo: string;
  /** `YYYY-MM-DD`, o `POR CONFIRMAR` cuando 2026 no publica fecha. */
  fecha: string;
  fechaFin?: string;
  hora: string;
  horaFin?: string;
  lugar: string;
  precio: "Gratis" | "Donativo" | typeof POR_CONFIRMAR;
  descripcion: string;
  estado: "verificado" | "por-confirmar";
  fuentes: FuenteNavidad[];
  /** Discrepancia entre fuentes oficiales o dato que no se da por bueno. */
  nota?: string;
};

export type DiapositivaNavidad = {
  numero: number;
  evento: string;
  titulo: string;
  texto: string;
  fuente: string;
  aviso: string;
};

function fuente(titulo: string, url: string): FuenteNavidad {
  return { titulo, url, consultado: CONSULTADO };
}

/** Las direcciones están escritas una vez, aquí, y no en las rutas de imagen. */
const URLS = {
  encendidoFicha:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u_73d895a5_1a205d099cd_232f",
  nota2511:
    "https://blogs.vitoria-gasteiz.org/medios/2026/11/25/vitoria-gasteiz-encendera-manana-la-navidad-2026/",
  nota1911: "https://blogs.vitoria-gasteiz.org/medios/2026/11/19/",
  gasteizberri: "https://gasteizberri.com/2026/11/vitoria-enciende-hoy-la-navidad-horarios-noria-y-chocolatada/",
  corteIngles:
    "https://www.centroscomerciales.elcorteingles.es/centroscomerciales/es/eci/centros/centro-comercial-vitoria/eventos/gran-inauguracion-de-la-navidad-2026",
  noria:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u670aa2d5_1a1e824511a__39dd",
  belenInauguracion:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u_73d895a5_1a205d099cd__9ac",
  belen:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u31039bda_1a180f64bef__19e2",
  horra:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u_36329b3a_1a1798f4bd3_64ce",
  pista:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u31039bda_1a19baaac1a__660f",
  lanTaLan:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u670aa2d5_1a1e824511a__69ed",
  mercado:
    "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u670aa2d5_1a1e824511a__712a",
  belenesCarmen: "https://blog.euskaltel.com/belenes-vitoria-gasteiz/",
  noticiasAlava: "https://www.noticiasdealava.eus/",
} as const;

const CALENDARIO = "Calendario municipal de Navidad (calendariosID=566)";

/**
 * Los datos de la campaña. No entran en el registro de 28 fuentes: son una
 * selección editorial verificada a mano, con su fecha de consulta, y no un
 * scraping diario. La agenda que sirve `/api/actividades/*` no se toca.
 *
 * **Dos fuentes oficiales se contradicen en dos horas.** El calendario municipal
 * pone la inauguración del Belén a las 10:00 y el bosque Horra! a las 10:00–21:30
 * desde el 5 de diciembre; la nota de prensa y Noticias de Álava dicen 18:00 y
 * 4–27 de diciembre. Las dos se escriben en `nota` y la que se muestra es la más
 * reciente, sin borrar la otra. Un dato que cambia no se arregla escondiéndolo.
 */
export const NAVIDAD_2026 = {
  titulo: "Navidad 2026 en Vitoria-Gasteiz",
  consultado: CONSULTADO,
  inicio: "2026-11-26",
  fin: "2027-01-06",
  eventos: [
    {
      id: "encendido",
      titulo: "Encendido de las luces de Navidad",
      fecha: "2026-11-26",
      hora: "17:30",
      horaFin: "18:00",
      lugar: "Plaza de España (Plaza Nueva)",
      precio: "Gratis",
      descripcion:
        "Encienden Montes Solidarios y la alcaldesa Maider Etxebarria. Música de Teatro Musical Artea y los coros Izartza y Taupada Txiki, con más de 300 voces.",
      estado: "verificado",
      fuentes: [
        fuente("Ficha municipal del encendido", URLS.encendidoFicha),
        fuente("Nota de prensa municipal, 25-nov-2026", URLS.nota2511),
        fuente("GasteizBerri, 26-nov-2026", URLS.gasteizberri),
      ],
      nota: "El calendario municipal da el fin a las 18:30; la nota de prensa pone las luces a las 18:00.",
    },
    {
      id: "chocolatada",
      titulo: "Chocolatada popular",
      fecha: "2026-11-26",
      hora: POR_CONFIRMAR,
      lugar: "Plaza de España",
      precio: "Gratis",
      descripcion:
        "700 raciones de chocolate caliente después del encendido. GasteizBerri añade bizcocho.",
      estado: "verificado",
      fuentes: [
        fuente("Nota de prensa municipal, 25-nov-2026", URLS.nota2511),
        fuente("GasteizBerri, 26-nov-2026", URLS.gasteizberri),
      ],
      nota: "La hora es «tras el encendido»: no se publica una hora concreta y no se inventa.",
    },
    {
      id: "arbol",
      titulo: "Árbol luminoso de Navidad",
      fecha: "2026-11-26",
      fechaFin: "2027-01-06",
      hora: POR_CONFIRMAR,
      lugar: "Plaza de España (Plaza Nueva)",
      precio: "Gratis",
      descripcion:
        "Novedad de 2026: un árbol luminoso de 13 metros en la Plaza de España.",
      estado: "verificado",
      fuentes: [fuente("Nota de prensa municipal, 25-nov-2026", URLS.nota2511)],
    },
    {
      id: "luces",
      titulo: "Luces de Navidad",
      fecha: "2026-11-26",
      fechaFin: "2027-01-06",
      hora: POR_CONFIRMAR,
      lugar: "Más de 30 calles y plazas de Vitoria-Gasteiz",
      precio: "Gratis",
      descripcion:
        "1.100 elementos luminosos repartidos por más de 30 calles y plazas.",
      estado: "por-confirmar",
      fuentes: [fuente("Nota de prensa municipal, 25-nov-2026", URLS.nota2511)],
      nota: "La zona concreta y el horario diario de apagado no están publicados para 2026.",
    },
    {
      id: "noria",
      titulo: "Noria y carrusel de Navidad",
      fecha: "2026-11-26",
      fechaFin: "2027-01-06",
      hora: "18:00",
      horaFin: "22:00",
      lugar: "Plaza de la Virgen Blanca y plaza del Arca",
      precio: POR_CONFIRMAR,
      descripcion: "La noria mide 30 metros y abre tras el encendido.",
      estado: "por-confirmar",
      fuentes: [fuente(CALENDARIO, URLS.noria), fuente("GasteizBerri, 26-nov-2026", URLS.gasteizberri)],
      nota: "El precio de 2025 no sirve para 2026: no se publica tarifa y se deja por confirmar.",
    },
    {
      id: "corte-ingles",
      titulo: "Gran inauguración de la Navidad en El Corte Inglés",
      fecha: "2026-11-26",
      hora: "19:00",
      horaFin: "20:00",
      lugar: "Plaza de María Sarmiento",
      precio: "Gratis",
      descripcion:
        "Coro infantil de Olabide Ikastola, visita de Olentzero y brindis con cava y turrón.",
      estado: "verificado",
      fuentes: [fuente("El Corte Inglés Vitoria", URLS.corteIngles)],
    },
    {
      id: "belen-monumental",
      titulo: "Belén monumental de La Florida",
      fecha: "2026-12-04",
      fechaFin: "2027-01-06",
      hora: "18:00",
      lugar: "Parque de La Florida",
      precio: "Donativo",
      descripcion:
        "Más de 200 figuras de tamaño natural desde 1962. Inauguración el 4 de diciembre; abierto hasta el 6 de enero de 10:00 a 21:30. La gruta del Misterio abre de 10:00 a 14:30 y de 16:00 a 21:30, con bendición el 24 de diciembre a las 13:00.",
      estado: "verificado",
      fuentes: [
        fuente("Nota de prensa municipal, 19-nov-2026", URLS.nota1911),
        fuente(CALENDARIO, URLS.belen),
        fuente(CALENDARIO + " (inauguración)", URLS.belenInauguracion),
      ],
      nota: "El calendario municipal pone la inauguración el 4-dic a las 10:00; la nota de prensa dice 18:00. Se muestra 18:00 y se conserva la otra hora.",
    },
    {
      id: "belenes-carmen",
      titulo: "Belenes del Carmen",
      fecha: POR_CONFIRMAR,
      hora: POR_CONFIRMAR,
      lugar: "Claustro de la iglesia del Carmen",
      precio: POR_CONFIRMAR,
      descripcion:
        "Los belenes del Carmen vuelven cada Navidad, pero la edición de 2026 no ha publicado fechas ni horarios.",
      estado: "por-confirmar",
      fuentes: [fuente("Blog de belenes de Vitoria-Gasteiz, 19-nov-2026", URLS.belenesCarmen)],
      nota: "Las fechas de 2025 son de otra edición y no se usan como si fueran de 2026.",
    },
    {
      id: "horra",
      titulo: "Horra! El bosque de Olentzero y Mari Domingi",
      fecha: "2026-12-04",
      fechaFin: "2026-12-27",
      hora: "18:00",
      lugar: "Jardines del Palacio de Zulueta",
      precio: "Gratis",
      descripcion: "El bosque de Olentzero y Mari Domingi abre en los Jardines de Zulueta.",
      estado: "verificado",
      fuentes: [
        fuente("Noticias de Álava, 26-nov-2026", URLS.noticiasAlava),
        fuente(CALENDARIO, URLS.horra),
      ],
      nota: "El calendario municipal dice 5–27 dic, 10:00–21:30; Noticias de Álava dice 4–27 dic a las 18:00. Se muestra la nota más reciente y se conserva la otra.",
    },
    {
      id: "pista-hielo",
      titulo: "Pista de hielo de Navidad",
      fecha: "2026-12-11",
      fechaFin: "2027-01-06",
      hora: "10:30",
      horaFin: "22:00",
      lugar: "Kiosko del Parque de La Florida",
      precio: POR_CONFIRMAR,
      descripcion: "Pista de hielo en La Florida, de 10:30 a 14:30 y de 16:00 a 22:00.",
      estado: "por-confirmar",
      fuentes: [
        fuente("Noticias de Álava, 26-nov-2026", URLS.noticiasAlava),
        fuente(CALENDARIO, URLS.pista),
      ],
      nota: "El precio no está publicado. El calendario municipal solo da la franja global 10:30–22:00.",
    },
    {
      id: "lan-ta-lan",
      titulo: "Feria de artesanía Lan ta lan",
      fecha: "2026-12-14",
      fechaFin: "2027-01-05",
      hora: "11:00",
      horaFin: "21:00",
      lugar: "Plaza de la Provincia",
      precio: "Gratis",
      descripcion: "Feria de artesanía de Navidad, con franjas de 11:00 a 14:00 y de 17:00 a 21:00.",
      estado: "verificado",
      fuentes: [fuente(CALENDARIO, URLS.lanTaLan)],
    },
    {
      id: "mercado-agricola",
      titulo: "Mercado agrícola de Navidad",
      fecha: "2026-12-17",
      hora: "09:00",
      horaFin: "16:00",
      lugar: "Plaza de España",
      precio: "Gratis",
      descripcion: "Mercado agrícola de Navidad en la Plaza de España.",
      estado: "verificado",
      fuentes: [fuente("Nota de prensa municipal, 25-nov-2026", URLS.nota2511)],
    },
    {
      id: "mercado-navideno",
      titulo: "Mercado navideño",
      fecha: "2026-12-15",
      fechaFin: "2027-01-06",
      hora: "10:30",
      horaFin: "21:00",
      lugar: "Calle Independencia y plaza Celedones de Oro",
      precio: "Gratis",
      descripcion: "Mercado navideño en la Calle Independencia y la plaza Celedones de Oro.",
      estado: "verificado",
      fuentes: [fuente(CALENDARIO, URLS.mercado)],
    },
  ] satisfies EventoNavidad[],

  /** El orden editorial del carrusel, decidido aquí y no por popularidad. */
  diapositivas: [
    {
      numero: 1,
      evento: "encendido",
      titulo: "La Navidad enciende Vitoria",
      texto: "26 de noviembre · Plaza de España",
      fuente: "Ayuntamiento, 25-nov-2026",
    },
    {
      numero: 2,
      evento: "chocolatada",
      titulo: "Chocolatada gratis",
      texto: "700 raciones después del encendido",
      fuente: "Ayuntamiento y GasteizBerri, 26-nov-2026",
    },
    {
      numero: 3,
      evento: "arbol",
      titulo: "Un árbol de 13 metros",
      texto: "Novedad de 2026 · Plaza de España",
      fuente: "Ayuntamiento, 25-nov-2026",
    },
    {
      numero: 4,
      evento: "corte-ingles",
      titulo: "La Navidad llega al centro",
      texto: "26-nov · 19:00–20:00 · Plaza de María Sarmiento",
      fuente: "El Corte Inglés Vitoria, 26-nov-2026",
    },
    {
      numero: 5,
      evento: "noria",
      titulo: "Noria y carrusel",
      texto: "Virgen Blanca y Arca · 18:00–22:00 · precio por confirmar",
      fuente: "Calendario municipal, 26-nov-2026",
    },
    {
      numero: 6,
      evento: "belen-monumental",
      titulo: "Belén monumental",
      texto: "+200 figuras · desde 1962 · donativo",
      fuente: "Ayuntamiento, 19-nov-2026",
    },
    {
      numero: 7,
      evento: "horra",
      titulo: "Horra! El bosque",
      texto: "Jardines de Zulueta · 4–27 de diciembre",
      fuente: "Noticias de Álava, 26-nov-2026",
    },
    {
      numero: 8,
      evento: "lan-ta-lan",
      titulo: "Mercados de Navidad",
      texto: "Lan ta lan · 14 dic–5 ene · Plaza de la Provincia",
      fuente: "Calendario municipal, 26-nov-2026",
    },
  ].map((d) => ({ ...d, aviso: AVISO_CAMBIOS })) satisfies DiapositivaNavidad[],
} as const;

/** `26 de noviembre`, sin año y sin que el huso mueva el día. */
export function diaCortoNavidad(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return new Date(`${ymd}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Las diez piezas que n8n recoge, en orden. Las urls son relativas al sitio y
 * las escribe este módulo, no la ruta: un `"/api/promo/navidad-vitoria/..."`
 * copiado en la ruta del paquete y en la de la imagen se desincroniza sin que
 * nada falle, y el post sale con un hueco donde debía estar el plan.
 */
export const RUTAS_PROMO_NAVIDAD = {
  portada: "/api/promo/navidad-vitoria/portada?format=jpeg",
  diapositivas: NAVIDAD_2026.diapositivas.map(
    (d) => `/api/promo/navidad-vitoria/diapositiva/${d.numero}?format=jpeg`,
  ),
  reel: "/api/promo/navidad-vitoria/reel",
} as const;

/** El paquete cierra las claves y el orden: portada, ocho planos y vídeo. */
export const PIEZAS_NAVIDAD = [
  {
    archivo: "portada-navidad-2026.jpg",
    tamano: "1080x1350",
    url: RUTAS_PROMO_NAVIDAD.portada,
  },
  ...NAVIDAD_2026.diapositivas.map((d) => ({
    archivo: `diapositiva-${d.numero}-navidad-2026.jpg`,
    tamano: "1080x1350",
    url: RUTAS_PROMO_NAVIDAD.diapositivas[d.numero - 1],
  })),
  {
    archivo: "reel-navidad-2026.mp4",
    tamano: "1080x1920",
    url: RUTAS_PROMO_NAVIDAD.reel,
  },
] as const;

/** `true` entre el 26 de noviembre y Reyes, contados en Europe/Madrid. */
export function navidadEnVentana(ahora: Date): boolean {
  const dia = localDateStr(ahora);
  return dia >= NAVIDAD_2026.inicio && dia <= NAVIDAD_2026.fin;
}

/** Los que no tienen fecha verificada, para enseñarlos como «por confirmar». */
export function porConfirmar(): EventoNavidad[] {
  return NAVIDAD_2026.eventos.filter((e) => e.estado === "por-confirmar");
}

/**
 * Los verificados que caen en la ventana de Navidad, en forma de `Evento` de la
 * agenda. **No se filtra por "activo hoy"**: `recomendados()` necesita lalista
 * completa para puntuar, y el "día a día" filtra después por fecha. Mezclar las
 * dos cosas era el modo de que el 4 de diciembre no existiera hasta que llegara
 * el 4 de diciembre.
 */
export function eventosNavidadComoAgenda(): Evento[] {
  return NAVIDAD_2026.eventos
    .filter((e) => e.fecha !== POR_CONFIRMAR && e.fecha >= NAVIDAD_2026.inicio && e.fecha <= NAVIDAD_2026.fin)
    .map((e) => {
      const enlace = e.fuentes[0]!.url;
      const slug = agendaSlug({ title: e.titulo, date: e.fecha, link: enlace });
      return {
        id: slug,
        slug,
        title: e.titulo,
        date: e.fecha,
        dateEnd: e.fechaFin,
        time: e.hora === POR_CONFIRMAR ? undefined : e.hora,
        location: e.lugar,
        link: enlace,
        officialUrl: enlace,
        description: e.descripcion,
        // No hay foto verificada de cada plan, así que la tarjeta lleva la portada
        // editorial que genera este propio proyecto. Es una imagen nuestra y no
        // se presenta como foto del evento; `recomendados()` exige imagen y sin
        // ella descartaría toda la Navidad.
        image: "/api/promo/navidad-vitoria/portada?format=jpeg",
        category: "Agenda",
        source: "navidad-2026",
        price: e.precio === POR_CONFIRMAR ? undefined : e.precio,
        tags: ["navidad"],
        corrobora: e.fuentes.length,
        provenance: e.nota,
      } satisfies Evento;
    });
}

/**
 * El mismo `recomendados()` que manda en la portada y en `/hoy`. Si la Navidad
 * tuviera su propio criterio, la web y el post dirían dos cosas del mismo día.
 * El tope se abre a la lista entera: aquí no se elige qué publicar, solo el
 * orden en que se enseña.
 */
export function recomendadosNavidad(ahora: Date): Evento[] {
  const eventos = eventosNavidadComoAgenda();
  return recomendados(eventos, {
    desde: NAVIDAD_2026.inicio,
    hasta: NAVIDAD_2026.fin,
    hoy: ahora,
    limite: eventos.length,
  });
}

/** Los que están abiertos el día pedido, ya ordenados por `recomendados()`. */
export function navidadDelDia(ahora: Date): Evento[] {
  const dia = localDateStr(ahora);
  return recomendadosNavidad(ahora).filter(
    (e) => e.date <= dia && (e.dateEnd ?? e.date) >= dia,
  );
}

/** La diapositiva pedida, o `undefined` si el número no existe. */
export function diapositivaNavidad(numero: number): DiapositivaNavidad | undefined {
  return NAVIDAD_2026.diapositivas.find((d) => d.numero === numero);
}
