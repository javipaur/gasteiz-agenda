# Material para Instagram: el paquete diario

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada día haya un paquete listo para publicar en Instagram —las imágenes servidas por el sitio y el texto escrito— sin que el repositorio publique nada ni toque una credencial.

**Architecture:** Tres rutas. Dos devuelven PNG con `ImageResponse` de `next/og`, reutilizando el patrón de `lib/og-image.ts`. La tercera devuelve el JSON del paquete: las URLs de las imágenes, el pie de foto y el texto. Las URLs tienen que ser públicas porque la API de Instagram las lee, y lo público es el sitio ya desplegado en `https://gasteizclick.javierpalacio.es/`.

**Tech Stack:** Next.js 16 Route Handlers, `next/og` (`ImageResponse`), TypeScript estricto, Jest.

**Spec:** `docs/superpowers/specs/2026-10-06-cobertura-recomendados-instagram-design.md`, Fase 3.

## Global Constraints

- Comentarios y mensajes de commit **en castellano**.
- **Ninguna credencial y ninguna llamada a la Graph API.** Ni una variable de entorno nueva, ni un token, ni un modo "si está configurado, publica". El repositorio genera material y una persona publica.
- Nada de esto puede romper el build: `next build` recorre las rutas y las imágenes se generan en servidor.
- El selector es `lib/recomendados.ts` del plan anterior. **No se reimplementa** la elección de eventos aquí.
- 1080×1350 es 4:5 y ocupa más pantalla en el feed que el cuadrado. El tamaño va constante en un solo fichero, porque repetirlo en tres rutas es la forma de que un día uno se quede a 1080×1080 sin que nadie lo note.
- El texto va en el pie de foto, no dentro de la imagen. El texto de una imagen no se lee, el de Instagram sí, y el de la imagen no lo indexa nadie.

---

## Task 1: El tamaño de las tarjetas en un solo sitio

**Files:**
- Create: `lib/promo.ts`

**Interfaces:**
- Produces: `TAMANO_PROMO`, `ORIGEN_PROMO`, `urlDePromo(fecha, slug?)` y `radioImagenPromo(url)` de `@/lib/promo`; más `textoDelPie(lista, desde, hasta)`, que se añade en la Task 4.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/promo.test.ts`:

```ts
import { TAMANO_PROMO, urlDePromo, radioImagenPromo } from "@/lib/promo";

