import { ImageResponse } from "next/og";
import { getEventoBySlug } from "@/lib/agenda";
import { eventDisplayDate } from "@/lib/seo";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt = "Evento en Vitoria-Gasteiz — Gasteiz Click";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getEventoBySlug(slug);

  const title = result?.evento.title || "Agenda de Vitoria-Gasteiz";
  const meta = result
    ? `${eventDisplayDate(result.evento)} · ${result.evento.location}`
    : "gasteizclick.javierpalacio.es";

  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 32) {
      if (current) lines.push(current.trim());
      current = w;
      if (lines.length >= 3) break;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current && lines.length < 3) lines.push(current.trim());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #D4524A 0%, #C94A3D 100%)",
          padding: 72,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#FFD166",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 800,
              color: "#C94A3D",
            }}
          >
            G
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 600, opacity: 0.9 }}>
            Gasteiz Click — Agenda de Vitoria-Gasteiz
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: lines.length > 2 ? 58 : 72,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -2,
          }}
        >
          {lines.join(" ").slice(0, 120)}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            opacity: 0.85,
            borderTop: "1px solid rgba(255,255,255,0.25)",
            paddingTop: 24,
          }}
        >
          {meta}
        </div>
      </div>
    ),
    { ...size }
  );
}
