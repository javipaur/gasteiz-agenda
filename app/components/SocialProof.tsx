import { InViewWrapper } from "@/lib/shared";

function Stat({
  value,
  label,
  detail,
  icon,
}: {
  value: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        {icon}
      </span>
      <div>
        <p className="font-display text-2xl md:text-3xl font-black text-fg tracking-[-0.02em]">
          {value}
        </p>
        <p className="text-sm font-semibold text-fg mt-0.5">{label}</p>
        <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

export default function SocialProof({ eventCount }: { eventCount: number }) {
  if (eventCount <= 0) return null;

  return (
    <section className="px-5 sm:px-6 py-12 md:py-16">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="rounded-[1.5rem] border border-border bg-surface p-8 md:p-12">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent mb-2">
              Vitoria-Gasteiz, al día
            </p>
            <h2 className="font-display text-2xl md:text-3xl text-fg font-bold tracking-[-0.02em] mb-10 max-w-lg">
              Los planes de la ciudad, recogidos en un solo sitio
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <Stat
                value={`${eventCount}+`}
                label="planes publicados"
                detail="Eventos confirmados fuera de las próximas dos semanas."
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="4" width="15" height="13" rx="2" />
                    <path d="M2.5 8h15M6.5 2.5V5M13.5 2.5V5" />
                  </svg>
                }
              />
              <Stat
                value="15+"
                label="fuentes de datos"
                detail="Rula, Jimmy Jazz, VAM, ayuntamiento, Euskadi y más."
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="10" cy="10" r="7.5" />
                    <circle cx="10" cy="10" r="2.5" />
                  </svg>
                }
              />
              <Stat
                value="Diaria"
                label="actualización"
                detail="La agenda se refresca cada pocos minutos."
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 4V1.5M10 1.5L7.5 4M10 1.5L12.5 4" />
                    <path d="M10 16v2.5m0 0L7.5 16M10 18.5L12.5 16" />
                    <path d="M10 5.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
                  </svg>
                }
              />
              <Stat
                value="Gratis"
                label="sin registro"
                detail="No hace falta crear cuenta para ver la agenda."
                icon={
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2.5l7 3v5c0 4-2.9 6.5-7 7.5-4.1-1-7-3.5-7-7.5v-5l7-3z" />
                  </svg>
                }
              />
            </div>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}