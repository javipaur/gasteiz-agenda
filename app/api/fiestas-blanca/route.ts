import { NextResponse } from "next/server";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { blancaEditionYear } from "@/lib/blanca";

export async function GET() {
  try {
    const fiestas = await scrapeFiestasBlanca();
    // El año del envelope sale de las fechas, igual que en el resto de la web. El
    // campo `source` no es un id del registro a propósito: es una etiqueta de esta
    // ruta, que fusiona el calendario municipal con GasteizHoy, y la consume un
    // cliente externo. Los eventos de `data` sí llevan `source: "fiestas-blanca"`,
    // que es el id del registro.
    const year = blancaEditionYear(fiestas.map((f) => f.date));
    return NextResponse.json({
      source: "vitoria-gasteiz + gasteizhoy",
      festival: year
        ? `Fiestas de la Virgen Blanca ${year}`
        : "Fiestas de la Virgen Blanca",
      count: fiestas.length,
      data: fiestas,
    });
  } catch (error) {
    console.error("Error scraping Fiestas de la Blanca:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos de las Fiestas de la Blanca" },
      { status: 500 }
    );
  }
}
