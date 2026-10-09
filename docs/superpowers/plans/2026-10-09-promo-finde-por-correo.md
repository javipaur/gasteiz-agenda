# El resumen del fin de semana, por correo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el viernes por la mañana llegue un correo con el carrusel del fin de semana ya hecho —imágenes numeradas y en orden, texto del pie para copiar y pegar, y el enlace con la utm de la fecha— y que una persona lo monte y lo publique.

**Architecture:** Una hoja pura (`lib/promo.ts`) que sabe calcular la ventana del fin de semana y armar el paquete; una capa que sabe convertir ese paquete en correo (`lib/promo-correo.ts`); `lib/mail.ts` aprende adjuntos; y un programa (`scripts/enviar-promo-finde.ts`) que es lo que corre el cron. El repositorio no publica: no hay token de Instagram, ni Graph API, ni nada que pueda banear una cuenta.

**Tech Stack:** Node 22 + `tsx`, nodemailer, `ImageResponse` de `next/og` (ya existente, no se toca), Jest.

**Spec:** `docs/superpowers/specs/2026-10-09-promo-finde-por-correo-design.md`

## Global Constraints

- Comentarios y mensajes de commit **en castellano**.
- **Ninguna credencial nueva de terceros.** Este plan no añade ningún token de una red social. La única variable que añade es `PROMO_PARA`, una dirección de correo.
- **Sin `fetch` al propio despliegue.** El script llama a `getAgendaEventos()` y `getAgendaSalud()` directamente, como `scripts/send-newsletter.ts` después de la Fase 1. Un script del repo no debe depender de que su propio despliegue le deje pasar.
- **El repositorio no publica en Instagram.** Ni ahora ni en este plan. Publicar es un paso manual.
- **Las imágenes viajan dos veces en el correo**: una entrada `inline` con `cid` para verse en el cuerpo, y otra `attachment` con nombre para el clip. No hay un camino único entre clientes de correo, y son 1–3 MB.
- Los títulos vienen de 28 sitios sin esquema: **todo lo que va al HTML pasa por `escapeHtml`**.
- **Fechas locales**, nunca UTC. `jest.config.ts` fija `TZ=Europe/Madrid` en el proceso principal y llega heredada a los workers.
- Salida con código 1 en todo fallo, para que Dokploy no lo tome por bueno.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Estado |
|---|---|---|
| `lib/promo.ts` | Ventana del fin de semana y armado del paquete. Hoja pura. | Modifica |
| `lib/promo-correo.ts` | Convertir un paquete en asunto y cuerpo de correo. | Nuevo |
| `lib/promo-ficheros.ts` | Descargar las imágenes, armar los adjuntos y escribirlas en disco. | Nuevo |
| `lib/email.ts` | Exportar `escapeHtml`, que ya existe pero es privado. | Modifica |
| `lib/mail.ts` | Adjuntos. | Modifica |
| `scripts/enviar-promo-finde.ts` | El programa que corre el cron. | Nuevo |
| `app/api/promo/route.ts` | Envoltorio de `paqueteDePromo`. | Modifica |
| `__tests__/fin-de-semana.test.ts` | La ventana del fin de semana. | Nuevo |
| `__tests__/promo-paquete.test.ts` | La hoja pura del paquete, más la ruta. | Modifica |
| `__tests__/promo-correo.test.ts` | Asunto y cuerpo del correo. | Nuevo |
| `__tests__/mail-adjuntos.test.ts` | Adjuntos en `sendMail`. | Nuevo |
| `__tests__/enviar-promo-finde.test.ts` | El programa y sus dos puertas. | Nuevo |

---

## Task 1: La ventana del fin de semana

El calendario es la pieza que puede mandar el finde equivocado, y el caso dangerouso es el domingo: la regla ingenua de "sábado más próximo mayor o igual que hoy" devolvería el siguiente, que es justo cuando ya está empezando.

**Files:**
- Modify: `lib/promo.ts`
- Create: `__tests__/fin-de-semana.test.ts`

**Interfaces:**
- Consumes: `localDateStr` de `@/lib/utils`.
- Produces: `finDeSemanaDe(hoy: string): { desde: string; hasta: string }` de `@/lib/promo`. Recibe y devuelve `YYYY-MM-DD`.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/fin-de-semana.test.ts`:

```ts
import { finDeSemanaDe } from "@/lib/promo";

/**
 * Los cinco días de la semana, no un ejemplo.
 *
 * La tabla del spec cubre los cinco, y no por completado: los cuatro que se
 * comportan como espera cualquiera son jueves, viernes, sábado y lunes. El que
 * decide si esta función es correcta es el **domingo**, porque es el único que
 * devuelve un finde ya empezado y el único donde la regla evidente está mal.
 */