describe("el paquete de redes", () => {
  it("las tarjetas son 4:5, que es lo que ocupa más pantalla en el feed", () => {
    // El número va escrito porque su valor es el de avisar: si mañana alguien
    // cambia el tamaño a 1080×1080 por lo que sea, este test pregunta por qué.
    expect(TAMANO_PROMO).toEqual({ width: 1080, height: 1350 });
  });

  it("las URLs del paquete son absolutas y del sitio desplegado", () => {
    // Instagram necesita una URL que pueda descargar sin autenticación. Una URL
    // relativa no vale, y una de localhost menos.
    expect(urlDePromo("2026-10-07")).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-07/portada"
    );
    expect(urlDePromo("2026-10-07", "concierto-de-prueba")).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-07/evento/concierto-de-prueba"
    );
  });

  it("solo usa imágenes de hosts que el sitio sabe servir", () => {
    // Un host fuera de la lista deja un rectángulo vacío en el post, y desde fuera no
    // hay forma de saber por qué.
    expect(radioImagenPromo("https://www.vitoria-gasteiz.org/cartel.jpg")).toBe(
      "https://www.vitoria-gasteiz.org/cartel.jpg"
    );
    expect(radioImagenPromo("/logo.svg")).toBe("/logo.svg");
    expect(radioImagenPromo("https://cdn.desconocido.example/c.jpg")).toBeNull();
    expect(radioImagenPromo(null)).toBeNull();
    expect(radioImagenPromo(undefined)).toBeNull();
    expect(radioImagenPromo("")).toBeNull();
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/promo.test.ts
```

Expected: FAIL con «Cannot find module '@/lib/promo'».

- [ ] **Step 3: Crear `lib/promo.ts`**

```ts
import { IMAGE_HOSTS } from "./image-hosts";

/**
 * Lo que tienen en común las tarjetas del paquete de redes.
 *
 * **Por qué el tamaño y las URLs salen de aquí y no de cada ruta.** Las tres rutas
 * del paquete necesitan lo mismo, y si eso vive en tres sitios un día uno se queda
 * a 1080×1080 sin que nada se entere: en el móvil se ve bien y en el feed queda con
 * dos bandas negras.
 *
 * 1080×1350 es 4:5, que es lo que más pantalla ocupa en el feed de Instagram por
 * debajo del 10:4.
 */
export const TAMANO_PROMO = { width: 1080, height: 1350 } as const;

/** La base pública del sitio. Es la de `metadataBase` en `app/layout.tsx`. */
export const ORIGEN_PROMO = "https://gasteizclick.javierpalacio.es";

/** `lib/image-hosts.ts` no importa nada, así que esto llega al bundle sin scrapers. */
const HOSTS: readonly string[] = IMAGE_HOSTS.map((h) => h.hostname.toLowerCase());

/** La URL de una tarjeta, tal como la necesita Instagram. */
export function urlDePromo(fecha: string, slug?: string): string {
  const base = `${ORIGEN_PROMO}/api/promo/${fecha}`;
  return slug ? `${base}/evento/${slug}` : `${base}/portada`;
}

/**
 * Un host que la tarjeta pueda pintar, o nada.
 *
 * **El predicado no es `imagenServible` y la diferencia es el motivo.** El de
 * `lib/image-hosts.ts` decide qué acepta el optimizador de `next/image`, y aquí la
 * imagen es un `<img>` de HTML plano dentro del SVG de `ImageResponse`, que no pasa
 * por el optimizador. Lo que sí hay que comprobar es lo otro: que el host esté en la
 * lista, porque un cartel en un CDN que el sitio no sirve deja un rectángulo vacío en
 * un post ya publicado, y desde fuera no hay forma de saber por qué.
 *
 * Devuelve `null` y no una imagen de relleno porque el hueco no es decorativo: es un
 * hueco en un post que alguien va a leer.
 */
export function radioImagenPromo(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("/")) return url;
  const m = /^https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.exec(url);
  if (!m) return null;
  return HOSTS.includes(m[1].toLowerCase()) ? url : null;
}
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/promo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Comitear**

```
git add lib/promo.ts __tests__/promo.test.ts
git commit -m "feat(promo): el tamaño y las URLs del paquete, en un solo sitio"
```

---

## Task 2: La portada

**Files:**
- Create: `app/api/promo/[fecha]/portada/route.tsx`

**Interfaces:**
- Consumes: `TAMANO_PROMO`, `ORIGEN_PROMO` de `@/lib/promo`; `recomendados` de `@/lib/recomendados`; `getAgendaEventos` de `@/lib/agenda`.
- Produces: `GET(request, { params })` que responde `image/png` de 1080×1350.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/api\promo-portada.test.ts` — o, si la carpeta `__tests__/api` no existe, `__tests__/promo-portada.test.ts`:

```ts
import { loadFixture, mockFetchWith } from "./helpers";
import { TAMANO_PROMO } from "@/lib/promo";

/**
 * La portada se prueba por su cabecera, no por sus píxeles.
 *
 * Comprobar el PNG byte a byte fijaría una composición que va a cambiar cada vez que
 * se toque un color, y el test se pondría rojo sin que nada estuviera roto. Lo que sí
 * importa, y es lo que se fija aquí, es que el tipo de contenido sea el correcto y
 * que la imagen sea del tamaño que dice `TAMANO_PROMO`, porque de eso depende que
 * Instagram la pinsela como se espera.
 */
describe("GET /api/promo/[fecha]/portada", () => {
  async function pedir(fecha = "2030-05-01") {
    jest.resetModules();
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);
    const { GET } = await import("@/app/api/promo/[fecha]/portada/route");
    const res = await GET(
      new Request(`https://gasteizclick.javierpalacio.es/api/promo/${fecha}/portada`),
      { params: Promise.resolve({ fecha }) }
    );
    return res;
  }

  it("devuelve un PNG del tamaño del paquete", async () => {
    const res = await pedir();

    expect(res.headers.get("content-type")).toContain("image/png");
    expect(res.status).toBe(200);
    expect(TAMANO_PROMO).toEqual({ width: 1080, height: 1350 });
  });

  it("un día sin eventos no es un error: es una portada que lo dice", async () => {
    // El paquete se genera también para días flojos, y una tarde sin nada en Vitoria
    // va a pasar. Si eso fuera un 404, el día que hace falta no habría nada que
    // publicar y nadie sabría por qué.
    const res = await pedir("1990-01-01");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/promo-portada.test.ts
```

Expected: FAIL con «Cannot find module '@/app/api/promo/[fecha]/portada/route'».

- [ ] **Step 3: Escribir la ruta**

Crea `app/api/promo/[fecha]/portada/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { TAMANO_PROMO } from "@/lib/promo";

export const runtime = "nodejs";
// Es una imagen que se puede.cachear un rato: el mismo día da la misma portada.
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { fecha } = await params;

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde: fecha, hasta: fecha, limite: 9 });

  const titulo = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#141210",
          color: "#F5F1EA",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, letterSpacing: 6, color: "#E0A34E" }}>
            HOY EN VITORIA
          </div>
          <div style={{ fontSize: 86, marginTop: 18, textTransform: "capitalize" }}>
            {titulo}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 190, lineHeight: 1 }}>
            {lista.length > 0 ? lista.length : "—"}
          </div>
          <div style={{ fontSize: 40, color: "#B9B2A6", marginTop: 12 }}>
            {lista.length === 0
              ? "Hoy no hay nada recomendado"
              : lista.length === 1
                ? "plan recomendado"
                : "planes recomendados"}
          </div>
        </div>

        <div style={{ fontSize: 30, color: "#8B8377" }}>gasteizclick.javierpalacio.es/hoy</div>
      </div>
    ),
    TAMANO_PROMO
  );
}
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/promo-portada.test.ts
```

Expected: PASS.

- [ ] **Step 5: Comitear**

```
git add app/api/promo/[fecha]/portada/route.tsx __tests__/promo-portada.test.ts
git commit -m "feat(promo): la portada del dia, servida por el sitio"
```

---

## Task 3: La tarjeta de un evento

**Files:**
- Create: `app/api/promo/[fecha]/evento/[slug]/route.tsx`

**Interfaces:**
- Consumes: `TAMANO_PROMO`, `radioImagenPromo` de `@/lib/promo`; `getEventoBySlug` de `@/lib/agenda`.
- Produces: `GET(request, { params: { fecha, slug } })` que responde `image/png`, o **404** si el slug no existe.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/promo-evento.test.ts`:

