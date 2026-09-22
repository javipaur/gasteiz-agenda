import { InViewWrapper } from "@/lib/shared";

function Stat({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="border-t border-border pt-4">
      <dt className="font-display text-3xl md:text-4xl font-semibold text-fg tracking-[-0.02em] tabular-nums">
        {value}
      </dt>
      <dd className="mt-1 text-sm font-medium text-fg">{label}</dd>
      <dd className="mt-1 text-xs text-fg-muted leading-relaxed">{detail}</dd>
    </div>
  );
}

export default function SocialProof({ eventCount }: { eventCount: number }) {
  if (eventCount <= 0) return null;

  return (
    <section className="px-5 sm:px-6 py-12 md:py-16">
      <div className="max-w-6xl mx-auto border-t border-border pt-10 md:pt-14">
        <InViewWrapper>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div className="max-w-md">
              <span aria-hidden="true" className="inline-block h-6 w-[3px] rounded-full bg-accent mb-6" />
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-fg tracking-[-0.02em] leading-tight">
                Los planes de la ciudad, recogidos en un solo sitio
              </h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
              <Stat
                value={`${eventCount}+`}
                label="planes publicados"
                detail="Eventos confirmados fuera de las próximas dos semanas."
              />
              <Stat
                value="15+"
                label="fuentes de datos"
                detail="Rula, Jimmy Jazz, VAM, ayuntamiento, Euskadi y más."
              />
              <Stat
                value="Diaria"
                label="actualización"
                detail="La agenda se refresca cada pocos minutos."
              />
              <Stat
                value="Gratis"
                label="sin registro"
                detail="No hace falta crear cuenta para ver la agenda."
              />
            </dl>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}