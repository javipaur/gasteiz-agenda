# Cobertura municipal: paginación adaptativa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que lleguen a la agenda los 840 eventos que publica el Ayuntamiento y no los 461, consumiendo además los dos `tipo` que nadie consultaba.

**Architecture:** `fetchMunicipalCalendar` es la única puerta al calendario y hoy hace una petición por entrada con ventana de 12 meses. El servlet corta a unos 50 resultados, así que esa única petición trunca cada entrada y el recorte no da ningún error. Se le añade paginación adaptativa: si una ventana vuelve cerca del tope se repite mes a mes, y si un mes también satura se parte en dos mitades. Las ventanas de una entrada van en serie, y las 18 entradas lo hacen en paralelo como hasta ahora.

**Tech Stack:** Next.js 16, TypeScript estricto, Jest, `fetch` nativo.

**Spec:** `docs/superpowers/specs/2026-10-06-cobertura-recomendados-instagram-design.md`, Fase 1.

## Global Constraints

- Comentarios y mensajes de commit **en castellano**. Los commits son conventional con el scope en castellano.
- **Los tests no usan red.** Toda respuesta del servlet sale de `mockFetchWith` y una fixture versionada.
- `jest.config.ts` fija `process.env.TZ = "Europe/Madrid"`. Las fechas de test se construyen con `new Date()` local, nunca con literales.
- `cacheTtlMs` solo lo respetan las entradas que lo declaran (`lib/agenda.ts:147-152`); el resto lo cubre el `agenda-all` de 5 minutos.
- Sin `any` nuevos en componentes ni páginas: `lib/lint-baseline.json` los perdona por fichero, y un `any` en un componente es un error de lint, no un warning.
- Tocar el registro de fuentes obliga a actualizar **cuatro** listas exactas, y hay un test que lo recuerda: `CULTURE_SOURCE_IDS`, las variantes municipales de `__tests__/source-registry.test.ts`, el enum `source` de `public/openapi.yaml` y el recuento de municipales de `__tests__/popularity.test.ts`.

---

## Task 1: Los dos `tipo` que faltaban, y el guard que faltaba con ellos

El Ayuntamiento declara 14 tipos en el array `filtros` de su respuesta. El registro consume 12: el 14 «Feria» y el 11 «Presentación» no los pedía nadie. Medido el 6 de octubre de 2026, el 14 trae **44** eventos que no salían de ninguna parte —casi todos mercados: "Mercado de Lakua-Arriaga", "Mercado de la Plaza Simón Bolívar", "Mercado dominical de coleccionismo"— y el 11 trae **3**, y los tres son de libro.

Empieza por el guard, porque es lo que convierte un acuerdo en invariante.

**Files:**
- Create: `__tests__/fixtures/sources/municipal-filtros.json`
- Create: `__tests__/sources/municipal-tipos.test.ts`
- Modify: `lib/source-data.ts`
- Modify: `lib/categories.ts`
- Modify: `lib/source-registry.ts`
- Modify: `public/openapi.yaml`
- Modify: `__tests__/source-registry.test.ts`
- Modify: `__tests__/popularity.test.ts`

**Interfaces:**
- Consumes: `loadFixture(name: string): string` y `mockFetchWith(routes: Route[])` de `__tests__/helpers.ts`; `SOURCE_REGISTRY` y `SOURCE_GROUPS` de `@/lib/source-registry`.
- Produces: los ids `municipal-mercados` y `municipal-presentaciones` en el registro, y la categoría `Mercados` en `CATEGORY_COLORS` y `CATEGORY_FILLS`.

- [ ] **Step 1: Capturar la fixture del array `filtros`**

Crea `__tests__/fixtures/sources/municipal-filtros.json` con este contenido. Es la respuesta real del 6 de octubre de 2026, recortada a la parte que declara qué tipos existen:

