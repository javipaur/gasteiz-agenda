import { InViewWrapper } from "@/lib/shared";

function Stat({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="border-t border-border pt-4">
      <dt className="font-display text-3xl md:text-4xl font-black text-fg tracking-[-0.02em] tabular-nums">
        {value}
      </dt>
      <dd className="mt-1 text-sm font-bold text-fg">{label}</dd>
      <dd className="mt-1 text-xs text-fg-muted leading-relaxed">{detail}</dd>
    </div>
  );
}

export default function SocialProof({
  eventCount,
  thisWeekCount,
}: {
  eventCount: number;
  thisWeekCount: number;
}) {
  if (eventCount <= 0) return null;

  return (
    <section className="px-5 sm:px-6 py-12 md:py-16">
      <div className="max-w-6xl mx-auto border-t border-border pt-10 md:pt-14">
        <InViewWrapper>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div className="max-w-md">
              <span className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-violet text-on-tint mb-6">
                Cifras
              </span>
              {/* Aquí no va `FreshnessBadge`, y antes iba.
                  El badge cuenta `Date.now() - since`, así que necesita un
                  `since` que sea la edad de los **datos**. En `/farmacias` y
                  `/bus` esa fecha viene de la respuesta de la API y la etiqueta
                  dice la verdad; en la home se le pasaba el instante del render,
                  o sea `since = now`, y eso producía dos mentiras: "Actualizado
                  hace 0 s" al abrir y una cuenta que sube mientras la pestaña
                  siga abierta, aunque la agenda no haya cambiado.

                  No se sustituye por otra marca: `getProximosEventos()` no
                  devuelve de cuándo son los eventos y `lib/cache.ts` no expone la
                  fecha de su fichero, así que no hay un `since` real que pasar sin
                  tocar `lib/`. Lo que sí es cierto y está dos líneas más abajo,
                  en la cifra "Diaria / actualización", es lo que se queda. */}
              <h2 className="font-display text-3xl md:text-4xl font-black uppercase tracking-[-0.03em] text-fg leading-tight">
                Gasteiz Click en cifras
              </h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
              <Stat
                value={`${thisWeekCount}+`}
                label="planes esta semana"
                detail="Propuestas confirmadas en los próximos 7 días."
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
                value="3 clubes · 2 deportes · 1 ciudad"
                label="deporte pro"
                detail="Baskonia, Alavés y Araski en una sola agenda."
              />
            </dl>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}
