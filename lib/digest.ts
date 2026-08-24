import { getAgendaEventos } from "./agenda";
import type { PushPayload } from "./push";

export async function buildDailyDigest(): Promise<PushPayload> {
  const eventos = await getAgendaEventos({ days: 1 });

  if (eventos.length === 0) {
    return {
      title: "Gasteiz Click",
      body: "Hoy no hay eventos programados en Vitoria-Gasteiz. Buen día para pasear por el Anillo Verde.",
      url: "/",
    };
  }

  const titulos = eventos
    .slice(0, 3)
    .map((ev) => ev.title)
    .join(" · ");

  return {
    title:
      eventos.length === 1
        ? "1 evento hoy en Vitoria-Gasteiz"
        : `${eventos.length} eventos hoy en Vitoria-Gasteiz`,
    body: titulos + (eventos.length > 3 ? " y más…" : ""),
    url: `/evento/${eventos[0].slug}`,
  };
}
