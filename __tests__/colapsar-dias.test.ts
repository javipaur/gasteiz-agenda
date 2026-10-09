import { colapsarDiasConsecutivos } from "@/lib/recomendados";
import type { Evento } from "@/lib/eventos";

/**
 * Un evento que pasa el sábado y el domingo es **un** plan, no dos.
 *
 * **Por qué hace falta, medido.** El paquete del finde del 10 y 11 de octubre de 2026
 * traía `visita-guiada-palacio-de-villa-suso` **dos veces**: sábado y domingo, con la
 * misma foto y la misma línea de texto. Dos diapositivas idénticas en un post publicado
 * parecen un error, y repiten el mismo dato en el pie.
 *
 * **Y por qué va aquí y no en el paquete.** El post, `/hoy` y el riel de la home usan el
 * mismo selector. Si la deduplicación viviera en el paquete, el post enseñaría un
 * evento y la página dos — que es justo lo que corrigió el commit `3da8610`, cuando el
 * post ponía 9 planes y la página 8.
 */
function ev(over: Partial<Evento> & { title: string; date: string }): Evento {
  return {
    id: over.date,
    slug: `slug-${over.date}`,
    location: "Palacio de Villa Suso",
    link: "/evento/x",
    category: "Visitas",
    source: "municipal",
    image: "https://www.vitoria-gasteiz.org/x.jpg",
    ...over,
  } as Evento;
}

describe("colapsarDiasConsecutivos", () => {
  it("funde el mismo título en dos días y guarda los dos", () => {
    const lista = [
      ev({ title: "Visita guiada: Palacio de Villa Suso", date: "2026-10-10T11:00:00" }),
      ev({ title: "Visita guiada: Palacio de Villa Suso", date: "2026-10-11T11:00:00" }),
    ];

    const salida = colapsarDiasConsecutivos(lista);

    expect(salida).toHaveLength(1);
    expect(salida[0].dias).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("funde también si el título solo cambia en acentos, mayúsculas o signos", () => {
    // Los títulos vienen de 28 sitios sin esquema. "Visita guiada - Palacio de Villa
    // Suso" y "Visita guiada: Palacio de Villa Suso" son la misma visita, y si no se
    // normalizan aparecen dos diapositivas con la misma foto.
    const lista = [
      ev({ title: "VISITA GUIADA: Palacio de Villa Suso", date: "2026-10-10T11:00:00" }),
      ev({ title: "Visita guiada – Palacio de Villa Suso", date: "2026-10-11T11:00:00" }),
    ];

    expect(colapsarDiasConsecutivos(lista)).toHaveLength(1);
  });

  it("el día que se guarda es el primero, no el último", () => {
    // El orden de la lista decide cuál es el primero, y la lista viene ordenada por
    // fecha. Si se guardara el último, el `date` de la tarjeta sería el domingo y
    // alguien que vaya el sábado no la encontraría buscando el sábado.
    const lista = [
      ev({ title: "Concierto", date: "2026-10-10T20:00:00" }),
      ev({ title: "Concierto", date: "2026-10-11T20:00:00" }),
    ];

    expect(colapsarDiasConsecutivos(lista)[0].date).toBe("2026-10-10T20:00:00");
  });

  it("no funde dos eventos distintos que solo comparten el principio del título", () => {
    // El límite Conservative es el motivo de que esto sea una decisión y no una regla
    // de comparação entera. Dos cosas que se parecen son dos cosas hasta que se sabe
    // que son una: **un evento fundido con otro que no era suyo es un dato falso en la
    // agenda**, y eso es peor que un post con dos entradas parecidas.
    const lista = [
      ev({ title: "Festival Internacional de Teatro", date: "2026-10-10T20:00:00" }),
      ev({ title: "Festival Internacional de Danza", date: "2026-10-10T21:00:00" }),
    ];

    expect(colapsarDiasConsecutivos(lista)).toHaveLength(2);
  });

  it("un evento que solo pasa un día no lleva `dias`, porque ya lo dice `date`", () => {
    const lista = [ev({ title: "Concierto suelto", date: "2026-10-10T20:00:00" })];

    // Añadir `dias` a un evento de un solo día sería ruido: la tarjeta ya enseña la
    // fecha, y un campo que siempre está lleno no informa de nada.
    expect(colapsarDiasConsecutivos(lista)[0].dias).toBeUndefined();
  });

  it("funde tres días en una entrada, no en dos", () => {
    // El título tiene que pasar el mínimo de veinte caracteres normalizados: «Mercado
    // dominical» son dieciséis y **no se fundiría**, que es lo correcto porque no
    // identifica un mercado concreto. Un título real sí llega.
    const lista = [
      ev({ title: "Mercado dominical de coleccionistas", date: "2026-10-10T09:00:00" }),
      ev({ title: "Mercado dominical de coleccionistas", date: "2026-10-11T09:00:00" }),
      ev({ title: "Mercado dominical de coleccionistas", date: "2026-10-12T09:00:00" }),
    ];

    const salida = colapsarDiasConsecutivos(lista);

    expect(salida).toHaveLength(1);
    expect(salida[0].dias).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
  });

  it("conserva el orden de la lista al fundir", () => {
    // La lista entra ordenada por puntuación, que es lo que decide qué se enseña. Un
    // `sort` aquí la desordenaría y el post dejaría de enseñar los mejores primero.
    const lista = [
      ev({ title: "Concierto de The Helm", date: "2026-10-10T20:00:00" }),
      ev({ title: "Concierto de The Helm", date: "2026-10-11T20:00:00" }),
      ev({ title: "Teatro en la calle", date: "2026-10-10T20:00:00" }),
    ];

    expect(colapsarDiasConsecutivos(lista).map((e) => e.title)).toEqual([
      "Concierto de The Helm",
      "Teatro en la calle",
    ]);
  });

  it("dos títulos cortos iguales NO se funden, porque no identifican un evento", () => {
    // **Esta es la regla conservadora y la que protege la agenda.** "Cine" son cuatro
    // caracteres y hay dos cines distintos; "Concierto" son nueve y puede haber dos
    // sesiones en dos salas. Un título corto no dice **qué** evento es, así que dos
    // títulos cortos iguales son dos eventos que nadie ha differentiatesdo todavía.
    //
    // Un post con dos líneas iguales queda feo. Un evento fusionado con otro que no era
    // suyo es un dato falso **y además manda a alguien al sitio equivocado**.
    const lista = [
      ev({ title: "Cine", date: "2026-10-10T20:00:00" }),
      ev({ title: "cine", date: "2026-10-11T20:00:00" }),
    ];

    expect(colapsarDiasConsecutivos(lista)).toHaveLength(2);
  });

  it("no funde ni aunque coincidan salvo en las mayúsculas", () => {
    const lista = [
      ev({ title: "Feria del Libro", date: "2026-10-10T18:00:00" }),
      ev({ title: "FERIA DEL LIBRO", date: "2026-10-10T19:00:00" }),
    ];

    // "feria del libro" son quince caracteres normalizados, por debajo del mínimo de
    // veinte. Y en este caso además **deben** quedar separadas: son dos sesiones del
    // mismo programa, y fundirlas dejaría una fuera.
    expect(colapsarDiasConsecutivos(lista)).toHaveLength(2);
  });

  it("una lista vacía no es un error", () => {
    expect(colapsarDiasConsecutivos([])).toEqual([]);
  });
});