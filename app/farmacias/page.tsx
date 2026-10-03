import type { Metadata } from "next";
import FarmaciasPageClient from "../components/FarmaciasPageClient";

// Sin la marca en el `title`: la plantilla de `app/layout.tsx` ya la añade.
export const metadata: Metadata = {
  title: "Farmacias de guardia en Vitoria-Gasteiz",
  description:
    "Farmacias de guardia abiertas hoy en Vitoria-Gasteiz: dirección, teléfono y mapa interactivo.",
  alternates: { canonical: "/farmacias" },
};

export default function FarmaciasPage() {
  // El instante llega como prop para que el `useMemo` que calcula "hoy" sea puro.
  // Dentro del componente era un memo con deps `[]` que se quedaba con el día
  // en que se montó la página. `react-hooks/purity` salta por el `Date.now()`, y
  // es un falso positivo: esta es una página de servidor, se renderiza una vez por
  // petición, y el valor viaja serializado al cliente. Mismo tratamiento que
  // `app/culture/page.tsx`.
  // eslint-disable-next-line react-hooks/purity
  return <FarmaciasPageClient ahora={Date.now()} />;
}