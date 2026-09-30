import { ImageResponse } from "next/og";
import { getEventoBySlug } from "@/lib/agenda";
import { eventDisplayDate } from "@/lib/seo";
import { readFile } from "fs/promises";
import path from "path";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt = "Evento en Vitoria-Gasteiz · Gasteiz Click";

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

  const markBuffer = await readFile(
    path.join(process.cwd(), "public", "brand-mark.svg")
  );
  const mark = `data:image/svg+xml;base64,${markBuffer.toString("base64")}`;

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
          background: "#F3EBD4",
          padding: 72,
          color: "#000000",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={56} height={56} alt="" style={{ display: "block" }} />
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#000000" }}>
            Gasteiz
            <span style={{ color: "#BC0202" }}>Click</span>
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
            fontWeight: 600,
            color: "#BC0202",
            borderTop: "1px solid rgba(0,0,0,0.12)",
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