```json
{
  "_nota": "Array `filtros` de CalendarioServlet con id=tipo, capturado el 2026-10-06. El test solo usa `id` y `texto`. `num` no se asserta: cuenta las filas de la ventana anual y cambia cada semana, asi que un test que lo mirara se pondria rojo sin que nadie hubiera roto nada.",
  "filtros": [
    {
      "id": "tipo",
      "label": "Tipo",
      "default": "Todas",
      "array": [
        { "texto": "Exposición", "num": 446, "id": "7" },
        { "texto": "Charla / Conferencia", "num": 130, "id": "3" },
        { "texto": "Cursos y talleres", "num": 120, "id": "10" },
        { "texto": "Otros", "num": 117, "id": "99" },
        { "texto": "Feria", "num": 79, "id": "14" },
        { "texto": "Visita guiada", "num": 76, "id": "15" },
        { "texto": "Jornada / Evento", "num": 64, "id": "6" },
        { "texto": "Teatro", "num": 60, "id": "13" },
        { "texto": "Concierto", "num": 33, "id": "2" },
        { "texto": "Danza", "num": 10, "id": "4" },
        { "texto": "Proyección audiovisual", "num": 6, "id": "12" },
        { "texto": "Presentación", "num": 5, "id": "11" },
        { "texto": "Fiesta", "num": 5, "id": "9" },
        { "texto": "Concurso / Campeonato", "num": 2, "id": "1" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Escribir el test que falla**

Crea `__tests__/sources/municipal-tipos.test.ts`:

```ts
import { loadFixture, mockFetchWith } from "../helpers";
import { SOURCE_REGISTRY, SOURCE_GROUPS } from "@/lib/source-registry";

/**
 * Los tipos que el Ayuntamiento declara, contra los que el registro consulta.
 *
 * El guard que ya hay en `source-registry.test.ts` prohíbe **cadenas** en `tipo`,
 * que es otra cosa distinta. Este mira la otra mitad: que no quede ningún tipo
 * declarado sin consumir.
 *
 * Los dos que faltaban —el 14 «Feria» y el 11 «Presentación»— estuvieron meses
 * trayendo cero eventos sin que nada lo dijera, y el motivo de que nadie lo viera
 * es que **este test no existía**. Se miraba el tipo de cada entrada una por una,
 * y en las que faltaba no había nada que mirar.
 */

/** El 99 «Otros» lo cubre `municipal-general` sin filtro. Está escrito, no implícito. */
const CUBIERTO_SIN_PEDIR = "99";

const tiposDeclarados = (): Array<{ id: string; texto: string }> => {
  const datos = JSON.parse(loadFixture("municipal-filtros.json")) as {
    filtros: Array<{ id: string; array: Array<{ id: string; texto: string }> }>;
  };
  const declarados = datos.filtros.find((f) => f.id === "tipo");
  if (!declarados) throw new Error("la fixture no trae el filtro de tipo");
  return declarados.array;
};

