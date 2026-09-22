export const revalidate = 300;

import type { Metadata } from "next";
import TurismoPageClient from "../components/TurismoPageClient";
import {
  getQueVer,
  getRutasTurismo,
  getInfoPractica,
  getVisitasGuiadas,
} from "@/lib/turismo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Turismo en Vitoria-Gasteiz · Qué ver y hacer",
    description:
      "Qué ver, rutas por el Anillo Verde, visitas guiadas e información práctica de Vitoria-Gasteiz.",
    alternates: { canonical: "/turismo" },
  };
}

export default async function TurismoPage() {
  const [queVer, rutas, info, visitas] = await Promise.all([
    getQueVer(),
    getRutasTurismo(),
    getInfoPractica(),
    getVisitasGuiadas(),
  ]);

  return (
    <TurismoPageClient
      queVer={queVer}
      rutas={rutas}
      info={info}
      visitas={visitas}
    />
  );
}