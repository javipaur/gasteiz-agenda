import { NextResponse } from "next/server";
import { scrapeSenderismo } from "@/lib/sources/senderismo";

export async function GET() {
  try {
    const actividades = await scrapeSenderismo();
    return NextResponse.json({
      source: "cm-gazteiz",
      category: "actividades",
      count: actividades.length,
      data: actividades,
    });
  } catch (error) {
    console.error("Error scraping cm-gazteiz:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las actividades" },
      { status: 500 }
    );
  }
}
