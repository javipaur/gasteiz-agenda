import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt = "Gasteiz Click · Agenda cultural de Vitoria-Gasteiz";

export default async function Image() {
  const markBuffer = await readFile(
    path.join(process.cwd(), "public", "brand-mark.svg")
  );
  const mark = `data:image/svg+xml;base64,${markBuffer.toString("base64")}`;

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
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={86} height={86} alt="" style={{ display: "block" }} />
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: "#000000" }}>
            Gasteiz
            <span style={{ color: "#BC0202" }}>Click</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -3,
            color: "#000000",
          }}
        >
          Qué hacer en
          <br />
          Vitoria-Gasteiz
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            fontWeight: 600,
            color: "#BC0202",
          }}
        >
          Conciertos · Teatro · Exposiciones · Cine · Deporte · Planes en familia
        </div>
      </div>
    ),
    { ...size }
  );
}