describe("la ventana del fin de semana", () => {
  it("de jueves salta al sábado siguiente", () => {
    expect(finDeSemanaDe("2026-10-08")).toEqual({
      desde: "2026-10-10",
      hasta: "2026-10-11",
    });
  });

  it("de viernes salta al sábado siguiente, que es mañana", () => {
    expect(finDeSemanaDe("2026-10-09")).toEqual({
      desde: "2026-10-10",
      hasta: "2026-10-11",
    });
  });

  it("de sábado se queda en el de hoy", () => {
    expect(finDeSemanaDe("2026-10-10")).toEqual({
      desde: "2026-10-10",
      hasta: "2026-10-11",
    });
  });

  it("de domingo se queda en el que empieza hoy en vez de saltar al siguiente", () => {
    // Este es el test que muerde. `2026-10-11` es domingo: el sábado más próximo
    // mayor o igual que hoy es el 17, y mandar el finde del 17 el domingo por la
    // mañana es mandar el finde equivocado el día que el bueno empieza.
    expect(finDeSemanaDe("2026-10-11")).toEqual({
      desde: "2026-10-10",
      hasta: "2026-10-11",
    });
  });

  it("de lunes salta al sábado de la semana que viene", () => {
    expect(finDeSemanaDe("2026-10-12")).toEqual({
      desde: "2026-10-17",
      hasta: "2026-10-18",
    });
  });

  it("cruza el cambio de mes sin inventarse un día", () => {
    expect(finDeSemanaDe("2026-10-29")).toEqual({
      desde: "2026-10-31",
      hasta: "2026-11-01",
    });
  });

  it("una fecha que no parsea lanza en vez de devolver NaN-NaN-NaN", () => {
    // El mismo modo de fallo que `recomendados` ya cubre: comparar contra un
    // `Invalid Date` con `<=` deja pasar todo, y `localDateStr` de un `Invalid
    // Date` da la cadena "NaN-NaN-NaN" en vez de fallar. Un script que se
    // comiera eso acabaría en `https://…/api/promo/NaN-NaN-NaN/portada`, y un
    // 404 de eso no dice qué ha ido mal.
    expect(() => finDeSemanaDe("no-es-una-fecha")).toThrow(/no-es-una-fecha/);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/fin-de-semana.test.ts
```

Expected: FAIL con «finDeSemanaDe is not a function» o «is not exported».

- [ ] **Step 3: Implementarlo**

Añade al final de `lib/promo.ts`:

```ts
/**
 * El sábado y el domingo del finde que toca, y lo quiere decir "el que toca".
 *
 * **La regla es "el fin de semana en curso o el más próximo por venir", no "el
 * siguiente sábado".** Las dos se parecen hasta el domingo, y el domingo es
 * exactamente cuando se diferencian: el 11 de octubre de 2026 la regla ingenua
 * devolvería el 17, y el cron de la mañana mandaría el finde equivocado el día que
 * empieza el bueno.
 *
 * **Por eso la fecha es un argumento y no un `new Date()` dentro.** Con la fecha
 * fuera, la tabla de los cinco días de la semana es un test, y sin ella es una
 * afirmación. Es la misma razón por la que `agenda.ts` agrupa por día local.
 */
export function finDeSemanaDe(hoy: string): { desde: string; hasta: string } {
  const dia = new Date(`${hoy}T12:00:00`);
  if (isNaN(dia.getTime())) {
    throw new Error(`finDeSemanaDe necesita una fecha YYYY-MM-DD, y recibió "${hoy}"`);
  }

  // `getDay()` es 0 el domingo y 6 el sábado. El mediodía evita el borde del
  // cambio de hora: con medianoche, un día que cambia de hora local se
  // desplaza de sábado a viernes o al revés.
  const diaSemana = dia.getDay();

  if (diaSemana === 0) {
    // Domingo: el finde que empieza hoy. Se queda, no salta.
    return { desde: sumarDias(hoy, -1), hasta: hoy };
  }

  if (diaSemana === 6) {
    // Sábado: el de hoy.
    return { desde: hoy, hasta: sumarDias(hoy, 1) };
  }

  // De lunes a viernes: el sábado más próximo por venir.
  const desde = sumarDias(hoy, 6 - diaSemana);
  return { desde, hasta: sumarDias(desde, 1) };
}

/** Suma días a una fecha local y la vuelve a escribir como `YYYY-MM-DD`. */
function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return localDateStr(d);
}
```

Y el import, al principio de `lib/promo.ts`, junto a los otros dos:

```ts
import { localDateStr } from "./utils";
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/fin-de-semana.test.ts
```

Expected: PASS.

- [ ] **Step 5: Comitear**

```bash
git add lib/promo.ts __tests__/fin-de-semana.test.ts
git commit -m "feat(promo): la ventana del finde, que el domingo no salta al siguiente"
```

---

## Task 2: El paquete como hoja pura

Hoy el paquete se construye dentro del route handler, así que un script no podría reutilizarlo sin copiarlo. Esto lo saca a una hoja pura y deja la ruta como envoltorio. La forma de la respuesta no cambia: lo comprueba el test que ya existe.

**Files:**
- Modify: `lib/promo.ts`
- Modify: `app/api/promo/route.ts`
- Modify: `__tests__/promo-paquete.test.ts`

**Interfaces:**
- Consumes: `recomendados` de `@/lib/recomendados`; `urlDePromo`, `textoDelPie`, `ORIGEN_PROMO` de `@/lib/promo`.
- Produces: `MAX_DIAPOSITIVAS` y `paqueteDePromo(lista, { desde, hasta })` de `@/lib/promo`. La ruta sigue exportando `GET` y sigue respondiendo la misma forma de 5 claves.

- [ ] **Step 1: Escribir el test que falla**

Lo primero es **sacar `pedir` fuera del `describe`**. Hoy está declarado dentro de
`describe("GET /api/promo/[fecha]")`, y el `describe` de abajo lo necesita para poder
comparar la hoja con la ruta. Súbelo tal cual, sin tocar su cuerpo, hasta dejarlo justo
debajo de los imports del fichero:

```ts
async function pedir(params = "?fecha=2030-05-01") {
  jest.resetModules();
  mockFetchWith([
    { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
  ]);
  const { GET } = await import("@/app/api/promo/route");
  return GET(new Request(`https://gasteizclick.javierpalacio.es/api/promo/${params}`));
}
```

Y quita de dentro del `describe` la declaración que ahora está arriba.

Después añade, debajo de ese `describe`, los imports que falten y el bloque nuevo:

```ts
import { paqueteDePromo, MAX_DIAPOSITIVAS } from "@/lib/promo";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";

const ev = (slug: string) => ({ slug, title: `Evento ${slug}`, location: "Sala X" });

/**
 * La hoja pura del paquete, probada sin HTTP y sin scrapers.
 *
 * El `describe` de la ruta que ya hay en este fichero sigue siendo el que
 * comprueba el contrato de `/api/promo`. Este comprueba la otra mitad: que la hoja
 * hace lo mismo que hacía la ruta, para que un script pueda usarla sin hablar con
 * el despliegue.
 */
describe("paqueteDePromo", () => {
  it("arma la forma cerrada con la lista que le dan, sin volver a seleccionar", () => {
    const paquete = paqueteDePromo([ev("a"), ev("b")], {
      desde: "2026-10-10",
      hasta: "2026-10-11",
    });

    expect(Object.keys(paquete).sort()).toEqual([
      "enlace",
      "imagenes",
      "pie",
      "portada",
      "texto",
    ]);
    // La portada usa `desde`, no `hasta`: la cabecera es del sábado aunque la
    // ventana sean dos días.
    expect(paquete.portada).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-10/portada"
    );
    expect(paquete.imagenes).toEqual([
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-10/evento/a",
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-10/evento/b",
    ]);
  });

  it("una lista vacía no es un error: es un paquete que lo dice", () => {
    const paquete = paqueteDePromo([], { desde: "2026-10-10", hasta: "2026-10-11" });

    expect(paquete.imagenes).toEqual([]);
    expect(paquete.texto).toContain("no hay nada recomendado");
  });

  it("el tope de diapositivas vive con el paquete, no en la ruta", () => {
    // Diez es el límite de Instagram contando la portada. Si el número se queda
    // en la ruta, el script que la quite se queda sin él.
    expect(MAX_DIAPOSITIVAS).toBe(9);
  });

  it("la hoja y la ruta dicen lo mismo", async () => {
    // El test que de verdad importa: si la ruta dejara de llamar a la hoja, esto
    // se pondría rojo el día que se tocara una de las dos.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);
    const eventos = await getAgendaEventos();
    const lista = recomendados(eventos, {
      desde: "2030-05-01",
      hasta: "2030-05-02",
      limite: MAX_DIAPOSITIVAS,
    });

    const hoja = paqueteDePromo(lista, { desde: "2030-05-01", hasta: "2030-05-02" });
    const viaRuta = await (await pedir("?desde=2030-05-01&hasta=2030-05-02")).json();

    expect(viaRuta).toEqual(hoja);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/promo-paquete.test.ts
```

Expected: FAIL con «paqueteDePromo is not exported» o «MAX_DIAPOSITIVAS is not exported».

- [ ] **Step 3: Implementar la hoja**

Añade a `lib/promo.ts`, en el bloque de imports de arriba del todo, **junto a los dos que
ya hay**:

```ts
import { recomendados } from "./recomendados";
```

El import de `localDateStr` lo puso la Task 1 y no hay que volver a añadirlo.

El de `recomendados` **no arrastra nada al bundle de cliente**, y conviene saber por
qué antes de añadirlo: `lib/promo.ts` solo lo importan la ruta de `/api/promo` y los
tests, ningún componente cliente, y `recomendados` → `popularity` es aritmética pura.
Está comprobado, no supuesto.

```ts
import { recomendados } from "./recomendados";

/** Instagram no acepta más de diez diapositivas, y una es la portada. */
export const MAX_DIAPOSITIVAS = 9;

/** La forma que consume la publicación. Cerrada: un campo que sobra lo lee sin querer. */
export type PaquetePromo = {
  portada: string;
  imagenes: string[];
  pie: string;
  texto: string;
  enlace: string;
};

/**
 * El paquete del día, listo para copiar y publicar.
 *
 * **Recibe la lista ya seleccionada y no los eventos**, y el motivo es que quien
 * llama es quien ha llamado al selector: el script necesita quedarse con la lista
 * para poner el título de cada diapositiva bajo su imagen en el correo. Si esta
 * función recibiera los eventos y llamara a `recomendados` por dentro, el script
 * tendría que volver a seleccionar para tener los títulos, y dos llamadas al
 * selector son dos reglas que divergen el día que se toque una.
 *
 * **No hay ninguna llamada a la Graph API aquí ni en ninguna parte de este
 * proyecto.** Publicar es una decisión editorial y la publicación es manual: esto
 * devuelve lo que se manda por correo, y quien lo publica decide si el finde lo
 * merece.
 */
export function paqueteDePromo(
  lista: Array<{ slug: string; title: string; location: string }>,
  { desde, hasta }: { desde: string; hasta: string }
): PaquetePromo {
  const ventana = `${ORIGEN_PROMO}/hoy?desde=${desde}&hasta=${hasta}`;
  return {
    portada: urlDePromo(desde),
    imagenes: lista.map((e) => urlDePromo(desde, e.slug)),
    pie: ventana,
    texto: textoDelPie(lista, desde, hasta),
    enlace: `${ventana}&utm_source=ig&utm_medium=social&utm_content=gasteizclick-${desde}`,
  };
}
```

- [ ] **Step 4: Dejar la ruta como envoltorio**

Sustituye todo el cuerpo de `app/api/promo/route.ts` por esto:

```ts
import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";
import { recomendados } from "@/lib/recomendados";
import { MAX_DIAPOSITIVAS, paqueteDePromo } from "@/lib/promo";
import { localDateStr } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 1800;

/**
 * El paquete del día. Ya no lo construye: lo llama.
 *
 * **El armado vive en `lib/promo.ts` desde que el correo del fin de semana lo
 * necesita sin hablar con este despliegue.** Una copia de estas reglas en el
 * script y otra aquí divergirían el día que se tocara una, y las dos seguirían
 * funcionando: ese es el fallo caro, el que nadie ve.
 *
 * **Sin carpeta de fecha.** El path es `/api/promo` y la ventana va en la query, y no
 * al revés, porque quien copia la URL de aquí escribe la que le sale: meter `fecha` en
 * el path obligaría a construirla a mano, que es donde aparecen los typos que nadie ve
 * hasta que el post ya está publicado.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const fecha = q.get("fecha") ?? localDateStr(new Date());
  const desde = q.get("desde") ?? fecha;
  const hasta = q.get("hasta") ?? desde;
  const limite = Math.min(Number(q.get("limite")) || MAX_DIAPOSITIVAS, MAX_DIAPOSITIVAS);

  const eventos = await getAgendaEventos();
  // El selector es el de `lib/recomendados.ts`, sin reimplementar nada aquí.
  const lista = recomendados(eventos, { desde, hasta, limite });

  return NextResponse.json(paqueteDePromo(lista, { desde, hasta }));
}
```

- [ ] **Step 5: Correrlo y verlo pasar**

```
npx jest __tests__/promo-paquete.test.ts __tests__/promo.test.ts
```

Expected: PASS. Los tests de la ruta que ya existían siguen en verde, y eso es lo que prueba que la respuesta no ha cambiado.

- [ ] **Step 6: Comitear**

```bash
git add lib/promo.ts app/api/promo/route.ts __tests__/promo-paquete.test.ts
git commit -m "refactor(promo): el paquete sale de la ruta, para que el correo use la misma"
```

---

## Task 3: El correo

El HTML se construye a mano, y eso quita la protección que en el resto del proyecto da React por defecto. Los títulos vienen de 28 sitios sin esquema, así que un `"><img src=x onerror=...>` en un título acabaría en el buzón de quien publica.

**Files:**
- Create: `lib/promo-correo.ts`
- Modify: `lib/email.ts` (exportar `escapeHtml`)
- Create: `__tests__/promo-correo.test.ts`

**Interfaces:**
- Consumes: `escapeHtml` de `@/lib/email`; `PaquetePromo` de `@/lib/promo`.
- Produces: `asuntoDelCorreo(desde, hasta, total): string` y `htmlDelCorreo(paquete, titulos): string` de `@/lib/promo-correo`.

- [ ] **Step 1: Exportar `escapeHtml`**

En `lib/email.ts:52`, cambia `function escapeHtml(` por `export function escapeHtml(`.

No cambia nada de su comportamiento: sigue escapando `&`, `<`, `>`, `"` y `'`. Lo que cambia es que otro módulo puede usarlo en vez de escribir el suyo, que es la forma de que escapen unos sí y otros no.

- [ ] **Step 2: Escribir el test que falla**

Crea `__tests__/promo-correo.test.ts`:

```ts
import { asuntoDelCorreo, htmlDelCorreo } from "@/lib/promo-correo";

const PAQUETE = {
  portada: "https://gasteizclick.javierpalacio.es/api/promo/2026-10-10/portada",
  imagenes: [
    "https://gasteizclick.javierpalacio.es/api/promo/2026-10-10/evento/a",
    "https://gasteizclick.javierpalacio.es/api/promo/2026-10-10/evento/b",
  ],
  pie: "https://gasteizclick.javierpalacio.es/hoy?desde=2026-10-10&hasta=2026-10-11",
  texto: "ESTE FINDE en Vitoria-Gasteiz: 2 planes que recomendamos.",
  enlace:
    "https://gasteizclick.javierpalacio.es/hoy?desde=2026-10-10&hasta=2026-10-11&utm_source=ig&utm_medium=social&utm_content=gasteizclick-2026-10-10",
};

describe("el correo del paquete", () => {
  it("el asunto dice la ventana y cuántos planes son", () => {
    expect(asuntoDelCorreo("2026-10-10", "2026-10-11", 2)).toBe("Finde 10–11 oct · 2 planes");
  });

  it("el asunto no dice 'planes' cuando es uno", () => {
    expect(asuntoDelCorreo("2026-10-10", "2026-10-10", 1)).toBe("Hoy 10 oct · 1 plan");
  });

  it("cada imagen va numerada desde 01, en orden, con su cid", () => {
    const html = htmlDelCorreo(PAQUETE, ["Portada", "Concierto en el Joyel"]);

    // La numeración empieza en 01 para que el orden nunca se tenga que deducir, y
    // la primera es la portada: es lo que se sube antes.
    expect(html).toContain('src="cid:promo-01"');
    expect(html).toContain('src="cid:promo-02"');
    expect(html).toContain("01 · Portada");
    expect(html).toContain("02 · Concierto en el Joyel");
  });

  it("el texto del pie va en texto plano para copiar y pegar", () => {
    const html = htmlDelCorreo(PAQUETE, ["Portada", "Concierto"]);

    // Un `<div>` con saltos de línea es un texto que se copia con el formato por
    // medio. Va en `<pre>` con `white-space: pre-wrap`, que copia el texto pelado.
    expect(html).toContain("<pre");
    expect(html).toContain("white-space:pre-wrap");
    expect(html).toContain("ESTE FINDE en Vitoria-Gasteiz: 2 planes que recomendamos.");
  });

  it("el enlace sale visible, con la utm, y no solo escondido en un botón", () => {
    const html = htmlDelCorreo(PAQUETE, ["Portada", "Concierto"]);

    expect(html).toContain(`href="${PAQUETE.enlace}"`);
    expect(html).toContain("utm_content=gasteizclick-2026-10-10");
  });

  it("escapa un título con HTML dentro", () => {
    // El motivo de existir de `escapeHtml`: los títulos vienen de 28 sitios sin
    // esquema. Sin esto, `"><img src=x onerror=alert(1)>` llega tal cual al
    // cliente de correo de quien publica.
    const html = htmlDelCorreo(PAQUETE, ["Portada", '"><img src=x onerror=alert(1)>']);

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&quot;&gt;&lt;img src=x");
  });
});
```

- [ ] **Step 3: Correrlo y verlo fallar**

```
npx jest __tests__/promo-correo.test.ts
```

Expected: FAIL con «Cannot find module '@/lib/promo-correo'».

- [ ] **Step 4: Crear `lib/promo-correo.ts`**

```ts
import { escapeHtml } from "./email";
import type { PaquetePromo } from "./promo";

/**
 * El correo del paquete: asunto y cuerpo.
 *
 * **El HTML se construye a mano y por eso escapa.** En el resto del proyecto React
 * escapa por debajo; aquí no hay nada que lo haga. Los títulos vienen de 28 sitios
 * sin esquema —`raw.title` solo pasa por `.trim()` en `normalizeRaw`—, así que sin
 * `escapeHtml` un título con `"><img src=x onerror=...>` llega al buzón de quien
 * publica. Con cliente que ejecuta JS sería XSS; sin él, inyección de enlace.
 */
const e = escapeHtml;

/** "10 oct" a partir de un `YYYY-MM-DD`. Local, por el mismo motivo que el resto. */
function diaMes(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  const meses = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

/**
 * El asunto dice la ventana y el número, porque el número es la pregunta que se
 * hace al abrir el correo.
 */
export function asuntoDelCorreo(desde: string, hasta: string, total: number): string {
  const ventana =
    desde === hasta ? diaMes(desde) : `${diaMes(desde)}–${diaMes(hasta)}`;
  const etiqueta = desde === hasta ? "Hoy" : "Finde";
  return `${etiqueta} ${ventana} · ${total} ${total === 1 ? "plan" : "planes"}`;
}

/**
 * El cuerpo, con las imágenes en línea por `cid`.
 *
 * **El `cid` tiene que coincidir con el campo `cid` del adjunto** de nodemailer, y es
 * lo que hace que el cliente de correo baje la imagen de ahí en vez de ir a una URL.
 * No es una imagen por URL: es una imagen adjunta que además se muestra.
 */
export function htmlDelCorreo(paquete: PaquetePromo, titulos: string[]): string {
  const slides = ["Portada", ...titulos]
    .map(
      (titulo, i) => `
        <tr><td style="padding:0 0 28px 0">
          <img src="cid:promo-${indice(i)}" width="540" alt="${e(titulo)}"
               style="width:100%;max-width:540px;display:block;border-radius:14px;border:1px solid #e7e5e4" />
          <p style="margin:10px 0 0;font:600 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
            ${indice(i)} · ${e(titulo)}
          </p>
        </td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#faf9f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f5">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0"
           style="width:540px;max-width:100%">

      <tr><td style="padding:0 0 8px 0;font:700 12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;
                     letter-spacing:0.14em;color:#a16207">
        GASTEIZ CLICK · PUBLICAR A MANO
      </td></tr>

      <tr><td style="padding:0 0 20px 0;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
        Las imágenes van numeradas. Súbelas a Instagram en ese orden: la <strong>01</strong> es
        la portada y las siguientes, una por diapositiva.
      </td></tr>

      ${slides}

      <tr><td style="padding:4px 0 0 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:#fff;border:1px solid #e7e5e4;border-radius:14px">
          <tr><td style="padding:18px 20px">
            <p style="margin:0 0 10px;font:700 13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
              Texto del pie — cópialo tal cual
            </p>
            <pre style="margin:0;white-space:pre-wrap;font:400 14px/1.7 -apple-system,Segoe UI,Roboto,sans-serif;color:#292524">${e(paquete.texto)}</pre>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 0 0 0;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#57534e">
        Enlace del post:<br />
        <a href="${e(paquete.enlace)}" style="color:#b91c1c;word-break:break-all">${e(paquete.enlace)}</a>
      </td></tr>

      <tr><td style="padding:28px 0 0 0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#a8a29e">
        Generado por el sitio, sin tocar ninguna credencial de ninguna red social.
        Publicar es manual y es una decisión editorial.
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** `01`, `02`, … El ancho fijo es lo que mantiene el orden legible de un vistazo. */
function indice(i: number): string {
  return String(i + 1).padStart(2, "0");
}
```

- [ ] **Step 5: Correrlo y verlo pasar**

```
npx jest __tests__/promo-correo.test.ts
```

Expected: PASS.

- [ ] **Step 6: Comitear**

```bash
git add lib/promo-correo.ts lib/email.ts __tests__/promo-correo.test.ts
git commit -m "feat(promo-correo): el asunto y el cuerpo, con los titulos escapados"
```

---

## Task 4: Adjuntos en el correo

Es el único cambio en código compartido de todo el plan, y por eso va solo: toca el módulo que usan el newsletter, las confirmaciones y el alta.

**Files:**
- Modify: `lib/mail.ts`
- Create: `__tests__/mail-adjuntos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `SendMailOptions.attachments?: Adjunto[]`, reenviado a nodemailer sin transformar. El tipo `Adjunto` es exportado.

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/mail-adjuntos.test.ts`:

```ts
/**
 * `sendMail` learndo a llevar adjuntos.
 *
 * Nodemailer los soporta y el tipo no los declaraba, así que no había forma de
 * mandarlos sin salirse de la función. Es el único cambio en código compartido de
 * todo el plan, y por eso tiene su propio test: lo que se rompe aquí se rompe en
 * el newsletter también.
 */
const sendMailNodemailer = jest.fn().mockResolvedValue({ messageId: "x" });

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: () => ({ sendMail: (...a: unknown[]) => sendMailNodemailer(...a) }),
  },
}));

type Env = Record<string, string | undefined>;

function conEntorno<T>(cambios: Env, hacer: () => T): T {
  const previo = { ...process.env };
  Object.assign(process.env, cambios);
  try {
    return hacer();
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, previo);
  }
}

describe("sendMail con adjuntos", () => {
  beforeEach(() => {
    sendMailNodemailer.mockClear();
    // El transporte se cachea en el módulo, y la caché no se invalida entre
    // pruebas: sin estas dos variables, la primera prueba que corre decide para
    // todas. Es la razón por la que `lib/mail.ts` lee el entorno en la llamada.
    process.env.EMAIL_USER = "cuenta@ejemplo.test";
    process.env.EMAIL_PASS = "clave";
  });

  it("reenvía los adjuntos a nodemailer sin tocarlos", async () => {
    const { sendMail } = await import("@/lib/mail");
    const content = Buffer.from("png falso");

    const res = await sendMail({
      to: "yo@ejemplo.test",
      subject: "Finde",
      html: "<p>hola</p>",
      attachments: [
        { filename: "01-portada.png", content, contentDisposition: "inline", cid: "promo-01" },
        { filename: "01-portada.png", content, contentDisposition: "attachment" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(sendMailNodemailer).toHaveBeenCalledTimes(1);
    const enviado = sendMailNodemailer.mock.calls[0][0] as {
      attachments: Array<Record<string, unknown>>;
    };
    expect(enviado.attachments).toHaveLength(2);
    expect(enviado.attachments[0]).toEqual({
      filename: "01-portada.png",
      content,
      contentDisposition: "inline",
      cid: "promo-01",
    });
  });

  it("sin adjuntos, el envío es exactamente el de antes", async () => {
    // Si esto cambia, se ha roto el newsletter en silencio: sigue funcionando y
    // ya no lleva nada raro, que es peor.
    const { sendMail } = await import("@/lib/mail");

    await sendMail({ to: "yo@ejemplo.test", subject: "Finde", html: "<p>hola</p>" });

    const enviado = sendMailNodemailer.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado.attachments).toBeUndefined();
  });

  it("sigue fallando explícito en producción sin credenciales, con adjuntos o sin ellos", async () => {
    const { sendMail } = await import("@/lib/mail");

    const res = await conEntorno(
      { EMAIL_USER: undefined, EMAIL_PASS: undefined, NODE_ENV: "production" },
      () =>
        sendMail({
          to: "yo@ejemplo.test",
          subject: "Finde",
          html: "<p>hola</p>",
          attachments: [
            { filename: "01.png", content: Buffer.from("x"), contentDisposition: "attachment" },
          ],
        })
    );

    // La regla no cambia por añadir un campo: un mock devolvería `ok: true` y el
    // cron daría el paquete por enviado sin que nadie lo recibiera.
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/mail-adjuntos.test.ts
```

Expected: FAIL. `attachments` no está en el tipo, así que TypeScript no lo acepta y el primer test no compila.

- [ ] **Step 3: Añadir el campo**

En `lib/mail.ts`, sustituye el bloque `export type SendMailOptions` por esto:

```ts
/**
 * Un adjunto del correo.
 *
 * **Los mismos tres campos que nodemailer, sin transformar.** La razón de que las
 * imágenes viajen dos veces —una `inline` con `cid` y otra `attachment`— es que
 * no hay un camino único entre clientes de correo: el que funciona en Gmail no es el
 * que funciona en el cliente por defecto de iOS. Duplicarlas son 1–3 MB, y Gmail
 * aguanta 25 MB.
 */
export type Adjunto = {
  filename: string;
  content: Buffer;
  contentDisposition: "inline" | "attachment";
  /** Solo para `inline`: el `src="cid:..."` del HTML apunta aquí. */
  cid?: string;
};

export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Adjunto[];
};
```

Y en la llamada al transporte, dentro de `sendMail`, cambia:

```ts
    await transporter.sendMail({
      from: `Gasteiz Click <${user}>`,
      to,
      subject,
      html,
      text: text || undefined,
    });
```

por:

```ts
    await transporter.sendMail({
      from: `Gasteiz Click <${user}>`,
      to,
      subject,
      html,
      text: text || undefined,
      // Se pasa tal cual, o el `cid` de la imagen en línea no llega al HTML y el
      // correo sale con los huecos donde iban las fotos.
      attachments: attachments || undefined,
    });
```

Y la desestructuración de la función, que hoy es `{ to, subject, html, text }`, pasa a:

```ts
export async function sendMail({
  to,
  subject,
  html,
  text,
  attachments,
}: SendMailOptions): Promise<SendMailResult> {
```

- [ ] **Step 4: Correrlo y verlo pasar**

```
npx jest __tests__/mail-adjuntos.test.ts __tests__/send-newsletter.test.ts __tests__/email-escape.test.ts
```

Expected: PASS. Los otros dos son los que comprueban que el newsletter no se ha roto.

- [ ] **Step 5: Comitear**

```bash
git add lib/mail.ts __tests__/mail-adjuntos.test.ts
git commit -m "feat(mail): los adjuntos llegan a nodemailer, con el cid de la imagen en linea"
```

---

## Task 5: El programa

La pieza que corre el cron. Lo importante son las dos puertas, y sobre todo que **no se comportan igual**, porque una de las dos no puede escribir lo que no es fiable.

**Files:**
- Create: `scripts/enviar-promo-finde.ts`
- Create: `__tests__/enviar-promo-finde.test.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `finDeSemanaDe`, `paqueteDePromo`, `MAX_DIAPOSITIVAS` de `@/lib/promo`; `asuntoDelCorreo`, `htmlDelCorreo` de `@/lib/promo-correo`; `getAgendaEventos`, `getAgendaSalud` de `@/lib/agenda`; `recomendados` de `@/lib/recomendados`; `sendMail` de `@/lib/mail`; `localDateStr` de `@/lib/utils`.
- Produces: `main(): Promise<void>` de `scripts/enviar-promo-finde.ts`, más `npm run promo:finde`.
- Lee del entorno: `PROMO_PARA` (obligatoria para enviar), `PROMO_DESTINO` (opcional, dónde escribir los ficheros; por defecto `data/promo`).

- [ ] **Step 1: Escribir el test que falla**

Crea `__tests__/enviar-promo-finde.test.ts`:

```ts
/**
 * `scripts/enviar-promo-finde.ts`, probado como lo que es: un programa.
 *
 * Y lo que más importa aquí no es que mande correo, sino **cuándo no lo manda**. Las
 * dos puertas son el motivo por el que esto se puede automatizar: sin ellas, un
 * scraper caído produce un post con tres eventos y nadie se entera, porque un `[]`
 * por fallo es indistinguible de un finde flojo. Ese es el modo de fallo que este
 * repo ya corrigió una vez en `municipal`, `rula`, `farmacias` y `search`.
 *
 * **`descargarImagenes` y la escritura en disco NO van mockeados.** Van de verdad
 * contra un `fetch` falso y un directorio temporal, porque un test que no descarga
 * nada no puede comprobar ni por dónde se descargó ni qué se escribió. Lo único
 * mockeado es lo que de verdad no tiene sentido en un test: la red y el correo.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { finDeSemanaDe } from "@/lib/promo";
import { localDateStr } from "@/lib/utils";

const getAgendaEventos = jest.fn();
const getAgendaSalud = jest.fn();
const sendMail = jest.fn();

jest.mock("@/lib/agenda", () => ({
  getAgendaEventos: () => getAgendaEventos(),
  getAgendaSalud: () => getAgendaSalud(),
}));

jest.mock("@/lib/mail", () => ({
  sendMail: (...a: unknown[]) => (sendMail as (...x: unknown[]) => unknown)(...a),
}));

type Main = () => Promise<void>;

function cargarScript(): Main {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/scripts/enviar-promo-finde") as { main: Main };
  return mod.main;
}

const BIEN = { sourcesTotal: 37, sourcesOk: 37, sourcesFallidas: [], completa: true };

/**
 * Los eventos van con la fecha de la ventana real, no con una fecha escrita.
 *
 * **Es la trampa del fixture que se pudre, y aquí pegaría fuerte**: la ventana se
 * mueve sola con el calendario, así que con `2026-10-10` a pelo el test pasa hoy y
 * tumba dentro de dos días sin que nadie haya tocado nada. Es lo mismo que
 * `loadFixtureWithFutureDates` hace por otro lado.
 */
const VENTANA = finDeSemanaDe(localDateStr(new Date()));

function evento(i: number) {
  return {
    slug: `evento-${i}`,
    title: `Evento ${i}`,
    location: "Sala X",
    date: `${VENTANA.desde}T20:00:00`,
    image: "https://www.vitoria-gasteiz.org/x.jpg",
  };
}

function eventos(n: number) {
  return Array.from({ length: n }, (_, i) => evento(i));
}

describe("el script del finde", () => {
  let exitPrevio: typeof process.exitCode;
  let destino: string;
  let dirEsperado: string;
  let pedidas: string[];
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    exitPrevio = process.exitCode;
    process.exitCode = undefined;
    process.env.PROMO_PARA = "yo@ejemplo.test";

    destino = await mkdtemp(join(tmpdir(), "promo-"));
    dirEsperado = join(destino, VENTANA.desde);
    process.env.PROMO_DESTINO = destino;

    // El `fetch` falso devuelve PNG de mentira y **guarda las URLs pedidas**, que es
    // lo único que permite comprobar que solo se piden imágenes del paquete.
    pedidas = [];
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation((async (u: string) => {
      pedidas.push(String(u));
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      };
    }) as unknown as typeof fetch);

    getAgendaEventos.mockReset().mockResolvedValue(eventos(3));
    getAgendaSalud.mockReset().mockResolvedValue(BIEN);
    sendMail.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.exitCode = exitPrevio;
    fetchSpy.mockRestore();
    delete process.env.PROMO_PARA;
    delete process.env.PROMO_DESTINO;
  });

  it("las únicas peticiones son las imágenes del paquete, nunca su propio despliegue", async () => {
    // Este es el test que muerde. Si alguien vuelve a pedir `/api/promo` o
    // `/api/actividades/*` por HTTP, esto falla aunque las rutas sigan públicas.
    // El `toBeGreaterThan(0)` no es decorativo: sin él, un `every()` sobre un
    // array vacío pasa sin comprobar nada, y ese fue el primer borrador de este
    // test.
    await cargarScript()();

    expect(pedidas.length).toBeGreaterThan(0);
    expect(pedidas.every((u) => u.includes("/api/promo/"))).toBe(true);
    expect(pedidas.some((u) => u.includes("?desde="))).toBe(false);
  });

  it("escribe portada, diapositivas y paquete.json en disco", async () => {
    await cargarScript()();

    const ficheros = await readdir(dirEsperado);
    expect(ficheros).toContain("01-portada.png");
    expect(ficheros).toContain("02-evento-0.png");
    expect(ficheros).toContain("paquete.json");
  });

  it("manda el paquete a PROMO_PARA y sale con 0", async () => {
    await cargarScript()();

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "yo@ejemplo.test" });
    expect(process.exitCode).toBeUndefined();
  });

  it("escribe los ficheros antes de mandar el correo", async () => {
    // El motivo es que, si el envío falla, lo que se necesita ya está en disco. Se
    // comprueba desde dentro del propio envío: cuando se le llama, la portada ya
    // está escrita.
    let yaEstaba = false;
    sendMail.mockImplementation(async () => {
      yaEstaba = (await readdir(dirEsperado)).includes("01-portada.png");
      return { ok: true };
    });

    await cargarScript()();

    expect(yaEstaba).toBe(true);
  });

  it("cada imagen viaja dos veces: en línea con cid y como adjunto", async () => {
    await cargarScript()();

    const opciones = sendMail.mock.calls[0][0] as {
      attachments: Array<{ contentDisposition: string; cid?: string }>;
    };
    const enLinea = opciones.attachments.filter((a) => a.contentDisposition === "inline");
    const colgadas = opciones.attachments.filter((a) => a.contentDisposition === "attachment");
    // Portada más tres diapositivas, y cada una dos veces.
    expect(enLinea).toHaveLength(4);
    expect(colgadas).toHaveLength(4);
    expect(enLinea[0].cid).toBe("promo-01");
    expect(enLinea[1].cid).toBe("promo-02");
  });

  it("sin destinatario escribe los ficheros, no manda correo y sale con 1", async () => {
    delete process.env.PROMO_PARA;

    await cargarScript()();

    expect(existsSync(dirEsperado)).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("si el envío falla, sale con 1 aunque los ficheros ya estén escritos", async () => {
    sendMail.mockResolvedValue({ ok: false, error: "SMTP caído" });

    await cargarScript()();

    expect(existsSync(join(dirEsperado, "01-portada.png"))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  describe("la puerta de salud", () => {
    it("con una fuente caída no manda correo, no escribe nada y sale con 1", async () => {
      // Ni ficheros: si el agregado está a medias, el paquete que saliera de ahí
      // es medio finde, y dejar medio paquete en disco es dejarlo a un clic de
      // publicarse.
      getAgendaSalud.mockResolvedValue({ ...BIEN, sourcesFallidas: ["rula"] });

      await cargarScript()();

      expect(existsSync(dirEsperado)).toBe(false);
      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("con el agregado incompleto tampoco", async () => {
      getAgendaSalud.mockResolvedValue({ ...BIEN, completa: false });

      await cargarScript()();

      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });

  describe("la puerta del mínimo", () => {
    it("con dos planes escribe los ficheros, no manda correo y sale con 1", async () => {
      // Aquí sí se escribe: el paquete existe y solo es fino, y quien lo encuentre
      // en el disco decide si lo publica.
      getAgendaEventos.mockResolvedValue(eventos(2));

      await cargarScript()();

      expect(existsSync(dirEsperado)).toBe(true);
      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("con tres planes pasa", async () => {
      await cargarScript()();

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Correrlo y verlo fallar**

```
npx jest __tests__/enviar-promo-finde.test.ts
```

Expected: FAIL con «Cannot find module '@/scripts/enviar-promo-finde'».

- [ ] **Step 3: Crear `lib/promo-ficheros.ts`**

Este módulo existe porque el test necesita poder sustituir la escritura en disco sin tocar el sistema de ficheros, que en Windows deja ficheros bloqueados y tumba la suite.

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Adjunto } from "./mail";

/** Una imagen ya descargada, con el número con el que se sube y el nombre que lleva. */
export type ImagenDescargada = {
  /** `01`, `02`, … Es lo que va al `cid` y al principio del nombre del fichero. */
  indice: string;
  /** El nombre sin número: `portada`, o el slug del evento. */
  nombre: string;
  content: Buffer;
};

/** El nombre completo, en disco y en el adjunto. */
function nombreCompleto(img: ImagenDescargada): string {
  return `${img.indice}-${img.nombre}`;
}

/**
 * Baja las imágenes del paquete y las deja numeradas.
 *
 * **Baja del despliegue y no de un fichero local**, porque el paquete ya existe como
 * URLs públicas servidas por el sitio: `/api/promo` está en `PUBLIC_API_NAMESPACES`
 * justo para eso. Es la misma puerta por la que Meta las descargaría.
 */
export async function descargarImagenes(urls: string[]): Promise<ImagenDescargada[]> {
  return Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar ${url}: HTTP ${res.status}`);
      return {
        indice: String(i + 1).padStart(2, "0"),
        nombre: i === 0 ? "portada" : slugDe(url),
        content: Buffer.from(await res.arrayBuffer()),
      };
    })
  );
}

/** El último tramo de la URL es el slug del evento. */
function slugDe(url: string): string {
  return url.split("/").pop() ?? "evento";
}

/**
 * Los adjuntos, dos veces.
 *
 * **No es un descuido.** No hay un camino único entre clientes de correo: el que
 * funciona en Gmail no es el que funciona en el cliente por defecto de iOS, y sin
 * la copia `attachment` el correo llega sin fotos en el móvil. Con las dos son
 * 1–3 MB y el límite de Gmail son 25 MB.
 *
 * **El `cid` sale del `indice`, no de trocear el nombre.** Un slug puede empezar por
 * un guion, y `nombre.split("-")[0]` devolvería entonces una cadena vacía: el `cid`
 * sería `promo-` y la imagen no se vería en el correo. Es el tipo de fallo que solo
 * aparece la semana que toca, y por eso el número viaja explícito.
 */
export function adjuntosDe(imagenes: ImagenDescargada[]): Adjunto[] {
  return [
    ...imagenes.map(
      (img): Adjunto => ({
        filename: `${nombreCompleto(img)}.png`,
        content: img.content,
        contentDisposition: "inline",
        cid: `promo-${img.indice}`,
      })
    ),
    ...imagenes.map(
      (img): Adjunto => ({
        filename: `${nombreCompleto(img)}.png`,
        content: img.content,
        contentDisposition: "attachment",
      })
    ),
  ];
}

/**
 * Los ficheros en disco, antes de mandar nada.
 *
 * **El orden lo pone el script, no este módulo:** primero escribe, después manda. Si
 * el correo falla, lo que se necesita ya está aquí.
 *
 * Y por defecto van a `data/promo/<sábado>/`, que **no sobrevive a un redeploy** si
 * Dokploy no tiene volumen montado. Por eso el correo lleva las imágenes dentro y no
 * solo su ruta: el disco es la comodidad, el correo es el canal.
 */
export async function escribirPaqueteEnDisco(
  destino: string,
  desde: string,
  imagenes: ImagenDescargada[],
  paquete: unknown
): Promise<string> {
  const dir = join(destino, desde);
  await mkdir(dir, { recursive: true });
  for (const img of imagenes) {
    await writeFile(join(dir, `${nombreCompleto(img)}.png`), img.content);
  }
  await writeFile(join(dir, "paquete.json"), JSON.stringify(paquete, null, 2), "utf8");
  return dir;
}
```

- [ ] **Step 4: Crear `scripts/enviar-promo-finde.ts`**

```ts
/**
 * Manda por correo el carrusel del fin de semana. Uso: npx tsx scripts/enviar-promo-finde.ts
 *
 * También se ejecuta como cron (Dokploy), viernes por la mañana.
 *
 * **Este script no publica.** No hay token de Instagram ni llamada a la Graph API en
 * ninguna parte de este proyecto: el correo llega con las imágenes numeradas y quien
 * lo recibe decide si el finde lo merece y lo sube. Publicar es una decisión
 * editorial, y automatizarla metería una credencial en el repo a cambio de nada.
 *
 * Y lo que sí lee son los eventos del agregador, no de un `fetch` a `/api/*`, por el
 * mismo motivo que `scripts/send-newsletter.ts`: un script del repo no debería
 * depender de que su propio despliegue le deje pasar.
 */

/** Los ficheros van aquí salvo que `PROMO_DESTINO` diga otra cosa. */
const DESTINO_POR_DEFECTO = "data/promo";

export async function main() {
  console.log("[promo] Calculando la ventana del finde...");

  // `AsyncLocalStorage` no es global en Node 24 y `lib/agenda.ts` →
  // `lib/axiom/server.ts` → `@axiomhq/nextjs` lo lee de `globalThis` al
  // importarse. Dentro de Next ya está resuelto; en un script suelto con `tsx` no,
  // y el fallo es un `TypeError` que no dice qué lo ha provocado. Es el mismo apaño
  // que hace `jest.setup.ts` y que ya hace `scripts/send-newsletter.ts`.
  if (typeof (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage === "undefined") {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage =
      AsyncLocalStorage;
  }

  const { finDeSemanaDe, paqueteDePromo, MAX_DIAPOSITIVAS } = await import("@/lib/promo");
  const { asuntoDelCorreo, htmlDelCorreo } = await import("@/lib/promo-correo");
  const { getAgendaEventos, getAgendaSalud } = await import("@/lib/agenda");
  const { recomendados } = await import("@/lib/recomendados");
  const { localDateStr } = await import("@/lib/utils");

  const { desde, hasta } = finDeSemanaDe(localDateStr(new Date()));
  console.log(`[promo] Ventana: ${desde} — ${hasta}`);

  // ---------------------------------------------------------------- puerta 1
  // El agregado entero. Comparar con los findes anteriores **no vale**, y está
  // medido por qué: el agregado no guarda eventos pasados —cualquier ventana en el
  // pasado devuelve 0—, así que la línea base sería 0 y la comparación no se
  // dispararía nunca. `sourcesFallidas` sí lo dice.
  const salud = await getAgendaSalud();
  if (salud.sourcesFallidas.length > 0 || !salud.completa) {
    console.error(
      `[promo] El agregado está degradado (${salud.sourcesOk}/${salud.sourcesTotal}).`,
      `Fuentes caídas: ${salud.sourcesFallidas.join(", ")}`
    );
    console.error("[promo] No se manda nada. Con el agregado a medias, el paquete sería medio finde.");
    process.exitCode = 1;
    return;
  }

  const eventos = await getAgendaEventos();
  const lista = recomendados(eventos, { desde, hasta, limite: MAX_DIAPOSITIVAS });
  const paquete = paqueteDePromo(lista, { desde, hasta });

  const { descargarImagenes, escribirPaqueteEnDisco, adjuntosDe } =
    await import("@/lib/promo-ficheros");
  const destino = process.env.PROMO_DESTINO ?? DESTINO_POR_DEFECTO;

  /** Lo que siempre se hace: bajar, escribir en disco y avisar. */
  const preparar = async () => {
    const imagenes = await descargarImagenes([paquete.portada, ...paquete.imagenes]);
    const dir = await escribirPaqueteEnDisco(destino, desde, imagenes, paquete);
    console.log(`[promo] ${imagenes.length} imágenes en ${dir}`);
    return imagenes;
  };

  // ---------------------------------------------------------------- puerta 2
  // Tres planes es el mínimo. Este paquete existe y solo es fino, así que **sí** se
  // escribe en disco: quien lo encuentre decide si lo publica.
  if (lista.length < 3) {
    console.warn(`[promo] Solo ${lista.length} planes en la ventana. No se manda correo.`);
    await preparar();
    console.warn(`[promo] El paquete está en disco por si quieres mandarlo a mano.`);
    process.exitCode = 1;
    return;
  }

  const imagenes = await preparar();

  const para = process.env.PROMO_PARA?.trim();
  if (!para) {
    console.error("[promo] Falta PROMO_PARA. El paquete está en disco y no se manda correo.");
    process.exitCode = 1;
    return;
  }

  const { sendMail } = await import("@/lib/mail");
  const titulos = lista.map((e) => e.title);

  const res = await sendMail({
    to: para,
    subject: asuntoDelCorreo(desde, hasta, lista.length),
    html: htmlDelCorreo(paquete, titulos),
    text: `${paquete.texto}\n\n${paquete.enlace}`,
    attachments: adjuntosDe(imagenes),
  });

  if (!res.ok) {
    console.error(`[promo] No se pudo mandar el correo: ${res.error}`);
    console.error("[promo] El paquete sigue en disco.");
    process.exitCode = 1;
    return;
  }

  console.log(`[promo] Mandado a ${para}. ${lista.length} diapositivas más la portada.`);
}

// Solo cuando el fichero es el programa que se ejecuta.
if (require.main === module) {
  main().catch((error) => {
    console.error("[promo] Fallo grave:", error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Correrlo y verlo pasar**

```
npx jest __tests__/enviar-promo-finde.test.ts
```

Expected: PASS.

- [ ] **Step 6: El script en `package.json`**

Añade a `scripts`, junto a `newsletter:send`:

```json
"promo:finde": "npx tsx scripts/enviar-promo-finde.ts"
```

- [ ] **Step 7: `PROMO_PARA` en `.env.example`**

En la sección de Correo, después de `EMAIL_PASS=`:

```bash
# A quién llega el paquete del fin de semana. **Sin ella el script escribe los
# ficheros en disco y sale con código 1**, sin mandar nada. No es la lista de
# suscriptores: esto es interno.
PROMO_PARA=

# Dónde se dejan las imágenes del paquete. Por defecto `data/promo`, que **no
# sobrevive a un redeploy** sin volumen persistente. El correo lleva las imágenes
# dentro, así que esto es la comodidad y no la garantía.
# PROMO_DESTINO=/datos/promo
```

- [ ] **Step 8: `README.md`**

En la tabla de variables, después de la fila de `EMAIL_PASS`:

```markdown
| `PROMO_PARA` | Destinatario del paquete del fin de semana. Sin ella el cron escribe los ficheros y sale con 1 |
```

Y añade una sección nueva después de la que explica `EMAIL_USER`/`EMAIL_PASS`:

```markdown
### El paquete del fin de semana por correo

```bash
npm run promo:finde
```

El viernes por la mañana manda a `PROMO_PARA` un correo con el carrusel del fin de
semana: las imágenes numeradas y en línea, el texto del pie para copiar y pegar, y el
enlace con la utm de la fecha. **No publica**: no hay token de Instagram ni llamada a
la Graph API en ninguna parte del proyecto, y quien recibe el correo decide si el
finde lo merece.

Dos cosas pueden pararlo, y ninguna es un error de configuración:

- **El agregado está degradado.** Si alguna fuente falló, no manda nada y no escribe
  ficheros. Comparar el finde con los anteriores no serviría: el agregado no guarda
  eventos pasados, así que la comparación no tiene línea base.
- **El finde viene flojo.** Con menos de tres planes escribe los ficheros en disco y
  no manda correo, para que quien lo quiera pueda mandarlo a mano.

Sin `PROMO_PARA` pasa lo mismo: ficheros en disco, código de salida 1.
```

- [ ] **Step 9: Correrlo todo**

```
npx jest __tests__/enviar-promo-finde.test.ts __tests__/fin-de-semana.test.ts __tests__/promo-correo.test.ts __tests__/mail-adjuntos.test.ts __tests__/promo-paquete.test.ts
```

Expected: PASS.

- [ ] **Step 10: Comitear**

```bash
git add scripts/enviar-promo-finde.ts lib/promo-ficheros.ts __tests__/enviar-promo-finde.test.ts package.json .env.example README.md
git commit -m "feat(promo): el finde por correo, con dos puertas y sin publicar"
```

---

## Verificación del plan

```
npm test
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

Los cuatro en verde. Y una comprobación a mano, que es la única que no se automatiza:
poner `PROMO_PARA` en `.env.local`, correr `npm run promo:finde` con la NODE_ENV de
desarrollo, abrir el correo en el móvil **y** en Gmail, y comprobar que las imágenes se
ven en línea y que se pueden guardar. Es el motivo de que las imágenes viajen dos veces,
y un correo que funciona en el escritorio y no en el móvil es un correo que no se
puede publicar desde el móvil.

## Lo que este plan no hace, y es deliberado

- **Publicar.** Ni un `fetch` a la Graph API, ni una variable de token, ni un modo "si
  está configurado, publica". Ese día, si llega, es otro spec, y este cron ya le
  habrá dado el paquete a quien publica.
- **Historias.** Son 9:16, no 4:5, y el paquete entero está en 1080×1350 porque es lo
  que ocupa más feed. Una historia con esas proporciones sale con bandas negras: hace
  falta otro tamaño, otro diseño y otro endpoint.
- **Un calendario de festivos.** `finDeSemanaDe` devuelve el sábado y el domingo aunque
  el lunes sea festivo y el finde real sea el siguiente. Es el mismo límite que ya
  tienen `lib/season.ts` y `lib/blanca.ts`.