"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { InViewWrapper } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import { CULTURE_SOURCE_PILLS, CULTURE_SOURCE_LABELS } from "@/lib/cultura-sources";
import { isTicketSource } from "@/lib/tickets";
import { sourceGroup } from "@/lib/source-data";
import FavoriteButton from "./FavoriteButton";

type Evento = {
  id: string;
  slug: string;
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
};

/**
 * Puntos extra por familia de fuente en el orden de "Populares", indexados por el
 * `group` del registro y no por id. Los tres números son los de antes.
 *
 * Por qué por familia: una fuente puede tener variantes, y los conciertos de VAM
 * entran en `/culture` como `vam-conciertos`, no como `vam`. Con un
 * `e.source === "vam"` no casaba nunca y los conciertos de VAM se quedaban con los
 * tres puntos de la cola. Con `sourceGroup`, la variante y la familia se puntúan
 * igual y una variante nueva hereda el peso sin tocar este fichero.
 */
const PESO_FAMILIA: Partial<Record<string, number>> = {
  fever: 8,
  jimmyjazz: 6,
  vam: 6,
};
const PESO_FAMILIA_POR_DEFECTO = 3;

const CATEGORIES = [
  { key: "all", label: "Todos" },
  { key: "agenda", label: "Agenda" },
  { key: "teatro", label: "Teatro" },
  { key: "conciertos", label: "Conciertos" },
  { key: "exposiciones", label: "Exposiciones" },
];

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5h14v7H1z" />
      <path d="M5.5 6v4M8 6v4M10.5 6v4" />
    </svg>
  );
}

/**
 * `ahora` lo pasa el servidor en vez de leerlo con `Date.now()` en el render.
 *
 * La puntuación de "popularidad" resta días hasta el evento, así que depende del
 * reloj: leerlo dentro del `useMemo` lo hacía impuro, y un memo impuro puede
 * devolver el valor cacheado indefinidamente — la ordenación se congelaría con
 * el `hoy` con el que se calculó la primera vez. Pasándolo como prop, además de
 * dejar el memo puro, la ordenación es reproducible por petición y no depende
 * de cuándo hydrate el navegador.
 */
