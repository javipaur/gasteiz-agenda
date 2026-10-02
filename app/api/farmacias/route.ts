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
    console.error("Error obteniendo las farmacias de Vitoria:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las farmacias de Vitoria" },
      { status: 500 }
    );
  }
}