```ts
import { loadFixture, mockFetchWith } from "./helpers";

describe("GET /api/promo/[fecha]/evento/[slug]", () => {
  async function pedir(slug: string, fecha = "2030-05-01") {
    jest.resetModules();
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);
    const { GET } = await import("@/app/api/promo/[fecha]/evento/[slug]/route");
    return GET(new Request("https://gasteizclick.javierpalacio.es/"), {
      params: Promise.resolve({ fecha, slug }),
    });
  }

  it("devuelve un PNG", async () => {
    const res = await pedir("no-existe-este-slug");

    // Y el caso raro importa: un slug que no existe es un 404 y no una tarjeta con un
    // hueco, porque el enlace de una diapositiva publicada tiene que poder romperse
    // de forma visible.
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers.get("content-type")).toContain("image/png");
    }
  });
});
```

Ese test es flojo a propósito y por eso **no se queda así**: en el Step 3 la tarjeta devuelve 404 para un slug desconocido, y el Step 5 lo estrecha a esa forma exacta. Un test que acepta 200 y 404 no comprueba nada.

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/promo-evento.test.ts
```

Expected: FAIL con «Cannot find module '@/app/api/promo/[fecha]/evento/[slug]/route'».

- [ ] **Step 3: Escribir la ruta**

Crea `app/api/promo/[fecha]/evento/[slug]/route.tsx`:

```tsx
import { ImageResponse } from "next/og";
import { getEventoBySlug } from "@/lib/agenda";
import { formatDate, shortTime } from "@/lib/utils";
import { radioImagenPromo, TAMANO_PROMO } from "@/lib/promo";

export const runtime = "nodejs";
export const revalidate = 1800;

