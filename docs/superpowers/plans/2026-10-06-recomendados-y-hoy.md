# Recomendados: corroboración, selector y `/hoy`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la web diga qué va hoy, con una señal que el agregado ya calcula y tira, y que exista una página `/hoy` que sea el destino de un post de Instagram.

**Architecture:** `aggregate` cuenta cuántos ids de fuente contaban cada evento al deduplicar y lo guarda en `corrobora`. Un módulo nuevo, `lib/recomendados.ts`, es el único sitio que decide qué va en una lista de recomendados, y lo usan dos consumidores: la sección de la home y la página `/hoy`. Sin tope por categoría, que es la decisión tomada.

**Tech Stack:** Next.js 16 App Router, RSC, TypeScript estricto, Jest.

**Spec:** `docs/superpowers/specs/2026-10-06-cobertura-recomendados-instagram-design.md`, Fase 2.

## Global Constraints

- Comentarios y mensajes de commit **en castellano**.
- **`corrobora` es opcional.** Los muchos tests que construyen `AgendaEvento` a mano no lo declaran, y un campo obligatorio los rompe todos.
- El selector **no importa nada de servidor**: `lib/recomendados.ts` solo recibe la lista, como `lib/popularity.ts`. La hoja es pura y no arrastra scrapers al bundle del cliente.
- `getPopularEvents` (`lib/popularity.ts`) ya hace el patrón de "mapear a `{evento, score, i}`, ordenar, cortar". El selector nuevo lo replica en vez de inventar otro.
- Los tests de componente con jsdom usan `escenario()` de `__tests__/helpers-a11y.ts`, que pide React, `createRoot` y el componente **dentro del mismo `isolateModules`**, y no usan JSX.

---

## Task 1: `corrobora`, el número que el dedupe tiraba

`lib/agenda.ts:186-190` roba `image`, `description` y `location` al perdedor del dedupe y **descarta el resto**, incluida la procedencia. El agregado sabe cuántos eventos duplicados ha juntado y tira ese número. Es la señal que hace que "recomendado" no sea solo el ranking de popularidad: un evento que cuenta tres fuentes es más real que uno que cuenta una sola de peso mínimo.

**Files:**
- Modify: `lib/agenda.ts` (el tipo y el bucle del dedupe)
- Modify: `__tests__/agenda.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `corrobora?: number` en `AgendaEvento`, con 1 para un evento que solo cuenta una fuente.

- [ ] **Step 1: Escribir el test que falla**

Añade a `__tests__/agenda.test.ts`, en el `describe` de `aggregate`:

```ts
  it("cuenta cuántas fuentes cuentan cada evento, y no lo tira con el perdedor", async () => {
    // El bug que este test existe para que no vuelva: el dedupe roba `image`,
    // `description` y `location` al perdedor y descarta el resto. El número de
    // fuentes que contaban el evento se iba con él, y es
    // justo la señal que usa el selector de recomendados.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    const entrada = (id: string, title: string, link: string) => ({
      id,
      group: "municipal" as const,
      label: "Ayuntamiento",
      priority: 0,
      cacheTtlMs: undefined,
      run: async () => [
        { title, date: "2030-05-01T20:00:00.000Z", location: "Sala", link },
      ],
    });

    const eventos = await aggregate([
      entrada("a", "Concierto único", "/a"),
      entrada("b", "Concierto único", "/b"),
      entrada("c", "Concierto único", "/c"),
    ]);

    expect(eventos).toHaveLength(1);
    expect(eventos[0].corrobora).toBe(3);
  });
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/agenda.test.ts
```

Expected: FAIL con `expect(eventos[0].corrobora).toBe(3)` recibiendo `undefined`.

- [ ] **Step 3: Declarar el campo**

En `lib/agenda.ts`, en el tipo `AgendaEvento`, después de `rating?: number`:

```ts
  /**
   * Cuántos ids de fuente contaban este evento antes del dedupe.
   *
   * El dedupe se queda con un ganador y roba al perdedor `image`, `description` y
   * `location`; este número se perdía con el resto. Opcional porque los tests que
   * construyen eventos a mano no lo declaran, y obligatorio sería romperlos todos.
   */
  corrobora?: number;
