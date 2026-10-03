"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type { FarmaciaGuardia } from "@/lib/sources/farmacias";

import "leaflet/dist/leaflet.css";
import { duracionDeVuelo } from "./motion";

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
      // `flyTo` interpola el centro y el zoom en JavaScript, con su propio bucle de
      // animación: ni `transition-duration` ni `@media (prefers-reduced-motion)` le
      // tocan. Con la preferencia puesta se vuela con duración 0, que en Leaflet
      // es el salto instantáneo al destino.
      map.flyTo([Number(f.lat), Number(f.lng)], Math.max(map.getZoom(), 16), {
        duration: duracionDeVuelo(0.8),
      });
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
    <>
      <MapContainer
        center={VITORIA_CENTER}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", minHeight: 360 }}
        className="z-0"
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

      {/*
        El mapa no es accesible: sus marcadores son `<path>` de SVG con un
        `eventHandlers.click`, así que ni son enfocables ni tienen nombre, y el
        `aria-label` que llevaba el contenedor caía sobre un `<div>` sin rol, donde se
        ignora. La lista de botones que hay al lado sí lo es, pero un mapa que no se
        puede recorrer con teclado no se puede leer con lector de pantalla.

        Esta lista oculta devuelve el nombre y el foco a cada punto: es un `<button>`
        de verdad, con el texto de la farmacia, y hace lo mismo que el marcador. Se
        escribe en vez de tocar el DOM que Leaflet genera porque react-leaflet no
        deja pasar `tabIndex` ni `role` al `<path>`.
      */}
      <ul className="sr-only">
        {farmacias.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onSelect(f.id)}>
              Ver {f.name} en el mapa
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}