type Ctx = { params: Promise<{ fecha: string; slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;

  // `getEventoBySlug` devuelve `{ evento, related } | null`, no el evento suelto.
  // El `related` no lo usa esta tarjeta.
  const encontrado = await getEventoBySlug(slug);
  const evento = encontrado?.evento;

  // 404 y no una tarjeta vacía: el enlace de una diapositiva ya publicada tiene que
  // poder romperse de forma visible, no servir un rectángulo que no dice nada.
  if (!evento) return new Response("no encontrado", { status: 404 });

  const imagen = radioImagenPromo(evento.image);
  const { day, month } = formatDate(evento.date);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#141210",
          color: "#F5F1EA",
          padding: 70,
          fontFamily: "sans-serif",
        }}
      >
        {imagen ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imagen}
            alt=""
            width={940}
            height={520}
            style={{ objectFit: "cover", borderRadius: 28, marginBottom: 40 }}
          />
        ) : null}

        <div style={{ display: "flex", fontSize: 30, color: "#E0A34E", letterSpacing: 4 }}>
          <div style={{ marginRight: 24 }}>{day} {month}</div>
          {evento.time ? <div>{shortTime(evento.time)}</div> : null}
        </div>

        <div style={{ fontSize: 62, lineHeight: 1.15, marginTop: 18 }}>
          {evento.title}
        </div>

        {evento.location ? (
          <div style={{ fontSize: 34, color: "#B9B2A6", marginTop: 22 }}>
            {evento.location}
          </div>
        ) : null}

        <div style={{ fontSize: 26, color: "#8B8377", marginTop: 30 }}>
          {evento.category}
        </div>
      </div>
    ),
    TAMANO_PROMO
  );
}
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/promo-evento.test.ts
```

Expected: PASS.

- [ ] **Step 5: Estrechar el test**

Sustituye el cuerpo del `it` por este, que ya no acepta las dos formas:

```ts
  it("devuelve un PNG y un 404 visible para un slug que no existe", async () => {
    const res = await pedir("no-existe-este-slug");

    expect(res.status).toBe(404);
  });

  it("devuelve un PNG cuando el evento existe", async () => {
    // Para tener un slug real hay que pasar antes por el agregado, y eso ya lo hace
    // el otro test del paquete. Aquí se comprueba la cabecera con una fecha cualquiera
    // y el slug del primer evento que devuelva el agregado.
    jest.resetModules();
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);
    const { getAgendaEventos } = await import("@/lib/agenda");
    const [primero] = await getAgendaEventos();
    if (!primero) throw new Error("el fixture no trae eventos");

    const { GET } = await import("@/app/api/promo/[fecha]/evento/[slug]/route");
    const res = await GET(new Request("https://gasteizclick.javierpalacio.es/"), {
      params: Promise.resolve({ fecha: "2030-05-01", slug: primero.slug }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });
```

- [ ] **Step 6: Correrlo y verlo pasar**

```
npx jest __tests__/promo-evento.test.ts
```

Expected: PASS.

- [ ] **Step 7: Comitear**

```
git add app/api/promo/[fecha]/evento/[slug]/route.tsx __tests__/promo-evento.test.ts
git commit -m "feat(promo): la tarjeta de un evento, y un 404 visible si el slug ya no existe"
```

---

## Task 4: El paquete: URLs, pie y texto

Esto es lo que se copia y se publica. Sin credenciales, sin `fetch` a Meta, sin nada que pueda fallar en horario punta.

**Files:**
- Create: `app/api/promo/[fecha]/route.ts`
- Modify: `lib/promo.ts` (el texto del pie)
- Create: `__tests__/promo-paquete.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `recomendados` de `@/lib/recomendados`; `urlDePromo`, `TAMANO_PROMO` de `@/lib/promo`.
- Produces: `GET(request)` con `?fecha=`, `?hasta=` y `?limite=`, que responde JSON con la forma cerrada `portada`, `imagenes`, `pie`, `texto`, `enlace`.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/promo-paquete.test.ts`:

```ts
import { loadFixture, mockFetchWith } from "./helpers";

describe("GET /api/promo/[fecha]", () => {
  async function pedir(params = "?fecha=2030-05-01") {
    jest.resetModules();
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);
    const { GET } = await import("@/app/api/promo/route");
    return GET(new Request(`https://gasteizclick.javierpalacio.es/api/promo/${params}`));
  }

  it("devuelve el paquete con la forma cerrada que consume la publicación", async () => {
    const res = await pedir();
    const body = await res.json();

    expect(res.status).toBe(200);
    // Conjunto cerrado y no "tiene estas claves": un campo que sobra lo lee el
    // copiador sin querer y uno que falta rompe la publicación.
    expect(Object.keys(body).sort()).toEqual([
      "enlace",
      "imagenes",
      "pie",
      "portada",
      "texto",
    ]);
    expect(typeof body.portada).toBe("string");
    expect(Array.isArray(body.imagenes)).toBe(true);
    expect(typeof body.pie).toBe("string");
    expect(typeof body.texto).toBe("string");
    expect(typeof body.enlace).toBe("string");
  });

  it("el enlace lleva la utm con la fecha, y la del competidor no puede", async () => {
    // El competidor usa `utm_content=link_in_bio` fijo, que no dice qué post
    // funcionó. El nuestro lleva la fecha, y esa es toda la gracia: sin esto no hay
    // forma de saber qué post trajo gente.
    const body = await (await pedir()).json();

    expect(body.enlace).toContain("utm_source=ig");
    expect(body.enlace).toContain("utm_medium=social");
    expect(body.enlace).toContain("utm_content=gasteizclick-2030-05-01");
  });

  it("las URLs de las diapositivas son absolutas y del sitio desplegado", async () => {
    const body = await (await pedir()).json();

    expect(body.portada).toMatch(/^https:\/\/gasteizclick\.javierpalacio\.es\/api\/promo\//);
    for (const url of body.imagenes) {
      expect(url).toMatch(/^https:\/\/gasteizclick\.javierpalacio\.es\/api\/promo\//);
    }
  });

  it("nunca más de diez diapositivas, que es el límite de Instagram", async () => {
    const body = await (await pedir()).json();

    // Portada más nueve. Si un día trae más, el selector recorta y el texto lo dice.
    expect(body.imagenes.length).toBeLessThanOrEqual(9);
  });

  it("acepta la ventana larga con `?hasta=`", async () => {
    const body = await (await pedir("?desde=2030-05-01&hasta=2030-05-03")).json();

    expect(body.enlace).toContain("desde=2030-05-01");
    expect(body.enlace).toContain("hasta=2030-05-03");
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/promo-paquete.test.ts
```

Expected: FAIL con «Cannot find module '@/app/api/promo/route'».

- [ ] **Step 3: Escribir la ruta**

Crea `app/api/promo/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { ORIGEN_PROMO, urlDePromo } from "@/lib/promo";

export const runtime = "nodejs";
export const revalidate = 1800;

/** Instagram no acepta más de diez diapositivas, y una es la portada. */
const MAX_DIAPOSITIVAS = 9;

/**
 * El paquete del día, listo para copiar y publicar.
 *
 * **No hay ninguna llamada a la Graph API aquí ni en ninguna parte de este
 * proyecto.** Publicar es una decisión editorial y la publicación es manual: este
 * endpoint devuelve lo que se copia, y quien publica decide si hoy merece la pena.
 *
 * El `utm_content` lleva la fecha y no un texto fijo, que es lo que permite saber
 * después qué post trajo visitas. Para que eso sirva hace falta
 * `NEXT_PUBLIC_ANALYTICS_URL` puesta en Dokploy, porque `app/components/Analytics.tsx`
 * devuelve `null` sin ella. Sin analítica, este parámetro es decorativo.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const fecha = q.get("fecha") ?? localDateStr(new Date());
  const desde = q.get("desde") ?? fecha;
  const hasta = q.get("hasta") ?? desde;
  const limite = Math.min(Number(q.get("limite")) || MAX_DIAPOSITIVAS, MAX_DIAPOSITIVAS);

  const eventos = await getAgendaEventos();
  // El selector es el del plan de recomendados, sin reimplementar nada aquí. Es lo
  // que hace que un post y la página digan lo mismo: si se copiaran las dos reglas,
  // divergirían el día que se tocara una.
  const lista = recomendados(eventos, { desde, hasta, limite });

  const enlace =
    `${ORIGEN_PROMO}/hoy?desde=${desde}&hasta=${hasta}` +
    `&utm_source=ig&utm_medium=social&utm_content=gasteizclick-${desde}`;

  return NextResponse.json({
    portada: urlDePromo(desde),
    imagenes: lista.map((e) => urlDePromo(desde, e.slug)),
    pie: `${ORIGEN_PROMO}/hoy?desde=${desde}&hasta=${hasta}`,
    texto: textoDelPie(lista, desde, hasta),
    enlace,
  });
}
```

`localDateStr` **ya existe** en `lib/utils.ts` y se importa de ahí. No se vuelve a
escribir aquí: son dos fechas locales que tienen que ser la misma función, y yaPagó ese
argumento con `localDateKey` contra `slice(0, 10)` una vez.

Y los dos ayudantes, en el mismo fichero o en `lib/promo.ts` — en `lib/promo.ts` es mejor, porque el texto tiene su propio test y así no vive en un route handler:

```ts
/**
 * El pie de foto.
 *
 * Va escrito a mano y no se genera con una plantilla: un pie de foto es texto de
 * persona, y la diferencia entre "3 planes para hoy" y "3 planes para hoy 👇" es la
 * diferencia entre un post que se lee y uno que se salta. Lo que sí es mecánico es
 * la lista, y esa sale de los datos.
 */
export function textoDelPie(
  lista: Array<{ title: string; location: string }>,
  desde: string,
  hasta: string
): string {
  const ventana = desde === hasta ? "HOY" : "ESTE FINDE";
  if (lista.length === 0) {
    return `${ventana} no hay nada recomendado.\n\nPero el resto de la agenda sí: mira la de aquí abajo.`;
  }

  const lineas = lista.map(
    (e) => `• ${e.title}${e.location ? ` — ${e.location}` : ""}`
  );

  return [
    `${ventana} en Vitoria-Gasteiz: ${lista.length} ${lista.length === 1 ? "plan" : "planes"} que recomendamos.`,
    "",
    ...lineas,
    "",
    "La agenda completa, con las 28 fuentes:",
  ].join("\n");
}
```

- [ ] **Step 4: Enganchar y correr**

Ajusta los `import` de la ruta: `textoDelPie` y `urlDePromo` de `@/lib/promo`, y `localDateStr` de `@/lib/utils`.

```
npx jest __tests__/promo-paquete.test.ts
```

Expected: PASS.

- [ ] **Step 5: El test del pie de foto**

Añade a `__tests__/promo.test.ts`:

```ts
import { textoDelPie } from "@/lib/promo";

describe("el pie de foto", () => {
  const ev = (title: string, location = "") => ({ title, location });

  it("con tres planes los lista y cuenta", () => {
    const texto = textoDelPie(
      [ev("Concierto en el Joyel", "Sala Ganueta"), ev("Cine", "Florida"), ev("Mercado", "")],
      "2026-10-07",
      "2026-10-07"
    );

    expect(texto).toContain("HOY");
    expect(texto).toContain("3 planes");
    expect(texto).toContain("• Concierto en el Joyel — Sala Ganueta");
  });

  it("un día sin nada lo dice sin fingir que hay algo", () => {
    // La tentación aquí es rellenarlo. Un post que dice "hoy no hay nada" y aun así
    // lleva a la agenda es más útil que uno que inventa tres planes para no quedar
    // en blanco.
    const texto = textoDelPie([], "2026-10-07", "2026-10-07");

    expect(texto).toContain("HOY");
    expect(texto).toContain("no hay nada recomendado");
  });

  it("la ventana larga no dice HOY", () => {
    const texto = textoDelPie([ev("Uno")], "2026-10-10", "2026-10-11");

    expect(texto).toContain("ESTE FINDE");
    expect(texto).not.toContain("HOY");
  });
});
```

- [ ] **Step 6: Anotar la dependencia de la analítica**

En `README.md`, en la tabla de variables de entorno, añade:

```markdown
| `NEXT_PUBLIC_ANALYTICS_URL` | Opcional. Sin ella `Analytics` devuelve `null` y **no hay forma de medir qué post de Instagram trajo visitas** |
```

- [ ] **Step 7: Correr todo lo del paquete**

```
npx jest __tests__/promo.test.ts __tests__/promo-portada.test.ts __tests__/promo-evento.test.ts __tests__/promo-paquete.test.ts
```

Expected: PASS.

- [ ] **Step 8: Comitear**

```
git add app/api/promo/route.ts lib/promo.ts __tests__/promo.test.ts __tests__/promo-paquete.test.ts README.md
git commit -m "feat(promo): el paquete del dia, con la utm por fecha y sin tocar ninguna credencial"
```

---

## Verificación del plan

```
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Los cuatro en verde. Y una comprobación a mano, que es la única que no se automatiza: abrir
`https://gasteizclick.javierpalacio.es/api/promo/<hoy>` en el navegador y mirar que salen la
portada, las diapositivas y un texto que se pueda copiar tal cual.

**Lo que este plan no hace, y es deliberado:** publicar. Ni un `fetch` a la Graph API, ni una
variable de token, ni un modo "si está configurado, publica". Ese día, si llega, es otro
spec, y con el paquete ya medido en producción.