```

- [ ] **Step 4: Contarlo**

En el bucle del dedupe, al principio del `for (const ev of collected)`:

```ts
  for (const ev of collected) {
    // Antes demirlo. Todo evento pasa por aquí una vez, así que `corrobora` es 1
    // para el que no tiene duplicado y 2, 3… para el que otras fuentes también
    // contaban.
    ev.corrobora = 1;
    const key = dedupeKey(ev);
```

Y en la rama del perdedor, después de la línea de `location`:

```ts
    winner.corrobora = (winner.corrobora ?? 1) + 1;
```

- [ ] **Step 5: Correrlo y verlo pasar**

```
npx jest __tests__/agenda.test.ts
```

Expected: PASS.

- [ ] **Step 6: Comitear**

```
git add lib/agenda.ts __tests__/agenda.test.ts
git commit -m "feat(agenda): el dedupe contaba las fuentes y las tiraba con el perdedor"
```

---

## Task 2: El selector

Un solo sitio decide qué va en una lista de recomendados, y lo usan la home y `/hoy`. Si hubiera dos, divergirían sin avisar.

**Files:**
- Create: `lib/recomendados.ts`
- Create: `__tests__/recomendados.test.ts`

**Interfaces:**
- Consumes: `scoreEvento(evento: Evento, today?: Date): number` de `@/lib/popularity`.
- Produces: `recomendados(eventos: Evento[], ventana: VentanaRecomendados): Evento[]`, más los tipos `VentanaRecomendados` y `LIMITE_POR_DEFECTO`.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/recomendados.test.ts`:

```ts
import { recomendados, LIMITE_POR_DEFECTO } from "@/lib/recomendados";
import type { Evento } from "@/lib/eventos";

/** Un evento de los que el test construye a mano. `corrobora` es opcional a propósito. */
const ev = (over: Partial<Evento> = {}): Evento => ({
  id: "e1",
  slug: "e1",
  title: "Evento",
  date: "2030-05-01T20:00:00.000Z",
  location: "Sala",
  link: "/e1",
  category: "Teatro",
  source: "municipal-teatro",
  ...over,
});

const HOY = new Date(2030, 4, 1, 12, 0, 0);

describe("recomendados", () => {
  it("devuelve los que están en la ventana y ninguno fuera", () => {
    const lista = recomendados(
      [
        ev({ id: "hoy", date: "2030-05-01T20:00:00.000Z" }),
        ev({ id: "manana", date: "2030-05-02T20:00:00.000Z" }),
        ev({ id: "ayer", date: "2030-04-30T20:00:00.000Z" }),
        ev({ id: "dentroDeUnMes", date: "2030-06-01T20:00:00.000Z" }),
      ],
      { desde: "2030-05-01", hasta: "2030-05-03", hoy: HOY }
    );

    expect(lista.map((e) => e.id).sort()).toEqual(["hoy", "manana"]);
  });

  it("la ventana es inclusiva por los dos extremos", () => {
    // El último día de un post de finde es el domingo entero, no hasta las 00:00 del
    // lunes. Es el detalle que hace que un evento del domingo a las 20:00 no desaparezca.
    const domingo = ev({ id: "domingo", date: "2030-05-05T20:00:00.000Z" });

    const lista = recomendados([domingo], {
      desde: "2030-05-05",
      hasta: "2030-05-05",
      hoy: HOY,
    });

    expect(lista.map((e) => e.id)).toEqual(["domingo"]);
  });

  it("prepone el que más fuentes cuentan, no solo el más pesado", () => {
    // El caso que justifica el módulo: dos eventos del mismo peso y categoría, y el
    // que sale en tres fuentes va primero. Con `scoreEvento` solo, empatarían y
    // mandaría el orden de entrada, que es el orden de los registries.
    const uno = ev({ id: "uno", corrobora: 1 });
    const tres = ev({ id: "tres", corrobora: 3, date: "2030-05-01T22:00:00.000Z" });

    const lista = recomendados([uno, tres], {
      desde: "2030-05-01",
      hasta: "2030-05-01",
      hoy: HOY,
    });

    expect(lista.map((e) => e.id)).toEqual(["tres", "uno"]);
  });

  it("la bonificación tiene tope, para que seis fuentes no aplasten al Ayuntamiento", () => {
    // Los pesos de `lib/popularity.ts` van de 5 a 40. Un evento con seis fuentes de
    // peso 5 sumaría 50 y aplastaría a un concierto del Ayuntamiento (25), que es
    // de lo más real de la agenda. Con tope en tres extras, tres fuentes deciden y
    // la sexta ya no acumula.
    const seis = ev({ id: "seis", corrobora: 6, source: "miniature" });
    const municipal = ev({ id: "municipal", corrobora: 1, source: "municipal-conciertos" });

    const conSeis = recomendados([seis, municipal], {
      desde: "2030-05-01",
      hasta: "2030-05-01",
      hoy: HOY,
      limite: 2,
    });

    // Con tope, el municipal gana; sin tope, ganaría el de seis fuentes.
    expect(conSeis.map((e) => e.id)).toEqual(["municipal", "seis"]);
  });

  it("descarta lo que no tiene imagen, como ya hace getPopularEvents", () => {
    // La razón está en `lib/popularity.ts`: una tarjeta sin foto es una letra sobre
    // un rectángulo, y la lista de recomendados es la primera que se mira.
    const conFoto = ev({ id: "foto", image: "https://www.vitoria-gasteiz.org/c.jpg" });
    const sinFoto = ev({ id: "sinfoto" });

    const lista = recomendados([conFoto, sinFoto], {
      desde: "2030-05-01",
      hasta: "2030-05-01",
      hoy: HOY,
    });

    expect(lista.map((e) => e.id)).toEqual(["foto"]);
  });

  it("un día sin nada devuelve lista vacía, no un relleno", () => {
    expect(
      recomendados([ev({ date: "2030-07-01T20:00:00.000Z" })], {
        desde: "2030-05-01",
        hasta: "2030-05-01",
        hoy: HOY,
      })
    ).toEqual([]);
  });

  it("el límite por defecto son ocho, que es lo que cabe en un carrusel con la portada", () => {
    const muchos = Array.from({ length: 20 }, (_, i) =>
      ev({ id: `e${i}`, date: "2030-05-01T20:00:00.000Z", image: "https://www.vitoria-gasteiz.org/c.jpg" })
    );

    const lista = recomendados(muchos, { desde: "2030-05-01", hasta: "2030-05-01", hoy: HOY });

    expect(LIMITE_POR_DEFECTO).toBe(8);
    expect(lista).toHaveLength(LIMITE_POR_DEFECTO);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/recomendados.test.ts
```

Expected: FAIL con «Cannot find module '@/lib/recomendados'».

- [ ] **Step 3: Escribir el módulo**

Crea `lib/recomendados.ts`:

```ts
// `import type` y no `import`, por la misma razón que `lib/popularity.ts`: este
// módulo lo carga la home, que es `"use client"`, y un import de valor arrastraría
// la cadena entera de scrapers al bundle del navegador.
import { scoreEvento } from "./popularity";
import type { Evento } from "./eventos";

/** Cuánto pesa que un evento lo cuente más de una fuente. */
const BONO_POR_FUENTE_EXTRA = 10;

/**
 * Cuántas fuentes extra cuentan, y nada más.
 *
 * Los pesos de `lib/popularity.ts` van de 5 a 40. Sin tope, un evento con seis
 * fuentes de peso mínimo sumaría 60 y aplastaría a un concierto del Ayuntamiento
 * (25), que es de lo más real que publica la agenda. Con tope en tres, tres fuentes
 * coinciden y la cuarta ya no acumula: la señal dice "esto está confirmado por
 * varios sitios", no "esto tiene many fuentes".
 */
const EXTRAS_QUE_CUENTAN = 3;

export const LIMITE_POR_DEFECTO = 8;

export type VentanaRecomendados = {
  /** `YYYY-MM-DD`, inclusive. */
  desde: string;
  /** `YYYY-MM-DD`, inclusive y con el día entero. */
  hasta: string;
  /** Para el desempate de `scoreEvento`. Por defecto, ahora. */
  hoy?: Date;
  /** Por defecto, `LIMITE_POR_DEFECTO`. */
  limite?: number;
};

/** El último instante del día, en hora local. Es la misma magnitud que usa `agenda.ts`. */
function finDeDia(ymd: string): Date {
  const d = new Date(`${ymd}T00:00:00`);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Qué va en una lista de recomendados, y es el único sitio que lo decide.
 *
 * El mismo criterio lo usan la home y `/hoy`, ysoon el mismo módulo los usa el
 * paquete de redes. Dos copias divergen sin avisar.
 *
 * **Sin tope por categoría.** Es la decisión tomada y la consecuencia se acepta:
 * un día con cinco conciertos da cinco conciertos, y la lista lo dirá con sus
 * repeticiones. Si molesta, el tope son tres líneas más aquí y en el test.
 */
export function recomendados(
  eventos: Evento[],
  { desde, hasta, hoy = new Date(), limite = LIMITE_POR_DEFECTO }: VentanaRecomendados
): Evento[] {
  const desdeDate = new Date(`${desde}T00:00:00`);
  const hastaDate = finDeDia(hasta);
  if (isNaN(desdeDate.getTime()) || isNaN(hastaDate.getTime())) return [];

  const enVentana = eventos.filter((e) => {
    const d = new Date(e.date);
    return d >= desdeDate && d <= hastaDate;
  });

  return enVentana
    // Sin imagen no hay tarjeta que mirar. Es el mismo filtro que ya aplica
    // `getPopularEvents`, y por el mismo motivo.
    .filter((e) => e.image)
    .map((evento, i) => {
      const extras = Math.min(Math.max((evento.corrobora ?? 1) - 1, 0), EXTRAS_QUE_CUENTAN);
      return { evento, score: scoreEvento(evento, hoy) + extras * BONO_POR_FUENTE_EXTRA, i };
    })
    // El desempate es la posición de entrada, igual que en `getPopularEvents`: es lo
    // que garantiza el sort estable sin depender de esa garantía en ninguna parte.
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limite)
    .map((x) => x.evento);
}
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/recomendados.test.ts
```

Expected: PASS. Si falla el caso del tope, sube `BONO_POR_FUENTE_EXTRA` o revisa que `miniature` y `municipal-conciertos` tengan los pesos que el test asume.

- [ ] **Step 5: Comitear**

```
git add lib/recomendados.ts __tests__/recomendados.test.ts
git commit -m "feat(recomendados): un solo selector para la home, /hoy y el paquete de redes"
```

---

## Task 3: La página `/hoy`

Va página propia y no una sección más de la home, por un motivo que no se vio hasta pensarlo: el post de Instagram es la fuente de tráfico y necesita una landing que merezca la pena. La home no es "hoy".

**Files:**
- Create: `app/hoy/page.tsx`
- Create: `__tests__/hoy.test.ts`

**Interfaces:**
- Consumes: `recomendados(eventos, ventana)` de `@/lib/recomendados`; `getAgendaEventos()` de `@/lib/agenda`; `EventCard` de `@/lib/shared`.
- Produces: la ruta `/hoy`, con `?fecha=YYYY-MM-DD` para la ventana de un día y `?hasta=YYYY-MM-DD` para la de semana o finde.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/hoy.test.ts`:

```ts
import { loadFixture, mockFetchWith } from "./helpers";

/**
 * La página se llama como una función, sin React.
 *
 * Un server component de App Router es una función async que recibe props, así que
 * se puede llamar directamente: `{ searchParams }` es lo único que necesita y aquí no
 * hay ni cookies ni cabeceras. Es lo que hace `__tests__/api/actividades-agenda.test.ts`
 * con su route handler, con la diferencia de que aquí no hay `Response` que leer sino
 * un árbol de React, y lo que se comprueba es el texto que sale.
 */
async function renderizar(params: Record<string, string> = {}) {
  jest.resetModules();
  mockFetchWith([
    { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
  ]);
  const mod = await import("@/app/hoy/page");
  return mod.default({
    searchParams: Promise.resolve(params),
    params: Promise.resolve({}),
  });
}

/** El texto plano del árbol, que es lo que lee una persona. */
const texto = async (nodo: unknown): Promise<string> => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(nodo as React.ReactElement);
};
```

Y debajo, los casos:

```ts
describe("/hoy", () => {
  it("pinta los recomendados del día que se le pide, no los de hoy", async () => {
    // La razón de que `?fecha=` exista: el paquete de redes necesita la página de un
    // día distinto al de hoy, y sin esto la URL del pie de foto llevaría a una página
    // que no es la que anuncia.
    const html = await texto(await renderizar({ fecha: "2030-05-02" }));

    expect(html).toContain("Recomendados");
    expect(html).not.toContain("No hay nada");
  });

  it("acepta `?hasta=` para la ventana larga de semana o finde", async () => {
    const html = await texto(
      await renderizar({ desde: "2030-05-01", hasta: "2030-05-03" })
    );

    expect(html).toContain("Recomendados");
  });

  it("un día sin nada lo dice, en vez de pintar una página vacía sin explicación", async () => {
    const html = await texto(await renderizar({ fecha: "1990-01-01" }));

    expect(html).toMatch(/no hay nada|norecommended|Nada/i);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/hoy.test.ts
```

Expected: FAIL con «Cannot find module '@/app/hoy/page'».

- [ ] **Step 3: Escribir la página**

Crea `app/hoy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { EventCard, InViewWrapper } from "@/lib/shared";
import { localDateStr } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Recomendados para hoy",
  description: "Qué merece la pena hoy en Vitoria-Gasteiz, con los eventos que más fuentes confirman.",
  alternates: { canonical: "/hoy" },
};

/** `YYYY-MM-DD` de hoy en hora local, que es como los eventos llevan la fecha. */
function hoyLocal(): string {
  return localDateStr(new Date());
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HoyPage({ searchParams }: Props) {
  const q = await searchParams;
  const uno = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  // La ventana es `desde`/`hasta` y no solo `fecha`, porque el mismo selector sirve
  // al post del día, al de la semana y al del finde, y los tres son la misma página
  // con otros dos parámetros. Sin `?fecha=`, hoy.
  const desde = uno(q.desde) ?? uno(q.fecha) ?? hoyLocal();
  const hasta = uno(q.hasta) ?? desde;

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde, hasta });

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-fg">Recomendados</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {desde === hasta ? desde : `${desde} — ${hasta}`}
      </p>

      {lista.length === 0 ? (
        <p className="mt-10 text-fg-muted">
          No hay nada recomendado para esa fecha.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((evento) => (
            <InViewWrapper key={evento.id}>
              <EventCard evento={evento} />
            </InViewWrapper>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/hoy.test.ts
```

Expected: PASS.

Si el caso de "día sin nada" falla por el texto, ajusta la aserción al literal que uses en la página, no al revés: el mensaje importa y el test lo debe fijar.

- [ ] **Step 5: Añadir el enlace desde la cabecera**

En `app/components/Header.tsx`, junto a los demás enlaces de sección, un `Link` a `/hoy` con el texto `Recomendados`. Es lo que hace que la página exista para alguien que no llega por Instagram.

- [ ] **Step 6: Comitear**

```
git add app/hoy/page.tsx app/components/Header.tsx __tests__/hoy.test.ts
git commit -m "feat(hoy): la pagina a la que tiene que llevar el post de instagram"
```

---

## Verificación del plan

```
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Los cuatro en verde. La sección de recomendados en la home NO está en este plan: son cuatro líneas de usar `recomendados()` en `app/page.tsx` y pasar el resultado a un componente cliente si hiciera falta, y se hace
después de que `/hoy` esté medido en producción. Anotado aquí para que no se pierda.
