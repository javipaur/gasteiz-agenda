import { NextResponse } from "next/server";
import { scrapeFarmacias } from "@/lib/sources/farmacias";

// `source` cambio de "cofalava" a "opendata-euskadi": no es una mejora de
// estilo sino que el nombre dice de donde sale el dato, y el Colegio ya no
// responde. La forma del envelope es contrato con la app movil y no se toca.
export async function GET() {
  try {
    const farmacias = await scrapeFarmacias();
    return NextResponse.json({
      source: "opendata-euskadi",
      date: farmacias[0]?.date || "",
      count: farmacias.length,
      fetchedAt: Date.now(),
      data: farmacias,
    });
  } catch (error) {
    // **Este catch era inalcanzable y por eso el 200 vacío se colaba.** Las dos
    // salidas de error de `scrapeFarmacias` devolvían `[]` en vez de propagar, así
    // que un 503 de opendata con la caché fría nunca llegaba aquí: salía como
    // `200 {count: 0, data: []}`, que es indistinguible de un directorio vacío. Y
    // la app móvil cachea lo que llega, con lo que medio minuto de opendata caído
    // se convertía en un mapa sin farmacias y sin error en ninguna parte.
    //
    // El scraper ahora propaga cuando no sabe, y distingue los dos estados igual
    // que los cines: un origen que responde y da cero farmacias es un dato y sale
    // 200 con `data: []`; un origen caído sale 502, que es el mismo código que usa
    // `/api/cines` para "no vino lo que pedí de fuera". Con la caché ya poblada, un
    // fallo posterior devuelve los datos viejos por dentro y esta ruta responde 200
    // como siempre, que es lo que hace útil tener la caché de 6 h.
    console.error("Error obteniendo las farmacias de Vitoria:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las farmacias de Vitoria" },
      { status: 502 }
    );
  }
}