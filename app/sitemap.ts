import type { MetadataRoute } from "next";
import { getAgendaEventos } from "@/lib/agenda";
import { isBlancaSeason } from "@/lib/blanca";

const BASE_URL = "https://gasteizclick.javierpalacio.es";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hoy = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/culture`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/conciertos`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...(isBlancaSeason()
      ? [
          {
            url: `${BASE_URL}/fiestas-blanca`,
            changeFrequency: "daily" as const,
            priority: 0.9,
          },
        ]
      : []),
    {
      url: `${BASE_URL}/deporte`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/movies`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/kids`,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = [
    "teatro",
    "conciertos",
    "exposiciones",
    "agenda",
  ].map((cat) => ({
    url: `${BASE_URL}/culture/${cat}`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const monthRoutes: MetadataRoute.Sitemap = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthRoutes.push({
      url: `${BASE_URL}/agenda/${mes}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    });
  }

  try {
    const eventos = await getAgendaEventos({ days: 90 });

    const eventUrls: MetadataRoute.Sitemap = eventos
      .slice(0, 2000)
      .map((ev) => ({
        url: `${BASE_URL}/evento/${ev.slug}`,
        lastModified: new Date(ev.date),
        changeFrequency: "daily" as const,
        priority: ev.source === "fiestas-blanca" ? 0.9 : 0.7,
      }));

    return [...staticRoutes, ...categoryRoutes, ...monthRoutes, ...eventUrls];
  } catch {
    return [...staticRoutes, ...categoryRoutes, ...monthRoutes];
  }
}