describe("los tipos que el Ayuntamiento declara", () => {
  it("cada uno está consultado por alguna entrada del registro", async () => {
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    const municipales = SOURCE_REGISTRY.filter((e) => SOURCE_GROUPS[e.id] === "municipal");
    for (const e of municipales) await e.run();

    // `Promise.allSettled` no corre aquí: se llaman en serie y en el mismo orden, así
    // que la llamada n-ésima de `fetch` es la de la variante n-ésima.
    const pedidos = new Set<string>();
    (global.fetch as jest.Mock).mock.calls.forEach((c) => {
      const f = new URL(String(c[0])).searchParams.get("f");
      if (!f) return;
      // El `f` viaja crudo en la query, así que se busca dentro de la cadena en vez
      // de parsear dos veces.
      const m = /"tipo"\s*:\s*\[\s*(\d+)/.exec(decodeURIComponent(f));
      if (m) pedidos.add(m[1]);
    });

    const sinConsultar = tiposDeclarados()
      .map((t) => t.id)
      .filter((id) => !pedidos.has(id))
      .sort();

    expect(sinConsultar).toEqual([CUBIERTO_SIN_PEDIR]);
  });

  it("los tipos que se piden son números, que es lo único que acepta el servlet", () => {
    // Red de seguridad para la otra mitad del problema: una cadena en `tipo` devuelve
    // cero eventos sin dar error, y fue lo que hacía `municipal-visitas` llevar meses
    // filtrando por "visitias guiadas".
    const declarados = new Set(tiposDeclarados().map((t) => t.id));

    for (const id of declarados) {
      expect(Number.isNaN(Number(id))).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Correr el test y verlo fallar**

```
npx jest __tests__/sources/municipal-tipos.test.ts
```

Expected: FAIL en la primera aserción, recibiendo `["11", "14", "99"]` en vez de `["99"]`. Ese array de tres es la prueba de que el guard muerde: hoy solo falta uno de los dos y el rojo señala los tres.

- [ ] **Step 4: Añadir las dos entradas al registro**

En `lib/source-data.ts`, después de `municipal-concursos` y **antes** de `municipal-infantil`, que es la que se come el `dest`:

```ts
  // Los dos tipos que faltaban, medidos el 6 de octubre de 2026. El guard de
  // `__tests__/sources/municipal-tipos.test.ts` es lo que los tiene marcados.
  //
  // El 14 trae 44 eventos que no salían de ninguna parte, y **casi todos son
  // mercados**: "Mercado de Lakua-Arriaga", "Mercado de la Plaza Simón Bolívar",
  // "Mercado de la Plaza Santa Bárbara", "Mercado dominical de coleccionismo",
  // "Mercado de la Almendra", "Feria de bodas". El Ayuntamiento los agrupa bajo
  // "Feria" porque es su taxonomía interna; para quien busca planes un domingo por
  // la mañana, son mercados. Por eso la categoría se llama Mercados aunque el tipo
  // se llame Feria.
  //
  // El 11 trae 3 eventos y los tres son de libro: "Feria del Libro: Coloquio con
  // Palabra Joven", "Feria del Libro: Entrevista y firma con Mikel Santiago",
  // "Presentación de libro". Van a Conferencias, que ya existe: dos de los tres son
  // colloquia y el tercero es una presentación. Una categoría "Libros" con tres
  // eventos obligaría a darle color, peso y página para un cubo que no llega a cinco.
  { id: "municipal-mercados", group: "municipal", label: "Ayuntamiento", category: "Mercados", priority: 0 },
  { id: "municipal-presentaciones", group: "municipal", label: "Ayuntamiento", category: "Conferencias", culture: true, priority: 0 },
```

En `lib/source-registry.ts`, dentro de `RUNNERS`, en el mismo punto:

```ts
  "municipal-mercados": () => scrapeMunicipalCalendar({ tipo: [14] }),
  "municipal-presentaciones": () => scrapeMunicipalCalendar({ tipo: [11] }),
```

- [ ] **Step 5: Añadir el color de Mercados**

En `lib/categories.ts`, en `CATEGORY_COLORS` después de `Senderismo`:

```ts
  Mercados: "#E0A34E",
```

Y en `CATEGORY_FILLS`:

```ts
  Mercados: "#C98934",
```

- [ ] **Step 6: Actualizar las cuatro listas exactas**

- `public/openapi.yaml`: añadir `municipal-mercados, municipal-presentaciones` al enum `source`.
- `__tests__/source-registry.test.ts`: añadir `"municipal-mercados"` y `"municipal-presentaciones"` a `IDS_MUNICIPALES` y a `MUNICIPALES_CON_TAXONOMIA`.
- `__tests__/source-registry.test.ts`: añadir `"municipal-mercados"` al array esperado de `CULTURE_SOURCE_IDS`. **`municipal-presentaciones` no entra**, porque su categoría es Conferencias y eso no es uno de los cuatro cubos de `/culture`, igual que `municipal-concursos`.
- `__tests__/popularity.test.ts`: cambiar `expect(municipales).toHaveLength(16)` a `18`.

- [ ] **Step 7: Correr los tests y verlos pasar**

```
npx jest __tests__/sources/municipal-tipos.test.ts __tests__/source-registry.test.ts __tests__/popularity.test.ts
```

Expected: PASS.

- [ ] **Step 8: Comitear**

```
git add lib/source-data.ts lib/source-registry.ts lib/categories.ts public/openapi.yaml __tests__/fixtures/sources/municipal-filtros.json __tests__/sources/municipal-tipos.test.ts __tests__/source-registry.test.ts __tests__/popularity.test.ts
git commit -m "feat(municipal): los dos tipos que faltaban, y el guard que faltaba con ellos"
```

---

## Task 2: Paginación adaptativa

**Files:**
- Modify: `lib/sources/municipal.ts`
- Modify: `__tests__/sources/municipal.test.ts`

**Interfaces:**
- Consumes: `MunicipalQuery` y `mockFetchWith`, que ya existen.
- Produces: `fetchMunicipalCalendar(options?: MunicipalQuery): Promise<any[]>` con la misma firma de siempre. Las dos funciones nuevas son privadas al módulo y no se exportan.

- [ ] **Step 1: Escribir el test que falla**

Añade a `__tests__/sources/municipal.test.ts`:

```ts
  it("repite la consulta mes a mes cuando la ventana anual satura", async () => {
    // El defecto, medido el 6 de octubre de 2026: `CalendarioServlet` corta a unos 50
    // resultados. Una ventana de 12 meses devuelve 50, el resto se pierde, y no hay
    // ningún error ni ningún log que lo diga.
    //
    // El doble devuelve 50 en la ventana anual y 1 por mes. Esa es la forma real del
    // problema: la consulta anual parece que funciona, y por eso el rojo no llegaba
    // nunca a ninguna parte.
    const anual = Array.from({ length: 50 }, (_, i) => ({
      codigo: `a${i}`,
      titulo: `Anual ${i}`,
      fechaInicio: "20261015",
      datetime: "2026-10-15T00:00:00.000Z",
    }));
    const mensual = (mes: number) => ({
      codigo: `m${mes}`,
      titulo: `Mensual ${mes}`,
      fechaInicio: `2026${String(mes).padStart(2, "0")}15`,
      datetime: `2026-${String(mes).padStart(2, "0")}-15T00:00:00.000Z`,
    });

    mockFetchWith([
      {
        match: /vitoria-gasteiz\.org/,
        content: (url) => {
          const p = new URL(url).searchParams;
          const dias = (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
          if (dias > 200) return JSON.stringify({ actividades: { resultados: anual } });
          const mes = new Date(Number(p.get("fd"))).getMonth() + 1;
          return JSON.stringify({ actividades: { resultados: [mensual(mes)] } });
        },
      },
    ]);

    const eventos = await scrapeMunicipalCalendar();
    const llamadas = (global.fetch as jest.Mock).mock.calls.map((c) => {
      const p = new URL(String(c[0])).searchParams;
      return (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
    });

    // Una sola petición anual, y luego una por mes.
    expect(llamadas.filter((dias) => dias > 200)).toHaveLength(1);
    expect(llamadas.filter((dias) => dias <= 200).length).toBeGreaterThanOrEqual(12);

    // Y lo que se queda son los mensuales, no los de la anual: si se devolvieran los
    // dos, la paginación no habría servido de nada.
    expect(eventos.filter((e) => e.title.startsWith("Anual"))).toHaveLength(0);
    expect(eventos.filter((e) => e.title.startsWith("Mensual")).length).toBeGreaterThanOrEqual(12);
  });
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/sources/municipal.test.ts
```

Expected: FAIL. `llamadas.filter(dias > 200)` da 1 pero el total es 1, así que la segunda aserción falla recibiendo 0; y `Anual` da 50 en vez de 0.

- [ ] **Step 3: Implementar la paginación**

En `lib/sources/municipal.ts`, añade arriba del fichero, después de `MUNICIPAL_BASE`:

```ts
/**
 * Filas a partir de las cuales la respuesta se da por truncada.
 *
 * **El tope del servlet no es un número único, y por eso el umbral no busca el
 * tope.** Medido el 6 de octubre de 2026: una consulta con `tipo` devuelve 50 o 54
 * según el tipo, y la consulta sin filtro —`municipal-general`— devolvió 120 de una
 * vez. El corte va por sección, no por petición.
 *
 * 45 está por debajo de cualquiera de los dos topes. La consecuencia aceptada es que
 * `municipal-general` se pagina siempre: doce peticiones más para la única entrada
 * que ve todos los tipos a la vez. La alternativa sería un umbral por entrada, y un
 * umbral por entrada es una lista mantenida a mano que se pudre el día que el
 * Ayuntamiento añada un tipo, que es lo que pasó dos veces esta semana.
 */
const FILAS_SOSPECHOSAS = 45;

/** Las ventanas de un mes que cubre `[fd, fh]`. El último mes se recorta a `fh`. */
function ventanasDeMes(fd: number, fh: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const d = new Date(fd);
  while (d.getTime() < fh) {
    const hasta = new Date(d);
    hasta.setMonth(hasta.getMonth() + 1);
    out.push([d.getTime(), Math.min(hasta.getTime(), fh)]);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Una ventana del calendario, y si viene llena, sus trozos. */
async function pedirVentana(
  fd: number,
  fh: number,
  filterStr: string,
  profundidad: number
): Promise<any[]> {
  const url = `${MUNICIPAL_BASE}?accion=buscar&idioma=es&calendariosID=196&fd=${fd}&fh=${fh}&deCM=false&moEx=false${filterStr}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(45000) });

  // Propaga, y no devuelve `[]`. Un `return []` aquí se comería el fallo entero:
  // `lib/agenda.ts` usa `Promise.allSettled`, así que una fuente que resuelve con
  // lista vacía es indistinguible de una que no publica nada, y el `logger.warn` solo
  // se dispara en las promesas que rechazan. Con `priority: 0` —la que gana todos los
  // dedupes— eso dejaba la agenda municipal vacía, cacheada, con HTTP 200 y sin una
  // sola línea de log.
  if (!res.ok) {
    throw new Error(`municipal calendar returned ${res.status}`);
  }

  const data = await res.json();
  const eventos = Object.values(data || {}).reduce((acc: any[], seccion: any) => {
    if (seccion?.resultados) acc.push(...seccion.resultados);
    return acc;
  }, []);

  if (eventos.length < FILAS_SOSPECHOSAS) return eventos;

  const dias = (fh - fd) / 86400000;

  // Un mes es el grano más fino que devuelve el conjunto completo, así que por
  // debajo de eso no hay subdivisión que valga: se devuelve lo que vino aunque esté
  // truncado. Un solo nivel de partición, y nada más, que es lo que hace la promesa
  // de requests acotada: 1 + 13 en el peor caso, no 1 + 13 + 13 + 13.
  if (profundidad >= 1 || dias < 32) return eventos;

  if (profundidad === 0) {
    const trozos: any[] = [];
    for (const [desde, hasta] of ventanasDeMes(fd, fh)) {
      trozos.push(...(await pedirVentana(desde, hasta, filterStr, 1)));
    }
    return trozos;
  }

  const mitad = Math.floor(fd + (fh - fd) / 2);
  const [primera, segunda] = await Promise.all([
    pedirVentana(fd, mitad, filterStr, 1),
    pedirVentana(mitad, fh, filterStr, 1),
  ]);
  return [...primera, ...segunda];
}
```

- [ ] **Step 4: Enganchar `fetchMunicipalCalendar`**

En `fetchMunicipalCalendar`, **borra** el `const res = await fetch(...)` entero y el `if (!res.ok) throw`, que ya están dentro de `pedirVentana`, y sustitúyelos por:

```ts
  return pedirVentana(fd, fh, filterStr, 0);
```

El resto —`hoy`, `inicio`, `fin`, `fd`, `fh`, `filterStr`— se queda como está, con `fd` por defecto a la medianoche de hoy y `fh` a dentro de un año. La ventana de doce meses es la primera que se pide y es la que decide si hay que paginar.

- [ ] **Step 5: Correr el test y verlo pasar**

```
npx jest __tests__/sources/municipal.test.ts
```

Expected: PASS.

- [ ] **Step 6: Añadir el test del segundo nivel**

Añade al mismo fichero:

```ts
  it("parte en dos una ventana que también satura", async () => {
    // El segundo nivel existe porque hay un tramo del calendario que trae más de 45
    // cosas y todavía no se sabe cuál es. Con el nivel 0 partiendo por meses, un día
    // cargado se quedaría a medias, y aquí se ve que se parte.
    const de = (n: number, prefijo: string) =>
      JSON.stringify({
        actividades: {
          resultados: Array.from({ length: n }, (_, i) => ({
            codigo: `${prefijo}${i}`,
            titulo: `${prefijo} ${i}`,
            fechaInicio: "20261015",
            datetime: "2026-10-15T00:00:00.000Z",
          })),
        },
      });

    mockFetchWith([
      {
        match: /vitoria-gasteiz\.org/,
        content: (url) => {
          const p = new URL(url).searchParams;
          const dias = (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
          if (dias > 200) return de(50, "Anual");
          if (dias > 10) return de(50, "Mes");
          return de(5, "Mitad");
        },
      },
    ]);

    const eventos = await scrapeMunicipalCalendar();

    expect(eventos.filter((e) => e.title.startsWith("Anual"))).toHaveLength(0);
    expect(eventos.filter((e) => e.title.startsWith("Mes"))).toHaveLength(0);
    // Y hay algo de las mitades, que es lo que demuestra que se llegó al segundo nivel.
    expect(eventos.filter((e) => e.title.startsWith("Mitad")).length).toBeGreaterThan(0);
  });
```

- [ ] **Step 7: Correr todo lo del municipal**

```
npx jest __tests__/sources/municipal.test.ts __tests__/sources/municipal-tipos.test.ts
```

Expected: PASS.

- [ ] **Step 8: Comitear**

```
git add lib/sources/municipal.ts __tests__/sources/municipal.test.ts
git commit -m "fix(municipal): la ventana de un ano llenaba el tope del servlet y se traga el 45%"
```

---

## Task 3: La caché de 2 horas de las entradas municipales

Con 18 entradas y hasta 13 ventanas cada una, un arranque en frío son del orden de 200 peticiones. Con la caché de 5 minutos del `agenda-all`, eso son 200 peticiones cada 5 minutos contra un servidor municipal.

**Files:**
- Modify: `lib/source-data.ts`
- Modify: `__tests__/source-registry.test.ts`

**Interfaces:**
- Consumes: `cacheTtlMs` de `SourceData`, que `lib/agenda.ts:147-152` ya respeta. `rula` ya lo usa como precedente.
- Produces: `cacheTtlMs: 2 * 60 * 60 * 1000` en las 18 entradas municipales salvo `municipal-rss`.

- [ ] **Step 1: Escribir el test que falla**

Añade a `__tests__/source-registry.test.ts`:

```ts
  it("las entradas municipales que paginan declaran cacheTtlMs", () => {
    // `municipal-rss` va por RSS y no pagina, así que su ritmo lo decide `agenda-all`.
    const SIN_CAPA = new Set(["municipal-rss"]);

    const sinCapa = SOURCE_DATA.filter(
      (e) => e.group === "municipal" && !e.cacheTtlMs && !SIN_CAPA.has(e.id)
    );

    expect(sinCapa.map((e) => e.id)).toEqual([]);
  });
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/source-registry.test.ts
```

Expected: FAIL con las 18 ids en el array recibido.

- [ ] **Step 3: Poner el TTL**

En `lib/source-data.ts`, cada entrada municipal lleva su propio campo:

```ts
  // 2 h como `rula`, y por el mismo motivo de fondo: una fuente que pega fuerte y
  // gordo al servidor necesita su propia capa. Aquí el peso no son 6,5 MB por
  // petición, son hasta 13 peticiones por arranque.
  cacheTtlMs: 2 * 60 * 60 * 1000,
```

A las 17 que paginan. `municipal-rss` se queda sin el campo a propósito.

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/source-registry.test.ts __tests__/agenda.test.ts
```

Expected: PASS. El segundo fichero es el que comprueba que una entrada con `cacheTtlMs` no rompe el agregado.

- [ ] **Step 5: Comitear**

```
git add lib/source-data.ts __tests__/source-registry.test.ts
git commit -m "perf(municipal): dos horas de cache propia, que pagina hasta trece veces"
```

---

## Task 4: Medir el arranque en frío y ajustar si toca

No es una tarea de código: es la que decide si la estrategia aguanta. El umbral de corte está escrito en el spec y se decide con el número, no antes.

**Files:** ninguno, salvo que el número obligue a tocar `lib/sources/municipal.ts`.

**Interfaces:**
- Consumes: el servidor de desarrollo y `/api/v1/events`.

- [ ] **Step 1: Arrancar en frío y medir cuatro veces**

```
npm run dev
```

Con el servidor arriba, en otra terminal, cuatro veces seguidas:

```
curl -s -o NUL -w "%{time_total}\n" http://localhost:3000/api/v1/events
```

Se anotan los cuatro. Cuatro y no uno porque así se midió el problema original, y porque la dispersión fue justo lo que-justo-delató el corte: 5,6 s, 19,7 s, 5,8 s y 6,1 s.

- [ ] **Step 2: Comparar con la referencia**

Los cuatro valores están en el comentario de `lib/sources/municipal.ts`, en el tramo del timeout. Si los nuevos quedan por debajo de 30 s, la estrategia aguanta y la tarea se cierra sin tocar código.

- [ ] **Step 3: Si alguno pasa de 30 s, aplicar el recorte del spec**

El recorte es este y no otro: `FILAS_SOSPECHOSAS` sube de 45 a **70**. Con eso la paginación solo la hacen los tipos que de verdad truncan, y los que llegaban a 50 se quedan con la consulta de siempre.

Hay que actualizar también la constante y **su comentario**, con la medición que justifica el número nuevo. Un número medido con su motivo es la norma del repo; un número cambiado sin él es deuda.

- [ ] **Step 4: Comitear si hubo cambio**

```
git add lib/sources/municipal.ts
git commit -m "perf(municipal): el umbral sube a 70, medido, porque con 45 el arranque pasa de 30s"
```

Si no hubo cambio, la tarea se cierra con las cuatro cifras recogidas y no commitea nada.

---

## Verificación del plan

```
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Los cuatro en verde, con los 878 tests de antes más los nuevos. Si algo falla y no es de este plan, se arregla antes de seguir.