export default function CulturePageClient({
  eventos,
  ahora,
}: {
  eventos: Evento[];
  ahora: number;
}) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [filter, setFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sort, setSort] = useState<"popularidad" | "fecha">("popularidad");

  const filtered = useMemo(() => {
    let byCategory = filter === "all"
      ? eventos
      : eventos.filter((e) => e.category === filter);
    if (filter === "conciertos" && sourceFilter !== "all") {
      byCategory = byCategory.filter((e) => e.source === sourceFilter);
    }
    if (q) {
      const query = q.toLowerCase();
      byCategory = byCategory.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query) ||
          e.location.toLowerCase().includes(query)
      );
    }
    return byCategory;
  }, [eventos, filter, sourceFilter, q]);

  const visible = useMemo(() => {
    const list = [...filtered];
    if (sort === "popularidad") {
      const score = (e: Evento) => {
        const days = Math.max(0, Math.round((new Date(e.date).getTime() - ahora) / 86400000));
        let s = 60 - days;
        if (e.image) s += 8;
        s += PESO_FAMILIA[sourceGroup({ id: e.source })] ?? PESO_FAMILIA_POR_DEFECTO;
        if (e.category === "exposiciones") s += 3;
        return s;
      };
      list.sort(
        (a, b) =>
          score(b) - score(a) ||
          +new Date(a.date) - +new Date(b.date) ||
          a.title.localeCompare(b.title)
      );
    } else {
      list.sort(
        (a, b) =>
          +new Date(a.date) - +new Date(b.date) ||
          a.title.localeCompare(b.title)
      );
    }
    return list;
  }, [filtered, sort, ahora]);

  const handleCategoryChange = (key: string) => {
    setFilter(key);
    setSourceFilter("all");
  };

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className={`inline-block h-5 w-[3px] rounded-full ${SECTION_TINT.cultura.bar}`} />
            <span className={`font-display italic ${SECTION_TINT.cultura.text} text-sm`}>Agenda</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Agenda Cultural
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Teatro, conciertos, exposiciones y eventos en Vitoria-Gasteiz
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-4 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                filter === cat.key
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filter === "conciertos" && CULTURE_SOURCE_PILLS.conciertos && (
          <div className="flex gap-2 mb-8 flex-wrap">
            {CULTURE_SOURCE_PILLS.conciertos.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setSourceFilter(pill.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                  sourceFilter === pill.key
                    ? "bg-accent text-white"
                    : "bg-bg-muted text-fg-subtle hover:text-fg-muted"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </InViewWrapper>

      <InViewWrapper delay={0.15}>
        <div className="flex items-center justify-between gap-4 mb-8">
          <p className="font-mono text-sm text-fg-subtle">
            {filtered.length} {filtered.length === 1 ? "plan" : "planes"}
          </p>
          <div className="flex items-center gap-1 bg-bg-muted rounded-full p-1" role="group" aria-label="Ordenar">
            {[
              { key: "popularidad" as const, label: "Populares" },
              { key: "fecha" as const, label: "Próximos" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                aria-pressed={sort === opt.key}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                  sort === opt.key
                    ? "bg-accent text-white shadow-sm"
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </InViewWrapper>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-fg-muted mb-2">
            {q
              ? `No hay resultados para "${q}"`
              : `No hay ${filter === "all" ? "eventos" : `eventos de ${filter}`} disponibles`}
          </p>
          {q && (
            <p className="text-xs text-fg-subtle">
              Prueba con otros términos o explora las categorías
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((evento, index) => {
            const imageUrl =
              evento.image && evento.image.startsWith("http")
                ? evento.image
                : null;
            return (
              <InViewWrapper
                key={evento.id || evento.title + evento.date + index}
                delay={Math.min(index * 0.04, 0.4)}
              >
                <div
                  className="group double-bezel-outer rounded-2xl p-1.5 block"
                  style={{
                    animation: `fadeIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) ${
                      Math.min(index * 0.04, 0.4)
                    }s both`,
                  }}
                >
                  <div className="double-bezel rounded-xl overflow-hidden">
                  <Link
                    href={`/evento/${evento.slug}`}
                    className="block focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <div className="aspect-[4/3] relative">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={evento.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
                          <span className="font-display text-6xl text-accent/20">
                            {evento.title.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      <div className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                        <span className="block font-mono text-[11px] uppercase text-white/70">
                          {new Intl.DateTimeFormat("es", { month: "short" }).format(new Date(evento.date)).toUpperCase().replace(".", "")}
                        </span>
                        <span className="block font-display text-lg text-white">
                          {new Date(evento.date).getDate()}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <FavoriteButton
                          event={{
                            id: evento.id,
                            slug: evento.slug,
                            title: evento.title,
                            date: evento.date,
                            image: evento.image,
                            location: evento.location,
                            link: evento.link,
                          }}
                        />
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-accent bg-accent/20 px-2 py-0.5 inline-block mb-2 rounded">
                          {evento.category === "conciertos" && evento.source
                            ? CULTURE_SOURCE_LABELS[evento.source] || evento.source
                            : evento.category}
                        </span>
                        <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
                          {evento.title}
                        </h3>
                        {evento.location && (
                          <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-accent inline-block shrink-0" />
                            {evento.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>

                  {evento.link && (
                    <div className="p-4 bg-surface">
                      <a
                        href={evento.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-accent text-white text-center py-3 font-medium text-sm hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                        style={{ borderRadius: "999px" }}
                      >
                        <span>{isTicketSource(evento.source) ? "Comprar entradas" : "Más información"}</span>
                        <TicketIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                  </div>
                </div>
              </InViewWrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
