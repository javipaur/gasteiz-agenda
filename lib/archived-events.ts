import type { AgendaEvento } from "./agenda";

export type RecoveredEventState =
  | "recuperado" // info contrastada, servible
  | "archivado" // conocido pero sin ficha completa, servible informativamente
  | "retirado"; // retirado confirmado; se sirve info conocida si existe

export type RecoveredAgendaEvento = AgendaEvento & {
  /** Slugs/URLs antiguas que deben resolver a este evento. */
  aliases?: readonly string[];
  /** Estado operativo del registro recuperado. */
  recoveredState?: RecoveredEventState;
  /** Procedencia breve para control/auditoría interna. */
  provenance?: string;
};

/**
 * Eventos recuperados/archivados para URLs ya indexadas o compartidas y para
 * información contrastada que la ingesta automática no está sirviendo.
 *
 * Control inmediato: evita 404 ciegos en URLs conocidas y permite mostrar
 * contenido recuperable sin inventar datos. Cada entrada debe proceder de una
 * fuente contrastada (ficha oficial, programa, captura, logs/cache).
 *
 * No sustituye la solución estructural completa en base de datos (identidad
 * externa estable por fuente, historial de importaciones, 410 automático para
 * retirados confirmados sin información), pero centraliza la recuperación,
 * alias conocidos y estados para integrarlos en listados y detalle.
 */
const BASE_DESC_GFF =
  "Sesión de Gazte Film Fest 2026 en Vitoria-Gasteiz. Consulta el programa y la información actualizada en la web oficial del festival.";

