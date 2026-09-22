"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { FarmaciaGuardia } from "@/lib/sources/farmacias";

import "leaflet/dist/leaflet.css";

type FarmaciasMapProps = {
  farmacias: FarmaciaGuardia[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const VITORIA_CENTER: LatLngExpression = [42.85028, -2.6729];

function FlyToSelected({ farmacias, selectedId }: { farmacias: FarmaciaGuardia[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    const f = farmacias.find((x) => x.id === selectedId);
    if (f && f.lat && f.lng && isFinite(Number(f.lat)) && isFinite(Number(f.lng))) {
      map.flyTo([Number(f.lat), Number(f.lng)], Math.max(map.getZoom(), 16), { duration: 0.8 });
    }
  }, [selectedId, farmacias, map]);
  return null;
}

export default function FarmaciasMap({ farmacias, selectedId, onSelect }: FarmaciasMapProps) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .leaflet-popup-content-wrapper { border-radius: 12px; }
      .leaflet-popup-content { margin: 12px 14px; font-family: inherit; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <MapContainer
      center={VITORIA_CENTER}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", minHeight: 360 }}
      className="z-0"
      aria-label="Mapa de farmacias de guardia"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <FlyToSelected farmacias={farmacias} selectedId={selectedId} />
      {farmacias.map((f) => {
        const lat = Number(f.lat);
        const lng = Number(f.lng);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        const selected = f.id === selectedId;
        return (
          <CircleMarker
            key={f.id}
            center={[lat, lng]}
            radius={selected ? 11 : 8}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: selected ? "#ff5a3c" : "#b13b47",
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(f.id) }}
          >
            <Popup>
              <div className="farmacia-popup" style={{ minWidth: 180 }}>
                <strong>{f.name}</strong>
                <br />
                <span>{f.shortAddress || f.address || f.neighborhood}</span>
                <br />
                <span style={{ fontSize: 13 }}>
                  {f.horarios && f.horarios !== "-" ? `${f.horarios} · ` : ""}
                  {f.phone && (
                    <a
                      href={`tel:${f.phone.replace(/[^\d+]/g, "")}`}
                      style={{ fontWeight: 600, color: "#b13b47" }}
                    >
                      {f.phone}
                    </a>
                  )}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}