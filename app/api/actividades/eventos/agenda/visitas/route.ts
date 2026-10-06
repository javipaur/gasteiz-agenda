import { NextResponse } from "next/server";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";

export async function GET() {
  try {
    // El `tipo` es el número 15 y no una cadena, y esta línea estuvo años diciendo lo
    // contrario. Es el **mismo bug** que el commit `3f96550` arregló en la entrada
    // `municipal-visitas` del registro, que se preguntaba con `tipo: ["visitias
    // guiadas"]` y traía exactamente nada. Medido el 6 de octubre de 2026 contra el
    // calendario 196, con las cuatro escrituras razonables de una etiqueta:
    //
    //   tipo [15]                  ->  50
    //   tipo ["Visita guiada"]     ->   0
    //   tipo ["visita guiada"]    ->   0
    //   tipo ["VISITA GUIADA"]    ->   0
    //   tipo ["visitias guiadas"] ->   0   <-- lo que había aquí
    //
    // Cuatro formas de cadena, cuatro ceros: no era una variante sin tilde que el sitio
    // esperase, era un error tipográfico. Y el filtro que no casa **no da error**,
    // devuelve `[]`, así que esta ruta contestaba HTTP 200 con una lista vacía que el
    // cliente móvil no puede distinguir de "hoy no hay visitas guiadas" —y sin una
    // sola línea de log, porque `Promise.allSettled` no distingue una promesa que
    // resuelve con `[]` de una fuente que no publica nada.
    //
    // **Por qué llegó hasta aquí si el registro ya estaba limpio:** el guard de
    // `__tests__/source-registry.test.ts` que prohíbe las cadenas en `tipo` mira las URLs
    // que salen de cada `run` de `SOURCE_REGISTRY`, y esta ruta monta su propia consulta
    // y nunca pasa por el registro. De las diez llamadas a `scrapeMunicipalCalendar` que
    // hay bajo `app/`, esta era la única que ponía una cadena en `tipo`: las otras van por
    // `calendariosID`, por `dest`, sin filtro, o con un número. El agujero estaba donde el
    // guard no miraba, así que se cierra en
    // `__tests__/sources/municipal-tipos.test.ts`, que recorre `app/api/**` entero.
    const eventos = await scrapeMunicipalCalendar({ tipo: [15] });
    return NextResponse.json(eventos);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar eventos" },
      { status: 500 }
    );
  }
}