/** Programa contrastado desde https://www.gaztefilmfest.com/gaztefilmfest2026 */
const GAZTE_FILM_FEST_2026_SESIONES: readonly RecoveredAgendaEvento[] = [
  { id: "gazte-film-fest-2026-inauguracion-concierto-visual-2026-11-19-s3191o", slug: "gazte-film-fest-2026-inauguracion-concierto-visual-2026-11-19-s3191o", title: "Gazte Film Fest 2026: Inauguración - Concierto visual", date: "2026-11-19T19:00:00+01:00", time: "19:00", location: "Conservatorio Jesús Guridi, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/inaugurazioa", description: "Inauguración de Gazte Film Fest 2026 con concierto visual. Consulta la información actualizada en la web oficial.", category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "al-son-de-la-vida-canta-la-tierra-2026-11-20-7zj8ma", slug: "al-son-de-la-vida-canta-la-tierra-2026-11-20-7zj8ma", title: "Al son de la vida, canta la tierra", date: "2026-11-20T17:30:00+01:00", time: "17:30", location: "Sala Baratza, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/al-son-de-la-vida-canta-la-tierra", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "mary-anning-2026-11-20-miw9y4", slug: "mary-anning-2026-11-20-miw9y4", title: "Mary Anning", date: "2026-11-20T19:00:00+01:00", time: "19:00", location: "Sala Baratza, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/mary-anning", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "papaya-2026-11-21-3hw2ug", slug: "papaya-2026-11-21-3hw2ug", title: "Papaya", date: "2026-11-21T11:00:00+01:00", time: "11:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/papaya", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "bestiario-en-lengua-2026-11-21-2cn9br", slug: "bestiario-en-lengua-2026-11-21-2cn9br", title: "Bestiario en lengua", date: "2026-11-21T13:00:00+01:00", time: "13:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/bestiario-en-lengua", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "oihanean-jaioa-2026-11-21-ea7oh", slug: "oihanean-jaioa-2026-11-21-ea7oh", title: "Oihanean jaioa", date: "2026-11-21T17:00:00+01:00", time: "17:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/oihanean-jaioa", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "unibertsoaren-atlasa-2026-11-21-ly5ahv", slug: "unibertsoaren-atlasa-2026-11-21-ly5ahv", title: "Unibertsoaren atlasa", date: "2026-11-21T19:00:00+01:00", time: "19:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/unibertsoaren-atlasa", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "kona-una-gata-valiente-2026-11-22-vi95k", slug: "kona-una-gata-valiente-2026-11-22-vi95k", title: "Kona, una gata valiente", date: "2026-11-22T11:00:00+01:00", time: "11:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/kona-una-gata-valiente", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "del-espacio-exterior-al-mundo-interior-2026-11-22-wr8539", slug: "del-espacio-exterior-al-mundo-interior-2026-11-22-wr8539", title: "Del espacio exterior al mundo interior", date: "2026-11-22T11:00:00+01:00", time: "11:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/del-espacio-exterior-al-mundo-interior", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "un-llamado-de-la-naturaleza-2026-11-22-phcrau", slug: "un-llamado-de-la-naturaleza-2026-11-22-phcrau", title: "Un llamado de la naturaleza", date: "2026-11-22T13:00:00+01:00", time: "13:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/un-llamado-de-la-naturaleza", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "el-viaje-de-la-vida-2026-11-22-9wq7qi", slug: "el-viaje-de-la-vida-2026-11-22-9wq7qi", title: "El viaje de la vida", date: "2026-11-22T13:00:00+01:00", time: "13:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/el-viaje-de-la-vida", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "jauregiko-bizitza-2026-11-22-r312o", slug: "jauregiko-bizitza-2026-11-22-r312o", title: "Jauregiko bizitza", date: "2026-11-22T17:00:00+01:00", time: "17:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/jauregiko-bizitza", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "le-corset-2026-11-22-msjnvc", slug: "le-corset-2026-11-22-msjnvc", title: "Le Corset", date: "2026-11-22T19:00:00+01:00", time: "19:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/le-corset", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "taller-stop-motion-2026-11-22-ctsm75", slug: "taller-stop-motion-2026-11-22-ctsm75", title: "Taller Stop Motion", date: "2026-11-22T10:00:00+01:00", time: "10:00", location: "Fundación Vital Fundazioa Kulturunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/stopmotion", description: "Taller de stop motion dentro de Gazte Film Fest 2026. Consulta la información y reservas en la web oficial.", category: "Talleres", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "el-viaje-de-la-vida-2026-11-27-opteny", slug: "el-viaje-de-la-vida-2026-11-27-opteny", title: "El viaje de la vida", date: "2026-11-27T17:30:00+01:00", time: "17:30", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/el-viaje-de-la-vida", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "un-llamado-de-la-naturaleza-2026-11-27-waqkf3", slug: "un-llamado-de-la-naturaleza-2026-11-27-waqkf3", title: "Un llamado de la naturaleza", date: "2026-11-27T19:00:00+01:00", time: "19:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/un-llamado-de-la-naturaleza", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "lake-tahoe-2026-11-27-98kxgo", slug: "lake-tahoe-2026-11-27-98kxgo", title: "Lake Tahoe", date: "2026-11-27T17:30:00+01:00", time: "17:30", location: "Sala Baratza, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/lake-tahoe", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "mumbo-jumbo-2026-11-28-4d5wwi", slug: "mumbo-jumbo-2026-11-28-4d5wwi", title: "Mumbo Jumbo", date: "2026-11-28T11:00:00+01:00", time: "11:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/mumbo-jumbo", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "kona-una-gata-valiente-2026-11-28-p5ty1q", slug: "kona-una-gata-valiente-2026-11-28-p5ty1q", title: "Kona, una gata valiente", date: "2026-11-28T11:00:00+01:00", time: "11:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/kona-una-gata-valiente", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "del-espacio-exterior-al-mundo-interior-2026-11-28-nrlku9", slug: "del-espacio-exterior-al-mundo-interior-2026-11-28-nrlku9", title: "Del espacio exterior al mundo interior", date: "2026-11-28T11:00:00+01:00", time: "11:00", location: "Sala Baratza, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/del-espacio-exterior-al-mundo-interior", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "bestiario-en-lengua-2026-11-28-494cds", slug: "bestiario-en-lengua-2026-11-28-494cds", title: "Bestiario en lengua", date: "2026-11-28T13:00:00+01:00", time: "13:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/bestiario-en-lengua", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "moscas-2026-11-28-yidm6t", slug: "moscas-2026-11-28-yidm6t", title: "Moscas", date: "2026-11-28T13:00:00+01:00", time: "13:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/moscas", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "al-son-de-la-vida-canta-la-tierra-2026-11-28-hm0y73", slug: "al-son-de-la-vida-canta-la-tierra-2026-11-28-hm0y73", title: "Al son de la vida, canta la tierra", date: "2026-11-28T13:00:00+01:00", time: "13:00", location: "Sala Baratza, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/al-son-de-la-vida-canta-la-tierra", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "le-corset-2026-11-28-v4zfl0", slug: "le-corset-2026-11-28-v4zfl0", title: "Le Corset", date: "2026-11-28T17:00:00+01:00", time: "17:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/le-corset", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "unibertsoaren-atlasa-2026-11-28-ynxoco", slug: "unibertsoaren-atlasa-2026-11-28-ynxoco", title: "Unibertsoaren atlasa", date: "2026-11-28T17:00:00+01:00", time: "17:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/unibertsoaren-atlasa", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "jauregiko-bizitza-2026-11-28-b17u6g", slug: "jauregiko-bizitza-2026-11-28-b17u6g", title: "Jauregiko bizitza", date: "2026-11-28T19:00:00+01:00", time: "19:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/jauregiko-bizitza", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "temporada-de-patos-2026-11-28-rmh3ml", slug: "temporada-de-patos-2026-11-28-rmh3ml", title: "Temporada de patos", date: "2026-11-28T19:00:00+01:00", time: "19:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/temporada-de-patos", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "oihanean-jaioa-2026-11-29-qrl89p", slug: "oihanean-jaioa-2026-11-29-qrl89p", title: "Oihanean jaioa", date: "2026-11-29T11:00:00+01:00", time: "11:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/oihanean-jaioa", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "papaya-2026-11-29-2iriw0", slug: "papaya-2026-11-29-2iriw0", title: "Papaya", date: "2026-11-29T11:00:00+01:00", time: "11:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/papaya", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "cucinema-2026-11-29-467mcw", slug: "cucinema-2026-11-29-467mcw", title: "Cucinema", date: "2026-11-29T10:00:00+01:00", time: "10:00", location: "Sala Baratza, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/gaztefilmfest2026", description: "Actividad Cucinema de Gazte Film Fest 2026. Consulta la información y horarios en la web oficial.", category: "Talleres", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "cine-hecho-por-nines-2026-11-29-jfpbnr", slug: "cine-hecho-por-nines-2026-11-29-jfpbnr", title: "Cine hecho por niñes", date: "2026-11-29T13:00:00+01:00", time: "13:00", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/filmlaburrak/cine-hecho-por-nines", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "txakun-txakur-2026-11-29-oidnkm", slug: "txakun-txakur-2026-11-29-oidnkm", title: "Txakun txakür", date: "2026-11-29T17:00:00+01:00", time: "17:00", location: "IAK - Izaskun Arrue Kulturgunea, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/programazioa/txakun-txakur", description: BASE_DESC_GFF, category: "Cine", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
  { id: "gazte-film-fest-2026-clausura-y-entrega-de-premios-2026-11-29-a0wn9l", slug: "gazte-film-fest-2026-clausura-y-entrega-de-premios-2026-11-29-a0wn9l", title: "Gazte Film Fest 2026: Clausura y entrega de premios", date: "2026-11-29T19:30:00+01:00", time: "19:30", location: "Arkabia, Vitoria-Gasteiz", link: "https://www.gaztefilmfest.com/gaztefilmfest2026", description: "Clausura de Gazte Film Fest 2026 y entrega de premios. Consulta la información actualizada en la web oficial.", category: "Festival", source: "gaztefilmfest", kind: "agenda", tags: ["infantil"] },
];

export const ARCHIVED_EVENTS: readonly RecoveredAgendaEvento[] = [
  {
    // Slug/id preservados exactamente: son la URL indexada/compartida.
    id: "gazte-film-fest-2026-festival-de-cine-infantil-2026-11-19-ije7tx",
    slug: "gazte-film-fest-2026-festival-de-cine-infantil-2026-11-19-ije7tx",
    title: "Gazte Film Fest 2026 - Festival de Cine Infantil",
    date: "2026-11-19T00:00:00.000Z",
    dateEnd: "2026-11-29T00:00:00.000Z",
    time: "11:00",
    location: "Vitoria-Gasteiz",
    link: "https://www.kulturklik.euskadi.eus/evento/2026/11/19/gazte-film-fest-2026-festival-de-cine-infantil/webkklik00-detalle/es/",
    officialUrl: "https://www.gaztefilmfest.com/",
    image:
      "https://www.kulturklik.euskadi.eus/evento/2026/11/19/gazte-film-fest-2026-festival-de-cine-infantil/webkklik00-detalle/es/images/3.jpg",
    description:
      "GazteFilm Fest celebra su novena edición del 19 al 29 de noviembre de 2026 en Vitoria-Gasteiz, con México como país invitado. Festival de cine para la infancia y la juventud con proyecciones, talleres y actividades en sedes como Arkabia, Izaskun Arrue Kulturgunea, Sala Baratza, el Conservatorio Jesús Guridi y centros cívicos. Incluye sección oficial, programación dedicada a México, jurado infantil, doblaje al euskera y talleres participativos. Consulta el programa y la información actualizada en la fuente.",
    category: "Festival",
    source: "euskadi",
    kind: "agenda",
    tags: ["infantil"],
    recoveredState: "recuperado",
    provenance:
      "Recuperado desde Kulturklik (ficha y programa público) tras desaparición del feed automático; slug preservado por URL indexada.",
  },
  ...GAZTE_FILM_FEST_2026_SESIONES.map((ev) => ({
    ...ev,
    recoveredState: "recuperado" as const,
    provenance: "Programa contrastado desde https://www.gaztefilmfest.com/gaztefilmfest2026",
  })),
];

const bySlug = new Map<string, RecoveredAgendaEvento>();
for (const ev of ARCHIVED_EVENTS) {
  bySlug.set(ev.slug, ev);
  for (const alias of ev.aliases ?? []) bySlug.set(alias, ev);
}

/** Eventos recuperados que deben integrarse en la agenda/listados. */
export function getRecoveredAgendaEvents(): readonly AgendaEvento[] {
  return ARCHIVED_EVENTS;
}

export function getArchivedEventoBySlug(
  slug: string
): RecoveredAgendaEvento | undefined {
  return bySlug.get(slug);
}

export function isRecoveredSlug(slug: string): boolean {
  return bySlug.has(slug);
}

export const GAZTE_FILM_FEST_2026_FESTIVAL_SLUG =
  "gazte-film-fest-2026-festival-de-cine-infantil-2026-11-19-ije7tx";

export function getGazteFilmFest2026Programa(): {
  festival: RecoveredAgendaEvento;
  sesiones: readonly RecoveredAgendaEvento[];
} {
  const festival = bySlug.get(GAZTE_FILM_FEST_2026_FESTIVAL_SLUG);
  if (!festival) {
    throw new Error("Gazte Film Fest 2026 no encontrado en eventos recuperados");
  }
  return { festival, sesiones: GAZTE_FILM_FEST_2026_SESIONES };
}
