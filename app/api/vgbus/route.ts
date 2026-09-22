import { NextResponse } from "next/server";
import {
  buscarParadas,
  paradasCercanas,
  detalleParada,
  consultaLlegadas,
  consultarAlertas,
} from "@/lib/sources/vgbus";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { ...CACHE_HEADERS, ...init?.headers },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accion = searchParams.get("accion");

  try {
    if (accion === "buscar") {
      const texto = searchParams.get("buscar") || "";
      if (texto.trim().length < 2) {
        return json({ resultado: [] });
      }
      const resultado = await buscarParadas(texto);
      return json({ resultado });
    }

    if (accion === "cerca") {
      const lat = Number(searchParams.get("lat"));
      const lng = Number(searchParams.get("lng") ?? searchParams.get("lon"));
      const radio = Number(searchParams.get("radio") || 300);
      const resultado = await paradasCercanas(lat, lng, radio);
      return json({ resultado });
    }

    if (accion === "detalle") {
      const idParada = searchParams.get("idParada") || "";
      if (!idParada) {
        return json({ error: "Falta idParada" }, { status: 400 });
      }
      const [info, realTime] = await Promise.all([
        detalleParada(idParada),
        consultaLlegadas(idParada),
      ]);
      const alertasGlobales = await consultarAlertas().catch(() => []);

      const lineasParada = new Set(realTime.llegadas.map((l) => l.line));
      const alertasRelevantes = alertasGlobales.filter(
        (a) =>
          a.stopId === idParada ||
          (a.line === "*" && lineasParada.size > 0) ||
          lineasParada.has(a.line || "")
      );

      const seen = new Set<string>();
      const alertas = [...realTime.alertas, ...alertasRelevantes].filter((a) => {
        const key = `${a.line}|${a.alertPeriodStart}|${a.alertHeader}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return json({
        parada: info?.parada || null,
        lineas: info?.lineas || [],
        llegadas: realTime.llegadas,
        alertas,
        fetchedAt: Date.now(),
      });
    }

    if (accion === "alertas") {
      const alertas = await consultarAlertas();
      return json({ alertas });
    }

    return json({ error: "Acción desconocida" }, { status: 400 });
  } catch (error) {
    console.error("Error en /api/vgbus:", error);
    return json(
      { error: "No se pudieron obtener los datos de VGBus" },
      { status: 500 }
    );
  }
}