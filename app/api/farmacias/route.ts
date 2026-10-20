import { NextResponse } from "next/server";
import { scrapeGuardiasDe } from "@/lib/sources/farmacias-guardia";

/**
 * El cuadrante de guardia, y la forma es contrato con la app móvil.
 *
 * **La forma no se toca.** `app/components/FarmaciasPageClient.tsx`,
 * `app/components/FarmaciasMap.tsx` y la pantalla de farmacias de la app
 * móvil consumen este mismo envelope, así que un cambio aquí se ve en los dos
 * sitios a la vez —y por eso el `data` sigue siendo un array y no un objeto.
 *
 * ## Lo que cambió
 *
 * Antes servía el **directorio** de opendata.euskadi.eus: 78 farmacias con
 * dirección y teléfono, **sin turno**. La página lo decía —"No es el cuadrante
 * de guardia"— porque era verdad.
 *
 * Ahora sirve el **cuadrante** del Colegio de Farmacéuticos de Álava: las
 * guardias del día, con horario, barrio y si el turno es de día o de noche.
 * La respuesta sigue teniendo los mismos campos, y ahora los que estaban
 * vacíos vienen llenos.
 *
 * `source` cambia de "opendata-euskadi" a "cofalava" por la misma razón que
 * cambió antes: el nombre dice de dónde sale el dato.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get("fecha")?.trim() || "";

  // Solo se acepta una fecha ISO: es lo que la app y la web mandan, y una
  // fecha que no sea ISO no se puede comparar con las del cuadrante sin
  // convertirla, y convertirla a ciegas es como se inventan fechas.
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json(
      { error: "La fecha tiene que estar en formato AAAA-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const guardias = await scrapeGuardiasDe(fecha || undefined);

    return NextResponse.json({
      source: "cofalava",
      // La fecha del turno, no la de la descarga. Es lo que la página compara
      // con "hoy" para poner el cartel de "Actualizado".
      date: guardias[0]?.date || "",
      count: guardias.length,
      fetchedAt: Date.now(),
      data: guardias,
    });
  } catch (error) {
    // **Este catch propaga en vez de devolver una lista vacía.** La misma
    // razón que el resto de las rutas: un 502 con el motivo es un dato que el
    // cliente puede reintentar, y un 200 con `data: []` es indistinguible de
    // "hoy no hay guardias". Y la app móvil **cachea** lo que llega, así que
    // un fallo silencioso se convertiría en una lista vacía permanente.
    console.error("Error obteniendo las guardias de farmacias:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las guardias de farmacias" },
      { status: 502 }
    );
  }
}
