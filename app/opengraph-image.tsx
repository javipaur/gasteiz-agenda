import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const alt = "Gasteiz Click · Agenda cultural de Vitoria-Gasteiz";

export default function Image() {
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
          padding: 80,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              backgroundColor: "#FFF8F4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
              color: "#C94A3D",
            }}
          >
            G
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            Gasteiz Click
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -3,
          }}
        >
          Qué hacer en Vitoria-Gasteiz
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            opacity: 0.85,
          }}
        >
          Conciertos · Teatro · Exposiciones · Cine · Deporte · Planes en familia
        </div>
      </div>
    ),
    { ...size }
  );
}
